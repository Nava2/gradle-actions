import {setupCaching} from './caching/inject'
import {Dependencies} from './inject-dependencies'
import {setupExecutables} from './execution/inject'
import {setupConfigurations} from './env/configuration'

export function setupDependencies(supplied: Partial<Dependencies> = {}): Dependencies {
    const config = setupConfigurations(supplied.config)

    const {cacheConfig} = config

    const execution = setupExecutables(cacheConfig, supplied.execution)
    const {gradleProvisioner} = execution

    const cache = setupCaching(cacheConfig, gradleProvisioner, supplied.cache)

    return {
        ...supplied,
        config,
        execution,
        cache
    }
}
