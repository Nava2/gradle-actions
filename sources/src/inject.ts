import {CacheCleaner} from './caching/cache-cleaner'
import {CacheKeyGenerator} from './caching/cache-key'
import {RemoteCacheAccessor} from './caching/cache-utils'
import {CacheContentFactory} from './caching/caches'
import {setupCaching} from './caching/inject'
import {
    CacheConfig,
    BuildScanConfig,
    WrapperValidationConfig,
    SummaryConfig,
    setupConfigurations
} from './configuration'
import {GradleEnv} from './env/env'
import {GradleExecutableExecutor} from './execution/gradle'
import {setupExecutables} from './execution/inject'
import {GradleProvisioner} from './execution/provision'

/**
 * Defines the tree of dependencies.
 */
export interface Dependencies {
    readonly env: GradleEnv
    readonly cacheConfig: CacheConfig
    readonly buildScanConfig: BuildScanConfig
    readonly wrapperValidationConfig: WrapperValidationConfig
    readonly summaryConfig: SummaryConfig
    readonly gradleProvisioner: GradleProvisioner
    readonly gradleExecutor: GradleExecutableExecutor
    readonly cacheCleaner: CacheCleaner
    readonly remoteCacheAccessor: RemoteCacheAccessor
    readonly cacheKeyGenerator: CacheKeyGenerator
    readonly cacheContentFactory: CacheContentFactory
}

export function setupDependencies(env: GradleEnv, supplied: Partial<Dependencies> = {}): Dependencies {
    const configurations = setupConfigurations(env, supplied)

    const {cacheConfig} = configurations

    const executables = setupExecutables(env, supplied)
    const {gradleProvisioner} = executables

    const caching = setupCaching(env, cacheConfig!, gradleProvisioner!, supplied)

    return {
        env,
        ...supplied,
        ...configurations,
        ...executables,
        ...caching
    } as Dependencies
}
