import {GradleContext, GradleEnvImplementation, GradleEnv} from '../env/env'
import * as core from '@actions/core'
import * as github from '@actions/github'

const githubContext: GradleContext = {
    workflowIdentifier: github.context.workflow,
    jobIdentifier: github.context.job,
    gitRef: github.context.sha,
    workspaceDirectory: process.env.GITHUB_WORKSPACE || ''
}

class GitHubActionGradleEnv implements GradleEnvImplementation {
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
