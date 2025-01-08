import {GradleEnvCache} from './cache'

/**
 * Provides read/write access to saving state within the environment.
 */
export interface GradleEnvStateImplementation {
    get(key: string): string
    set(key: string, value: string): void

    getInput(key: string, options?: GradleEnvInputOptions): string

    /**
     * Gets the values of an multiline input.  Each value is also trimmed.
     *
     * @param     name     name of the input to get
     * @param     options  optional. See InputOptions.
     * @returns   string[]
     */
    getMultilineInput(name: string, options?: GradleEnvInputOptions): string[]

    /**
     * Sets env variable for this action and future actions in the job
     * @param name the name of the variable to set
     * @param val the value of the variable.
     */
    exportVariable(name: string, val: string): void
}

export interface GradleEnvInputOptions {
    /**
     * True if input is required.
     */
    readonly required?: boolean
}

/**
 * Provides read/write access to saving state within the environment.
 */
export class GradleEnvState {
    private readonly impl: GradleEnvStateImplementation

    constructor(impl: GradleEnvStateImplementation) {
        this.impl = impl
    }

    get(key: string): string {
        return this.impl.get(key)
    }
    set(key: string, value: string): void {
        this.impl.set(key, value)
    }

    getInput(key: string, options?: GradleEnvInputOptions): string {
        return this.impl.getInput(key, options)
    }

    getMultilineInput(name: string, options?: GradleEnvInputOptions): string[] {
        return this.impl.getMultilineInput(name, options)
    }

    getOptionalInput(paramName: string): string | undefined {
        const paramValue = this.getInput(paramName)
        if (paramValue.length > 0) {
            return paramValue
        }
        return undefined
    }

    getBooleanInput(paramName: string, paramDefault = false): boolean {
        const paramValue = this.getInput(paramName)
        switch (paramValue.toLowerCase().trim()) {
            case '':
                return paramDefault
            case 'false':
                return false
            case 'true':
                return true
        }
        throw TypeError(`The value '${paramValue} is not valid for '${paramName}. Valid values are: [true, false]`)
    }

    getOptionalBooleanInput(paramName: string): boolean | undefined {
        const paramValue = this.getInput(paramName)
        if (paramValue === '') {
            return undefined
        }
        return this.getBooleanInput(paramName)
    }

    /**
     * Sets env variable for this action and future actions in the job
     * @param name the name of the variable to set
     * @param val the value of the variable.
     */
    exportVariable(name: string, val: string): void {
        return this.impl.exportVariable(name, val)
    }
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

    /**
     * Workspace directory.
     */
    readonly workspaceDirectory: string
}

export interface GradleEnvImplementation {
    readonly log: GradleEnvLogger

    /**
     * Access to saving state within the environment.
     */
    readonly state: GradleEnvStateImplementation

    /**
     * Execution environment access.
     */
    readonly exec: GradleEnvExecution

    readonly cache: GradleEnvCache

    /**
     * True if the current execution is in debug mode.
     */
    isDebug(): boolean
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

    constructor(context: GradleContext, impl: GradleEnvImplementation) {
        this.impl = impl
        this.state = new GradleEnvState(impl.state)
        this.exec = impl.exec
        this.log = impl.log
        this.context = context
        this.cache = impl.cache
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
