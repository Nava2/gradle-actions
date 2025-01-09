/**
 * Provides a wrapper for execution of system commands in a job.
 */
export interface CIExecImplementation {
    /**
     * Wrap an asynchronous function call in a "group" of execution in a CI pipeline.
     * @param name Name of the group.
     * @param fn
     */
    group<R>(name: string, fn: () => Promise<R>): Promise<R>

    /**
     * Executes
     * @param command
     * @param args
     */
    run(command: string, args?: string[], options?: CIExecOptions): Promise<void>

    /**
     * Executes command and returns the output.
     * @param command
     * @param args
     * @param options
     */
    getExecOutput(command: string, args?: string[], options?: CIExecOptions): Promise<{stdout: string; stderr: string}>

    /**
     * Exec a command.
     * Output will be streamed to the live console.
     * Returns promise with return code
     *
     * @param     commandLine        command to execute (can include additional args). Must be correctly escaped.
     * @param     args               optional arguments for tool. Escaping is handled by the lib.
     * @param     options            optional exec options.  See ExecOptions
     * @returns   Promise<number>    exit code
     */
    exec(command: string, args?: string[], options?: CIExecOptions): Promise<number>
}

/**
 * Interface for exec options
 */
export interface CIExecOptions {
    /** optional working directory.  defaults to current */
    cwd?: string

    silent?: boolean

    ignoreReturnCode?: boolean

    /** optional envvar dictionary.  defaults to current process's env */
    env?: {
        [key: string]: string
    }
}

export class CIExec implements CIExecImplementation {
    private impl!: CIExecImplementation

    setImpl(impl: CIExecImplementation): void {
        this.impl = impl
    }

    async group<R>(name: string, fn: () => Promise<R>): Promise<R> {
        return await this.impl.group(name, fn)
    }

    async run(command: string, args?: string[], options?: CIExecOptions): Promise<void> {
        await this.impl.run(command, args, options)
    }

    async exec(command: string, args?: string[], options?: CIExecOptions): Promise<number> {
        return await this.impl.exec(command, args, options)
    }

    async getExecOutput(
        command: string,
        args?: string[],
        options?: CIExecOptions
    ): Promise<{stdout: string; stderr: string}> {
        return await this.impl.getExecOutput(command, args, options)
    }
}
