import {CacheConfig} from '../env/configuration'
import {GradleEnv} from '../env/env'
import {GradleProvisioner} from '../execution/provision'
import {CacheCleaner} from './cache-cleaner'
import {CacheKeyGenerator} from './cache-key'
import {RemoteCacheAccessor} from './cache-utils'
import {CacheContentFactory} from './caches'

export interface CacheDependencies {
    readonly cacheCleaner: CacheCleaner
    readonly remoteCacheAccessor: RemoteCacheAccessor
    readonly cacheKeyGenerator: CacheKeyGenerator
    readonly cacheContentFactory: CacheContentFactory
}

export function setupCaching(
    env: GradleEnv,
    cacheConfig: CacheConfig,
    gradleProvisioner: GradleProvisioner,
    supplied?: Partial<CacheDependencies>
): CacheDependencies {
    const cacheCleaner = supplied?.cacheCleaner ?? new CacheCleaner(env, gradleProvisioner)
    const cacheAccessor = supplied?.remoteCacheAccessor ?? new RemoteCacheAccessor(env)
    const cacheKeyGenerator = supplied?.cacheKeyGenerator ?? new CacheKeyGenerator(env)
    const cacheContentFactory =
        supplied?.cacheContentFactory ??
        new CacheContentFactory({env, cacheConfig, cacheAccessor, cacheKeyGenerator, cacheCleaner})
    return {...supplied, cacheCleaner, remoteCacheAccessor: cacheAccessor, cacheKeyGenerator, cacheContentFactory}
}
