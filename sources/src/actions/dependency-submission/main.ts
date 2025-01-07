import * as core from '@actions/core'
import * as gradle from '../../execution/gradle'
import * as dependencyGraph from '../../dependency-graph'

import {parseArgsStringToArgv} from 'string-argv'
import {DependencyGraphConfig, DependencyGraphOption, GradleExecutionConfig, setActionId} from '../../configuration'
import {saveDeprecationState} from '../../deprecation-collector'
import {handleMainActionError} from '../../errors'
import {SetupGradleAction} from '../../setup-gradle'
import {GradleProvisioner} from '../../execution/provision'
import {GradleExecutableExecutor} from '../../execution/gradle'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        setActionId('gradle/actions/dependency-submission')

        // Configure Gradle environment (Gradle User Home)
        await SetupGradleAction.create().setup()

        // Capture the enabled state of dependency-graph
        const originallyEnabled = process.env['GITHUB_DEPENDENCY_GRAPH_ENABLED']

        // Configure the dependency graph submission
        const dependencyGraphConfig = new DependencyGraphConfig()
        await dependencyGraph.setup(dependencyGraphConfig)

        if (dependencyGraphConfig.getDependencyGraphOption() === DependencyGraphOption.DownloadAndSubmit) {
            // No execution to perform
            return
        }

        // Only execute if arguments have been provided
        const executionConfig = new GradleExecutionConfig()
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

        const gradleExecutor = new GradleExecutableExecutor()
        const gradleProvisioner = new GradleProvisioner(gradleExecutor)
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
