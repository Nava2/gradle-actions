import {setupCaching} from './caching/inject'
import {Dependencies} from './inject-dependencies'
import {setupExecutables} from './execution/inject'
import {setupConfigurations} from './env/configuration'
import {GradleEnv} from './env/env'

export function setupDependencies(env: GradleEnv, supplied: Partial<Dependencies> = {}): Dependencies {
    const config = setupConfigurations(env, supplied.config)

    const {cacheConfig} = config

    const execution = setupExecutables(env, cacheConfig, supplied.execution)
    const {gradleProvisioner} = execution

    const cache = setupCaching(env, cacheConfig, gradleProvisioner, supplied.cache)

    return {
        env,
        ...supplied,
        config,
        execution,
        cache
    }
}
