import {Logger} from './logging'
import {CIState} from './state'

export {CIStateInputOptions} from './state'
export const state = new CIState()

export {LogLevel} from './logging'
export const log = new Logger()
