import * as core from '@actions/core'
import {state} from '../env/state'
import {log, LogLevel} from '../env/logging'

function setupState(): void {
    state.setImpl({
        isDebug: core.isDebug,
        get: core.getState,
        set: core.saveState,
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
                log.debug(message)
                break
            case LogLevel.INFO:
                log.info(message)
                break
            case LogLevel.WARN:
                log.warn(message)
                break
            case LogLevel.ERROR:
                core.error(message)
                break
        }
    })
}

export const configureGithubEnv = (): void => {
    setupState()
    setupLogger()
}
