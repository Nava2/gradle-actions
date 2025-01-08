import {CacheConfig} from '../env/configuration'
import {GradleExecutableExecutor} from './gradle'
import {GradleProvisioner} from './provision'

export interface GradleExecutionDependencies {
    readonly gradleProvisioner: GradleProvisioner
    readonly gradleExecutor: GradleExecutableExecutor
}

export function setupExecutables(
    cacheConfig: CacheConfig,
    supplied?: GradleExecutionDependencies
): GradleExecutionDependencies {
    const gradleExecutor = supplied?.gradleExecutor ?? new GradleExecutableExecutor()

    return {
        ...supplied,
        gradleExecutor,
        gradleProvisioner: supplied?.gradleProvisioner ?? new GradleProvisioner(gradleExecutor, cacheConfig)
    }
}
