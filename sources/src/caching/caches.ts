import * as core from '@actions/core'
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

const CACHE_RESTORED_VAR = 'GRADLE_BUILD_ACTION_CACHE_RESTORED'

/**
 * Provides a small factory for setting up `CacheContent` to easily create new instances.
 */
export class CacheContentFactory {
    private readonly cacheConfig: CacheConfig
    private readonly cacheAccessor: RemoteCacheAccessor
    private readonly cacheKeyGenerator: CacheKeyGenerator

    constructor(cacheConfig: CacheConfig, cacheAccessor: RemoteCacheAccessor, cacheKeyGenerator: CacheKeyGenerator) {
        this.cacheConfig = cacheConfig
        this.cacheAccessor = cacheAccessor
        this.cacheKeyGenerator = cacheKeyGenerator
    }

    create({userHome, gradleUserHome}: {userHome: string; gradleUserHome: string}): CacheContent {
        return new CacheContent({
            userHome,
            gradleUserHome,
            cacheConfig: this.cacheConfig,
            cacheAccessor: this.cacheAccessor,
            cacheKeyGenerator: this.cacheKeyGenerator
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
    private readonly userHome: string
    private readonly gradleUserHome: string

    constructor({
        userHome,
        gradleUserHome,
        cacheConfig,
        cacheAccessor,
        cacheKeyGenerator
    }: {
        userHome: string
        gradleUserHome: string
        cacheConfig: CacheConfig
        cacheAccessor: RemoteCacheAccessor
        cacheKeyGenerator: CacheKeyGenerator
    }) {
        this.userHome = userHome
        this.gradleUserHome = gradleUserHome
        this.cacheConfig = cacheConfig
        this.cacheAccessor = cacheAccessor
        this.cacheKeyGenerator = cacheKeyGenerator
    }

    async restore(cacheListener: CacheListener): Promise<void> {
        // Bypass restore cache on all but first action step in workflow.
        if (process.env[CACHE_RESTORED_VAR]) {
            core.info('Cache only restored on first action step.')
            return
        }
        core.exportVariable(CACHE_RESTORED_VAR, true)

        const gradleStateCache = this.createGradleHomeCache()

        if (this.cacheConfig.isCacheDisabled()) {
            core.info('Cache is disabled: will not restore state from previous builds.')
            // Initialize the Gradle User Home even when caching is disabled.
            gradleStateCache.init()
            cacheListener.setDisabled()
            return
        }

        if (gradleStateCache.cacheOutputExists()) {
            if (!this.cacheConfig.isCacheOverwriteExisting()) {
                core.info('Gradle User Home already exists: will not restore from cache.')
                // Initialize pre-existing Gradle User Home.
                gradleStateCache.init()
                cacheListener.setDisabled(EXISTING_GRADLE_HOME)
                return
            }
            core.info('Gradle User Home already exists: will overwrite with cached contents.')
        }

        gradleStateCache.init()
        // Mark the state as restored so that post-action will perform save.
        core.saveState(CACHE_RESTORED_VAR, true)

        if (this.cacheConfig.isCacheCleanupEnabled()) {
            core.info('Preparing cache for cleanup.')
            const cacheCleaner = new CacheCleaner(this.gradleUserHome, process.env['RUNNER_TEMP']!)
            await cacheCleaner.prepare()
        }

        if (this.cacheConfig.isCacheWriteOnly()) {
            core.info('Cache is write-only: will not restore from cache.')
            cacheListener.setWriteOnly()
            return
        }

        await core.group('Restore Gradle state from cache', async () => {
            await gradleStateCache.restore(cacheListener)
        })
    }

    async save(
        cacheListener: CacheListener,
        daemonController: DaemonController,
        buildResults: BuildResults
    ): Promise<void> {
        if (this.cacheConfig.isCacheDisabled()) {
            core.info('Cache is disabled: will not save state for later builds.')
            return
        }

        if (!core.getState(CACHE_RESTORED_VAR)) {
            core.info('Cache will not be saved: not restored in main action step.')
            return
        }

        if (this.cacheConfig.isCacheReadOnly()) {
            core.info('Cache is read-only: will not save state for use in subsequent builds.')
            cacheListener.setReadOnly()
            return
        }

        await core.group('Stopping Gradle daemons', async () => {
            await daemonController.stopAllDaemons()
        })

        if (this.cacheConfig.isCacheCleanupEnabled()) {
            if (buildResults.anyConfigCacheHit()) {
                core.info('Not performing cache-cleanup due to config-cache reuse')
                cacheListener.setCacheCleanupDisabled(CLEANUP_DISABLED_DUE_TO_CONFIG_CACHE_HIT)
            } else if (this.cacheConfig.shouldPerformCacheCleanup(buildResults.anyFailed())) {
                cacheListener.setCacheCleanupEnabled()
                await this.performCacheCleanup(this.gradleUserHome)
            } else {
                core.info('Not performing cache-cleanup due to build failure')
                cacheListener.setCacheCleanupDisabled(CLEANUP_DISABLED_DUE_TO_FAILURE)
            }
        }

        await core.group('Caching Gradle state', async () => {
            return this.createGradleHomeCache().save(cacheListener)
        })
    }

    async performCacheCleanup(gradleUserHome: string): Promise<void> {
        const cacheCleaner = new CacheCleaner(gradleUserHome, process.env['RUNNER_TEMP']!)
        try {
            await cacheCleaner.forceCleanup()
        } catch (e) {
            core.warning(`Cache cleanup failed. Will continue. ${String(e)}`)
        }
    }

    private createGradleHomeCache(): GradleUserHomeCache {
        return new GradleUserHomeCache(
            this.userHome,
            this.gradleUserHome,
            this.cacheConfig,
            this.cacheAccessor,
            this.cacheKeyGenerator
        )
    }
}
