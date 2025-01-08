import {
    GradleContext,
    GradleEnvImplementation,
    GradleEnv,
    GradleEnvStateImplementation,
    GradleEnvExecOptions
} from '../env/env'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'

const githubContext: GradleContext = {
    workflowIdentifier: github.context.workflow,
    jobIdentifier: github.context.job,
    gitRef: github.context.sha,
    workspaceDirectory: process.env.GITHUB_WORKSPACE || ''
}

class GitHubActionGradleEnv implements GradleEnvImplementation {
    readonly state: GradleEnvStateImplementation = {
        get: core.getState,
        set: core.saveState,
        getInput: core.getInput,
        getMultilineInput: core.getMultilineInput,
        exportVariable: core.exportVariable
    }

    readonly exec = {
        group: core.group,
        run: async (command: string, args?: string[], options?: GradleEnvExecOptions): Promise<void> => {
            await exec.exec(command, args, options)
        },
        getExecOutput: async (
            command: string,
            args?: string[],
            options?: GradleEnvExecOptions
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

    isDebug(): boolean {
        return core.isDebug()
    }
}

export const githubActionGradleEnv: GradleEnv = new GradleEnv(githubContext, new GitHubActionGradleEnv())
