import * as provisioner from '../../execution/provision'
import * as dependencyGraph from '../../dependency-graph'
import {DependencyGraphConfig, GradleExecutionConfig, getActionId, setActionId} from '../../configuration'
import {failOnUseOfRemovedFeature, saveDeprecationState} from '../../deprecation-collector'
import {handleMainActionError} from '../../errors'
import {SetupGradleAction} from '../../setup-gradle'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        if (getActionId() === 'gradle/gradle-build-action') {
            failOnUseOfRemovedFeature(
                'The action `gradle/gradle-build-action` has been replaced by `gradle/actions/setup-gradle`'
            )
        }

        setActionId('gradle/actions/setup-gradle')

        // Configure Gradle environment (Gradle User Home)
        await SetupGradleAction.create().setup()

        // Configure the dependency graph submission
        await dependencyGraph.setup(new DependencyGraphConfig())

        const config = new GradleExecutionConfig()
        config.verifyNoArguments()
        await provisioner.provisionGradle(config.getGradleVersion())

        saveDeprecationState()
    } catch (error) {
        handleMainActionError(error)
    }

    // Explicit process.exit() to prevent waiting for hanging promises.
    process.exit()
}

run()
