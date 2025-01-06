import * as dependencyGraph from '../../dependency-graph'
import {DependencyGraphConfig, GradleExecutionConfig, getActionId, setActionId} from '../../configuration'
import {failOnUseOfRemovedFeature, saveDeprecationState} from '../../deprecation-collector'
import {handleMainActionError} from '../../errors'
import {SetupGradleAction} from '../../setup-gradle'
import {gradleEnv} from '../../env/github-action'
import {setupDependencies} from '../../inject'
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

        const dependencies = setupDependencies(gradleEnv)
        const {gradleProvisioner} = dependencies

        // Configure Gradle environment (Gradle User Home)
        await SetupGradleAction.create(dependencies).setup()

        // Configure the dependency graph submission
        await dependencyGraph.setup(new DependencyGraphConfig())

        const config = new GradleExecutionConfig()
        config.verifyNoArguments()

        await gradleProvisioner.provisionGradle(config.getGradleVersion())

        saveDeprecationState()
    } catch (error) {
        handleMainActionError(error)
    }

    // Explicit process.exit() to prevent waiting for hanging promises.
    process.exit()
}

run()
