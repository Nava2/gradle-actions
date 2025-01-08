import {CacheConfig} from '../env/configuration'
import {GradleEnv} from '../env/env'
import {GradleExecutableExecutor} from './gradle'
import {GradleProvisioner} from './provision'

export interface GradleExecutionDependencies {
    readonly gradleProvisioner: GradleProvisioner
    readonly gradleExecutor: GradleExecutableExecutor
}

export function setupExecutables(
    env: GradleEnv,
    cacheConfig: CacheConfig,
    supplied?: GradleExecutionDependencies
): GradleExecutionDependencies {
    const gradleExecutor = supplied?.gradleExecutor ?? new GradleExecutableExecutor()

    return {
        ...supplied,
        gradleExecutor,
        gradleProvisioner: supplied?.gradleProvisioner ?? new GradleProvisioner(env, gradleExecutor, cacheConfig)
    }
}
