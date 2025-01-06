import {
    CacheListener,
    EXISTING_GRADLE_HOME,
    CLEANUP_DISABLED_DUE_TO_FAILURE,
    CLEANUP_DISABLED_DUE_TO_CONFIG_CACHE_HIT
} from './cache-reporting'
import {GradleUserHomeCache} from './gradle-user-home-cache'
import {CacheCleaner} from './cache-cleaner'
import {DaemonController} from '../daemon-controller'
import {CacheConfig} from '../configuration'
import {BuildResults} from '../build-results'
import {CacheKeyGenerator} from './cache-key'
import {RemoteCacheAccessor} from './cache-utils'
import {GradleEnv, GradleEnvLogger} from '../env/env'

const CACHE_RESTORED_VAR = 'GRADLE_BUILD_ACTION_CACHE_RESTORED'

/**
 * Provides a small factory for setting up `CacheContent` to easily create new instances.
 */
export class CacheContentFactory {
    private readonly env: GradleEnv
    private readonly cacheConfig: CacheConfig
    private readonly cacheAccessor: RemoteCacheAccessor
    private readonly cacheKeyGenerator: CacheKeyGenerator
    private readonly cacheCleaner: CacheCleaner

    constructor(
        env: GradleEnv,
        cacheConfig: CacheConfig,
        cacheAccessor: RemoteCacheAccessor,
        cacheKeyGenerator: CacheKeyGenerator,
        cacheCleaner: CacheCleaner
    ) {
        this.env = env
        this.cacheConfig = cacheConfig
        this.cacheAccessor = cacheAccessor
        this.cacheKeyGenerator = cacheKeyGenerator
        this.cacheCleaner = cacheCleaner
    }

    create({userHome, gradleUserHome}: {userHome: string; gradleUserHome: string}): CacheContent {
        return new CacheContent({
            env: this.env,
            userHome,
            gradleUserHome,
            cacheConfig: this.cacheConfig,
            cacheAccessor: this.cacheAccessor,
            cacheKeyGenerator: this.cacheKeyGenerator,
            cacheCleaner: this.cacheCleaner
        })
    }
}

/**
 * Provides restore/save functionality for caching content in a build.
 */
export class CacheContent {
    private readonly cacheConfig: CacheConfig
    private readonly cacheAccessor: RemoteCacheAccessor
    private readonly cacheKeyGenerator: CacheKeyGenerator
    private readonly cacheCleaner: CacheCleaner
    private readonly userHome: string
    private readonly gradleUserHome: string
    private readonly env: GradleEnv
    private readonly log: GradleEnvLogger

    constructor({
        env,
        userHome,
        gradleUserHome,
        cacheConfig,
        cacheAccessor,
        cacheKeyGenerator,
        cacheCleaner
    }: {
        env: GradleEnv
        userHome: string
        gradleUserHome: string
        cacheConfig: CacheConfig
        cacheAccessor: RemoteCacheAccessor
        cacheKeyGenerator: CacheKeyGenerator
        cacheCleaner: CacheCleaner
    }) {
        this.userHome = userHome
        this.gradleUserHome = gradleUserHome
        this.cacheConfig = cacheConfig
        this.cacheAccessor = cacheAccessor
        this.cacheKeyGenerator = cacheKeyGenerator
        this.cacheCleaner = cacheCleaner
        this.env = env
        this.log = env.log
    }

    async restore(cacheListener: CacheListener): Promise<void> {
        // Bypass restore cache on all but first action step in workflow.
        if (process.env[CACHE_RESTORED_VAR]) {
            this.log.info('Cache only restored on first action step.')
            return
        }
        this.env.exportVariable(CACHE_RESTORED_VAR, true.toString())

        const gradleStateCache = this.createGradleHomeCache()

        if (this.cacheConfig.isCacheDisabled()) {
            this.log.info('Cache is disabled: will not restore state from previous builds.')
            // Initialize the Gradle User Home even when caching is disabled.
            gradleStateCache.init()
            cacheListener.setDisabled()
            return
        }

        if (gradleStateCache.cacheOutputExists()) {
            if (!this.cacheConfig.isCacheOverwriteExisting()) {
                this.log.info('Gradle User Home already exists: will not restore from cache.')
                // Initialize pre-existing Gradle User Home.
                gradleStateCache.init()
                cacheListener.setDisabled(EXISTING_GRADLE_HOME)
                return
            }
            this.log.info('Gradle User Home already exists: will overwrite with cached contents.')
        }

        gradleStateCache.init()
        // Mark the state as restored so that post-action will perform save.
        this.env.state.set(CACHE_RESTORED_VAR, true.toString())

        if (this.cacheConfig.isCacheCleanupEnabled()) {
            this.log.info('Preparing cache for cleanup.')
            await this.cacheCleaner.prepare()
        }

        if (this.cacheConfig.isCacheWriteOnly()) {
            this.log.info('Cache is write-only: will not restore from cache.')
            cacheListener.setWriteOnly()
            return
        }

        await this.env.exec.group('Restore Gradle state from cache', async () => {
            await gradleStateCache.restore(cacheListener)
        })
    }

    async save(
        cacheListener: CacheListener,
        daemonController: DaemonController,
        buildResults: BuildResults
    ): Promise<void> {
        if (this.cacheConfig.isCacheDisabled()) {
            this.log.info('Cache is disabled: will not save state for later builds.')
            return
        }

        if (!this.env.state.get(CACHE_RESTORED_VAR)) {
            this.log.info('Cache will not be saved: not restored in main action step.')
            return
        }

        if (this.cacheConfig.isCacheReadOnly()) {
            this.log.info('Cache is read-only: will not save state for use in subsequent builds.')
            cacheListener.setReadOnly()
            return
        }

        await this.env.exec.group('Stopping Gradle daemons', async () => {
            await daemonController.stopAllDaemons()
        })

        if (this.cacheConfig.isCacheCleanupEnabled()) {
            if (buildResults.anyConfigCacheHit()) {
                this.log.info('Not performing cache-cleanup due to config-cache reuse')
                cacheListener.setCacheCleanupDisabled(CLEANUP_DISABLED_DUE_TO_CONFIG_CACHE_HIT)
            } else if (this.cacheConfig.shouldPerformCacheCleanup(buildResults.anyFailed())) {
                cacheListener.setCacheCleanupEnabled()
                await this.performCacheCleanup()
            } else {
                this.log.info('Not performing cache-cleanup due to build failure')
                cacheListener.setCacheCleanupDisabled(CLEANUP_DISABLED_DUE_TO_FAILURE)
            }
        }

        await this.env.exec.group('Caching Gradle state', async () => {
            return this.createGradleHomeCache().save(cacheListener)
        })
    }

    async performCacheCleanup(): Promise<void> {
        try {
            await this.cacheCleaner.forceCleanup(this.gradleUserHome, process.env['RUNNER_TEMP']!)
        } catch (e) {
            this.log.warning(`Cache cleanup failed. Will continue. ${String(e)}`)
        }
    }

    private createGradleHomeCache(): GradleUserHomeCache {
        return new GradleUserHomeCache(
            this.env,
            this.userHome,
            this.gradleUserHome,
            this.cacheConfig,
            this.cacheAccessor,
            this.cacheKeyGenerator
        )
    }
}
