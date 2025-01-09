import * as core from '@actions/core'
import * as ghExec from '@actions/exec'

import {exec, CIExecOptions, log, LogLevel, state} from '../env'

function setupState(): void {
    state.setImpl({
        isDebug: core.isDebug,
        get: core.getState,
        save: core.saveState,
        getInput: core.getInput,
        getMultilineInput: core.getMultilineInput,
        exportVariable: core.exportVariable,
        setFailed: core.setFailed
    })
}

function setupLogger(): void {
    // Redirect the log output to the GitHub Actions logging system.
    log.setWriter((level, message) => {
        switch (level) {
            case LogLevel.DEBUG:
                core.debug(message)
                break
            case LogLevel.INFO:
                core.info(message)
                break
            case LogLevel.NOTICE:
                core.notice(message)
                break
            case LogLevel.WARN:
                core.warning(message)
                break
            case LogLevel.ERROR:
                core.error(message)
                break
        }
    })
}

function setupExec(): void {
    exec.setImpl({
        group: core.group,

        run: async (command: string, args?: string[], options?: CIExecOptions): Promise<void> => {
            await ghExec.exec(command, args, options)
        },

        exec: async (commandLine: string, args?: string[], options?: CIExecOptions): Promise<number> => {
            return await ghExec.exec(commandLine, args, options)
        },

        getExecOutput: async (
            command: string,
            args?: string[],
            options?: CIExecOptions
        ): Promise<{stdout: string; stderr: string}> => {
            return await ghExec.getExecOutput(command, args, options)
        }
    })
}

export const configureGithubEnv = (): void => {
    setupState()
    setupLogger()
    setupExec()
}
