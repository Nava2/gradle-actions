import {CICache} from './cache'
import {CIExec} from './execution'
import {Logger} from './logging'
import {CIState} from './state'

export {CIStateInputOptions} from './state'
export const state = new CIState()

export {LogLevel} from './logging'
export const log = new Logger()

export {CIExecOptions} from './execution'
export const exec = new CIExec()

export {CICacheEntry, RemoteCacheDownloadOptions, CacheEntryAlreadyExistsError, CacheValidationError} from './cache'
export const cache = new CICache()
