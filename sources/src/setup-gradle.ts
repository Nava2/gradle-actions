import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as jobSummary from './job-summary'
import * as buildScan from './develocity/build-scan'

import {loadBuildResults, markBuildResultsProcessed} from './build-results'
import {CacheListener, generateCachingReport} from './caching/cache-reporting'
import {DaemonController} from './daemon-controller'
import {BuildScanConfig, SummaryConfig, WrapperValidationConfig} from './env/configuration'
import * as wrapperValidator from './wrapper-validation/wrapper-validator'
import {CacheContentFactory} from './caching/caches'
import {GradleEnv, GradleEnvLogger, GradleEnvState} from './env/env'
import {Dependencies} from './inject-dependencies'

const GRADLE_SETUP_VAR = 'GRADLE_BUILD_ACTION_SETUP_COMPLETED'
const USER_HOME = 'USER_HOME'
const GRADLE_USER_HOME = 'GRADLE_USER_HOME'
const CACHE_LISTENER = 'CACHE_LISTENER'

/**
 * Sets up Gradle in the environment to execute a build.
 */
export class SetupGradleAction {
    private readonly env: GradleEnv
    private readonly log: GradleEnvLogger
    private readonly state: GradleEnvState
    private readonly buildScanConfig: BuildScanConfig
    private readonly wrapperValidationConfig: WrapperValidationConfig
    private readonly summaryConfig: SummaryConfig

    private readonly cacheContentFactory: CacheContentFactory

    constructor(
        env: GradleEnv,
        buildScanConfig: BuildScanConfig,
        wrapperValidationConfig: WrapperValidationConfig,
        summaryConfig: SummaryConfig,
        cacheContentFactory: CacheContentFactory
    ) {
        this.env = env
        this.log = env.log
        this.state = env.state
        this.buildScanConfig = buildScanConfig
        this.wrapperValidationConfig = wrapperValidationConfig
        this.summaryConfig = summaryConfig
        this.cacheContentFactory = cacheContentFactory
    }

    static create(dependencies: Dependencies): SetupGradleAction {
        return new SetupGradleAction(
            dependencies.env,
            dependencies.config.buildScanConfig,
            dependencies.config.wrapperValidationConfig,
            dependencies.config.summaryConfig,
            dependencies.cache.cacheContentFactory
        )
    }

    async setup(): Promise<boolean> {
        const userHome = await this.determineUserHome()
        const gradleUserHome = await this.determineGradleUserHome()

        // Bypass setup on all but first action step in workflow.
        if (process.env[GRADLE_SETUP_VAR]) {
            this.log.info('Gradle setup only performed on first gradle/actions step in workflow.')
            return false
        }
        // Record setup complete: visible to all subsequent actions and prevents duplicate setup
        this.state.exportVariable(GRADLE_SETUP_VAR, true.toString())
        // Record setup complete: visible in post-action, to control action completion
        this.state.set(GRADLE_SETUP_VAR, true.toString())

        // Save the User Home and Gradle User Home for use in the post-action step.
        this.state.set(USER_HOME, userHome)
        this.state.set(GRADLE_USER_HOME, gradleUserHome)

        const cacheContent = this.cacheContentFactory.create({
            userHome,
            gradleUserHome
        })

        const cacheListener = new CacheListener(this.env)
        await cacheContent.restore(cacheListener)

        this.state.set(CACHE_LISTENER, cacheListener.stringify())

        await wrapperValidator.validateWrappers(
            this.wrapperValidationConfig,
            this.env.context.workspaceDirectory,
            gradleUserHome
        )

        await buildScan.setup(this.buildScanConfig)

        return true
    }

    async complete(): Promise<boolean> {
        if (!this.state.get(GRADLE_SETUP_VAR)) {
            this.log.info('Gradle setup post-action only performed for first gradle/actions step in workflow.')
            return false
        }
        this.log.info('In post-action step')

        const buildResults = loadBuildResults()

        const userHome = this.state.get(USER_HOME)
        const gradleUserHome = this.state.get(GRADLE_USER_HOME)
        const cacheListener = CacheListener.rehydrate(this.env, this.state.get(CACHE_LISTENER))

        const daemonController = new DaemonController(buildResults)

        const cacheContent = this.cacheContentFactory.create({
            userHome,
            gradleUserHome
        })

        await cacheContent.save(cacheListener, daemonController, buildResults)

        const cachingReport = generateCachingReport(cacheListener)
        await jobSummary.generateJobSummary(this.env, buildResults, cachingReport, this.summaryConfig)

        markBuildResultsProcessed()

        this.log.info('Completed post-action step')

        return true
    }

    private async determineGradleUserHome(): Promise<string> {
        const customGradleUserHome = process.env['GRADLE_USER_HOME']
        if (customGradleUserHome) {
            const rootDir = this.env.context.workspaceDirectory
            return path.resolve(rootDir, customGradleUserHome)
        }

        const defaultGradleUserHome = path.resolve(await this.determineUserHome(), '.gradle')
        // Use the default Gradle User Home if it already exists
        if (fs.existsSync(defaultGradleUserHome)) {
            this.log.info(`Gradle User Home already exists at ${defaultGradleUserHome}`)
            this.state.exportVariable('GRADLE_USER_HOME', defaultGradleUserHome)
            return defaultGradleUserHome
        }

        // Switch Gradle User Home to faster 'D:' drive if possible
        if (os.platform() === 'win32' && defaultGradleUserHome.startsWith('C:\\') && fs.existsSync('D:\\a\\')) {
            const fasterGradleUserHome = 'D:\\a\\.gradle'
            this.log.info(`Setting GRADLE_USER_HOME to ${fasterGradleUserHome} to leverage (potentially) faster drive.`)
            this.state.exportVariable('GRADLE_USER_HOME', fasterGradleUserHome)
            return fasterGradleUserHome
        }

        this.state.exportVariable('GRADLE_USER_HOME', defaultGradleUserHome)
        return defaultGradleUserHome
    }

    /**
     * Different values can be returned by os.homedir() in Javascript and System.getProperty('user.home') in Java.
     * In order to determine the correct Gradle User Home, we ask Java for the user home instead of using os.homedir().
     */
    private async determineUserHome(): Promise<string> {
        const output = await exec.getExecOutput('java', ['-XshowSettings:properties', '-version'], {silent: true})
        const regex = /user\.home = (\S*)/i
        const found = output.stderr.match(regex)
        if (found == null || found.length <= 1) {
            this.log.info('Could not determine user.home from java -version output. Using os.homedir().')
            return os.homedir()
        }
        const userHome = found[1]
        this.log.debug(`Determined user.home from java -version output: '${userHome}'`)
        return userHome
    }
}
