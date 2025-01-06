import {GradleEnv} from '../env/env'
import {Dependencies} from '../inject'
import {GradleExecutableExecutor} from './gradle'
import {GradleProvisioner} from './provision'

export function setupExecutables(env: GradleEnv, supplied: Partial<Dependencies>): Partial<Dependencies> {
    const gradleExecutor = supplied.gradleExecutor ?? new GradleExecutableExecutor()
    const gradleProvisioner = supplied.gradleProvisioner ?? new GradleProvisioner(env, gradleExecutor)

    return {
        ...supplied,
        gradleExecutor,
        gradleProvisioner
    }
}
