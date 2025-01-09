import * as core from '@actions/core'
import {log, LogLevel, state} from '../env'

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

export const configureGithubEnv = (): void => {
    setupState()
    setupLogger()
}
