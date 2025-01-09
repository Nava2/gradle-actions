import * as core from '@actions/core'
import {state} from '../env'

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

export const configureGithubEnv = (): void => {
    setupState()
}
