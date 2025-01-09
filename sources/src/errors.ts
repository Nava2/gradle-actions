import * as core from '@actions/core'
import {log, state} from './env'

export class JobFailure extends Error {
    constructor(error: unknown) {
        if (error instanceof Error) {
            super(error.message)
            this.name = error.name
            this.stack = error.stack
        } else {
            super(String(error))
        }
    }
}

export function handleMainActionError(error: unknown): void {
    if (error instanceof AggregateError) {
        state.setFailed(`Multiple errors returned`)
        for (const err of error.errors) {
            core.error(`Error ${error.errors.indexOf(err)}: ${err.message}`)
            if (err.stack) {
                log.info(err.stack)
            }
        }
    } else if (error instanceof JobFailure) {
        state.setFailed(String(error))
        if (error.stack) {
            log.info(error.stack)
        }
    } else {
        state.setFailed(String(error))
        if (error instanceof Error && error.stack) {
            log.info(error.stack)
        }
    }
}

export function handlePostActionError(error: unknown): void {
    if (error instanceof JobFailure) {
        state.setFailed(String(error))
        if (error.stack) {
            log.info(error.stack)
        }
    } else {
        log.warn(`Unhandled error in Gradle post-action - job will continue: ${error}`)
        if (error instanceof Error && error.stack) {
            log.info(error.stack)
        }
    }
}
