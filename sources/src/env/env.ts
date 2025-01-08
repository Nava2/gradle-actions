export interface GradleEnvLogger {
    /**
     * Log an `info` message.
     */
    info(message: string): void

    /**
     * Log a `debug` message.
     */
    debug(message: string): void

    /**
     * Log a `warning` message.
     */
    warning(message: string): void
}

export interface GradleContext {
    /**
     * A unique identifier for the current workflow run (e.g. collection of jobs).
     */
    readonly workflowIdentifier: string

    /**
     * A unique job identifier for this current context. For example, a Github Action job number.
     */
    readonly jobIdentifier: string

    /**
     * Current git commit ref.
     */
    readonly gitRef: string

    /**
     * Workspace directory.
     */
    readonly workspaceDirectory: string
}

export interface GradleEnvImplementation {
    readonly log: GradleEnvLogger

    /**
     * True if the current execution is in debug mode.
     */
    isDebug(): boolean
}

export class GradleEnv {
    private readonly impl: GradleEnvImplementation

    readonly log: GradleEnvLogger

    readonly context: GradleContext

    constructor(context: GradleContext, impl: GradleEnvImplementation) {
        this.impl = impl
        this.log = impl.log
        this.context = context
    }

    isDebug(): boolean {
        if (this.impl.isDebug()) {
            return true
        }

        return process.env['GRADLE_BUILD_ACTION_CACHE_DEBUG_ENABLED'] ? true : false
    }

    cacheDebug(message: string): void {
        if (this.isDebug()) {
            this.log.info(message)
        } else {
            this.log.debug(message)
        }
    }
}
