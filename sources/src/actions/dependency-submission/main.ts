import * as core from '@actions/core'
import * as gradle from '../../execution/gradle'
import * as dependencyGraph from '../../dependency-graph'

import {parseArgsStringToArgv} from 'string-argv'
import {DependencyGraphOption, setActionId} from '../../env/configuration'
import {saveDeprecationState} from '../../deprecation-collector'
import {handleMainActionError} from '../../errors'
import {SetupGradleAction} from '../../setup-gradle'
import {setupDependencies} from '../../inject'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        setActionId('gradle/actions/dependency-submission')

        const dependencies = setupDependencies()
        const {
            execution: {gradleExecutor, gradleProvisioner},
            config: {gradleExecutionConfig: executionConfig, dependencyGraphConfig}
        } = dependencies

        // Configure Gradle environment (Gradle User Home)
        await SetupGradleAction.create(dependencies).setup()

        // Capture the enabled state of dependency-graph
        const originallyEnabled = process.env['GITHUB_DEPENDENCY_GRAPH_ENABLED']

        // Configure the dependency graph submission
        await dependencyGraph.setup(dependencyGraphConfig)

        if (dependencyGraphConfig.getDependencyGraphOption() === DependencyGraphOption.DownloadAndSubmit) {
            // No execution to perform
            return
        }

        // Only execute if arguments have been provided
        const taskList = executionConfig.getDependencyResolutionTask()
        const additionalArgs = executionConfig.getAdditionalArguments()
        const executionArgs = `
              -Dorg.gradle.configureondemand=false
              -Dorg.gradle.dependency.verification=off
              -Dorg.gradle.unsafe.isolated-projects=false
              ${taskList}
              ${additionalArgs}
        `
        const args: string[] = parseArgsStringToArgv(executionArgs)

        await gradle.provisionAndMaybeExecute({
            gradleExecutor,
            gradleProvisioner,
            gradleVersion: executionConfig.getGradleVersion(),
            buildRootDirectory: executionConfig.getBuildRootDirectory(),
            args
        })

        await gradle.provisionAndMaybeExecute({
            gradleProvisioner,
            gradleExecutor,
            gradleVersion: executionConfig.getGradleVersion(),
            buildRootDirectory: executionConfig.getBuildRootDirectory(),
            args
        })

        await dependencyGraph.complete(dependencyGraphConfig)

        // Reset the enabled state of dependency graph
        core.exportVariable('GITHUB_DEPENDENCY_GRAPH_ENABLED', originallyEnabled)

        saveDeprecationState()
    } catch (error) {
        handleMainActionError(error)
    }

    // Explicit process.exit() to prevent waiting for hanging promises.
    process.exit()
}

run()
