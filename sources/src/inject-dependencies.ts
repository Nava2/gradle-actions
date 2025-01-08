import {CacheDependencies} from './caching/inject'
import {ConfigurationDependencies} from './env/configuration'
import {GradleExecutionDependencies} from './execution/inject'

/**
 * Defines the tree of dependencies.
 */

export interface Dependencies {
    readonly config: ConfigurationDependencies
    readonly execution: GradleExecutionDependencies
    readonly cache: CacheDependencies
}
