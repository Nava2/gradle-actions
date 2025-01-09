import * as core from '@actions/core'
import * as ghCache from '@actions/cache'
import * as ghExec from '@actions/exec'

import {
    cache,
    CICacheEntry,
    exec,
    CIExecOptions,
    log,
    LogLevel,
    state,
    CacheEntryAlreadyExistsError,
    CacheValidationError
} from '../env'

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

function setupCache(): void {
    cache.setImpl({
        isAvailable: ghCache.isFeatureAvailable,

        saveCache: async (paths: string[], key: string): Promise<CICacheEntry> => {
            try {
                return await ghCache.saveCache(paths, key)
            } catch (error) {
                if (error instanceof ghCache.ReserveCacheError) {
                    throw new CacheEntryAlreadyExistsError(error.message)
                } else if (error instanceof ghCache.ValidationError) {
                    throw new CacheValidationError(error.message)
                } else {
                    throw error
                }
            }
        },

        restoreCache: ghCache.restoreCache
    })
}

export const configureGithubEnv = (): void => {
    setupState()
    setupLogger()
    setupExec()
    setupCache()
}
