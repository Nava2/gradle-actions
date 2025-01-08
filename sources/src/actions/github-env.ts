import {GradleContext, GradleEnvImplementation, GradleEnv, GradleEnvStateImplementation} from '../env/env'
import * as core from '@actions/core'
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
        getInput: core.getInput
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

    exportVariable(name: string, val: string): void {
        core.exportVariable(name, val)
    }
}

export const githubActionGradleEnv: GradleEnv = new GradleEnv(githubContext, new GitHubActionGradleEnv())
