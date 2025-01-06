import {CacheConfig} from '../configuration'
import {GradleEnv} from '../env/env'
import {GradleProvisioner} from '../execution/provision'
import {Dependencies} from '../inject'
import {CacheCleaner} from './cache-cleaner'
import {CacheKeyGenerator} from './cache-key'
import {RemoteCacheAccessor} from './cache-utils'
import {CacheContentFactory} from './caches'

export function setupCaching(
    env: GradleEnv,
    cacheConfig: CacheConfig,
    gradleProvisioner: GradleProvisioner,
    supplied: Partial<Dependencies>
): Partial<Dependencies> {
    const cacheCleaner = supplied.cacheCleaner ?? new CacheCleaner(env, gradleProvisioner)
    const remoteCacheAccessor = supplied.remoteCacheAccessor ?? new RemoteCacheAccessor(env)
    const cacheKeyGenerator = supplied.cacheKeyGenerator ?? new CacheKeyGenerator(env)
    const cacheContentFactory =
        supplied.cacheContentFactory ??
        new CacheContentFactory(env, cacheConfig, remoteCacheAccessor, cacheKeyGenerator, cacheCleaner)
    return {...supplied, cacheCleaner, remoteCacheAccessor, cacheKeyGenerator, cacheContentFactory}
}
