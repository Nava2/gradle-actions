import {GradleContext, GradleEnvImplementation, GradleEnvState, GradleEnv} from './env'
import * as core from '@actions/core'
import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import {CacheEntryAlreadyExistsError, CacheValidationError, GradleEnvCache, GradleEnvCacheEntry} from './cache'
import {GradleGlob} from './glob'

const githubContext: GradleContext = {
    workflowIdentifier: github.context.workflow,
    jobIdentifier: github.context.job,
    gitRef: github.context.sha
}

class GitHubActionGradleEnv implements GradleEnvImplementation {
    readonly state: GradleEnvState = {
        get: (key: string): string => {
            return core.getState(key)
        },

        set: (key: string, value: string): void => {
            core.saveState(key, value)
        }
    }

    readonly exec = {
        group: core.group,
        run: async (command: string, args?: string[], options?: exec.ExecOptions): Promise<void> => {
            await exec.exec(command, args, options)
        },
        getExecOutput: async (
            command: string,
            args?: string[],
            options?: exec.ExecOptions
        ): Promise<{stdout: string; stderr: string}> => {
            return await exec.getExecOutput(command, args, options)
        }
    }

    readonly log = {
        info: core.info,
        debug: core.debug,
        warning: core.warning
    }

    readonly context: GradleContext = githubContext

    readonly cache: GradleEnvCache = {
        isAvailable: cache.isFeatureAvailable,
        saveCache: async (paths: string[], key: string): Promise<GradleEnvCacheEntry> => {
            try {
                return await cache.saveCache(paths, key)
            } catch (error) {
                if (error instanceof cache.ReserveCacheError) {
                    throw new CacheEntryAlreadyExistsError(error.message)
                } else if (error instanceof cache.ValidationError) {
                    throw new CacheValidationError(error.message)
                } else {
                    throw error
                }
            }
        },
        restoreCache: cache.restoreCache
    }

    readonly glob: GradleGlob = {
        hashFiles: glob.hashFiles,
        create: glob.create
    }

    isDebug(): boolean {
        return core.isDebug()
    }

    exportVariable(name: string, val: string): void {
        core.exportVariable(name, val)
    }
}

export const gradleEnv: GradleEnv = new GradleEnv(githubContext, new GitHubActionGradleEnv())
