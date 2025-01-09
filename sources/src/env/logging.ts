import {state} from './state'

/**
 * Provides simple access to log levels.
 */
export enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
}

/**
 * Log writer function, called by [Logger] to write log messages.
 */
export type LoggerWriter = (level: LogLevel, message: string) => void

/**
 * Provides a thin wrapper around a log class that can be changed to different implementations.
 */
class Logger {
    private writer: LoggerWriter

    constructor() {
        this.writer = (level: LogLevel, message: string) => {
            // eslint-disable-next-line no-console
            console.log(`[${LogLevel[level]}] ${message}`)
        }
    }

    setWriter(writer: LoggerWriter): void {
        this.writer = writer
    }

    debug(message: string): void {
        this.writer(LogLevel.DEBUG, message)
    }
    cacheDebug(message: string): void {
        if (state.isCacheDebuggingEnabled()) {
            this.info(message)
        } else {
            this.debug(message)
        }
    }

    info(message: string): void {
        this.writer(LogLevel.INFO, message)
    }

    warn(message: string): void {
        this.writer(LogLevel.WARN, message)
    }
}

export const log = new Logger()
