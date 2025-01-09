import {exec, CIExecOptions, log, state} from '../../src/env'
import {CIStateImplementation} from '../../src/env/state'

import util from 'util'
import {exec as cp_exec} from 'child_process'

const pexec = util.promisify(cp_exec);

class TestStateImplementation implements CIStateImplementation {
    readonly state: Record<string, string> = {}

    readonly inputs: Record<string, string> = {}

    readonly env: Record<string, string> = {}

    _isDebug = false

    isDebug(): boolean {
        return this._isDebug
    }
    
    get(key: string): string {
        return this.state[key] ?? ''
    }

    save(key: string, value: string): void {
        this.state[key] = value
    }

    getInput(key: string): string {
        return this.inputs[key] ?? ''
    }

    setInput(key: string, value: string) {
        this.inputs[key] = value
    }

    getMultilineInput(name: string): string[] {
        const input = this.inputs[name]
        return input?.split('\n') ?? []
    }

    exportVariable(name: string, value: string): void {
        process.env[name] = value
    }

    setFailed(message: string | Error): void {
        throw new Error(message.toString())
    }
}

const testState = new TestStateImplementation()

function setupState(): void {
    state.setImpl(testState)
}

function setupExec(): void {
    exec.setImpl(
        {
            group: <R>(name: string, fn: () => Promise<R>): Promise<R> => {
                try {
                    log.debug(`::group-enter:: ${name}`)
                    return fn()
                } finally {
                    log.debug(`::group-exit:: ${name}`)
                }
            },

            run: async (command: string, args?: string[], options?: CIExecOptions): Promise<void> => {
                await pexec([command, ...(args ?? [])].join(' '), options)
            },

            exec: async (command: string, args?: string[], options?: CIExecOptions): Promise<number> => {
                try {
                    await pexec([command, ...(args ?? [])].join(' '), options)
                    return 0
                } catch (error) {
                    log.warn(`Failed to run ${command}: ${error}`)
                    return 1
                }
            },

            getExecOutput: async (
                command: string,
                args?: string[],
                options?: CIExecOptions
            ): Promise<{stdout: string; stderr: string}> => {
                const result = await pexec([command, ...(args ?? [])].join(' '), options)
                return {stdout: result.stdout.toString(), stderr: result.stderr.toString()}
            }
        }
    )
}

export const configureTestEnv = (): void => {
    setupState()
    setupExec()
}
