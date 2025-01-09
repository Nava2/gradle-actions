import * as path from 'path'
import * as core from '@actions/core'

import * as validate from '../../wrapper-validation/validate'
import {state} from '../../env'
import {getActionId, setActionId} from '../../configuration'
import {failOnUseOfRemovedFeature, emitDeprecationWarnings} from '../../deprecation-collector'
import {handleMainActionError} from '../../errors'

import {configureGithubEnv} from '../github-actions-env'
configureGithubEnv()

export async function run(): Promise<void> {
    try {
        if (getActionId() === 'gradle/wrapper-validation-action') {
            failOnUseOfRemovedFeature(
                'The action `gradle/wrapper-validation-action` has been replaced by `gradle/actions/wrapper-validation`'
            )
        }

        setActionId('gradle/actions/wrapper-validation')

        const result = await validate.findInvalidWrapperJars(
            path.resolve('.'),
            state.getInput('allow-snapshots') === 'true',
            state.getInput('allow-checksums').split(',')
        )
        if (result.isValid()) {
            core.info(result.toDisplayString())

            const minWrapperCount = +state.getInput('min-wrapper-count')
            if (result.valid.length < minWrapperCount) {
                const message =
                    result.valid.length === 0
                        ? 'Wrapper validation failed: no Gradle Wrapper jars found. Did you forget to checkout the repository?'
                        : `Wrapper validation failed: expected at least ${minWrapperCount} Gradle Wrapper jars, but found ${result.valid.length}.`
                state.setFailed(message)
            }
        } else {
            state.setFailed(
                `At least one Gradle Wrapper Jar failed validation!\n  See https://github.com/gradle/actions/blob/main/docs/wrapper-validation.md#validation-failures\n${result.toDisplayString()}`
            )
            if (result.invalid.length > 0) {
                core.setOutput('failed-wrapper', `${result.invalid.map(w => w.path).join('|')}`)
            }
        }

        emitDeprecationWarnings(false)
    } catch (error) {
        handleMainActionError(error)
    }
}

run()
