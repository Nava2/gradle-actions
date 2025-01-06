import {GradleEnvCache} from './cache'
import {GradleGlob} from './glob'

/**
 * Provides read/write access to saving state within the environment.
 */
export interface GradleEnvState {
    get(key: string): string
    set(key: string, value: string): void
}

export interface GradleEnvExecution {
    /**
     * Wrap an asynchronous function call in a "group" of execution in a CI pipeline.
     * @param name Name of the group.
     * @param fn
     */
    group(name: string, fn: () => Promise<void>): Promise<void>

    /**
     * Executes
     * @param command
     * @param args
     */
    run(command: string, args?: string[], options?: GradleEnvExecOptions): Promise<void>

    /**
     * Executes command and returns the output.
     * @param command
     * @param args
     * @param options
     */
    getExecOutput(
        command: string,
        args?: string[],
        options?: GradleEnvExecOptions
    ): Promise<{stdout: string; stderr: string}>
}

/**
 * Interface for exec options
 */
export interface GradleEnvExecOptions {
    /** optional working directory.  defaults to current */
    cwd?: string

    silent?: boolean

    ignoreReturnCode?: boolean

    /** optional envvar dictionary.  defaults to current process's env */
    env?: {
        [key: string]: string
    }
}

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
}

export interface GradleEnvImplementation {
    /**
     * Access to saving state within the environment.
     */
    readonly state: GradleEnvState

    /**
     * Execution environment access.
     */
    readonly exec: GradleEnvExecution

    readonly log: GradleEnvLogger

    readonly cache: GradleEnvCache

    readonly glob: GradleGlob

    /**
     * True if the current execution is in debug mode.
     */
    isDebug(): boolean

    /**
     * Sets env variable for this action and future actions in the job
     * @param name the name of the variable to set
     * @param val the value of the variable.
     */
    exportVariable(name: string, val: string): void
}

export class GradleEnv {
    private readonly impl: GradleEnvImplementation

    /**
     * Access to saving state within the environment.
     */
    readonly state: GradleEnvState

    /**
     * Execution environment access.
     */
    readonly exec: GradleEnvExecution

    readonly log: GradleEnvLogger

    readonly context: GradleContext

    readonly cache: GradleEnvCache

    readonly glob: GradleGlob

    constructor(context: GradleContext, impl: GradleEnvImplementation) {
        this.impl = impl
        this.state = impl.state
        this.exec = impl.exec
        this.log = impl.log
        this.context = context
        this.cache = impl.cache
        this.glob = impl.glob
    }

    isDebug(): boolean {
        if (this.impl.isDebug()) {
            return true
        }

        return process.env['GRADLE_BUILD_ACTION_CACHE_DEBUG_ENABLED'] ? true : false
    }

    /**
     * Sets env variable for this action and future actions in the job
     * @param name the name of the variable to set
     * @param val the value of the variable.
     */
    exportVariable(name: string, val: string): void {
        return this.impl.exportVariable(name, val)
    }

    cacheDebug(message: string): void {
        if (this.isDebug()) {
            this.log.info(message)
        } else {
            this.log.debug(message)
        }
    }
}
