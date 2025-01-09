import {state} from '.'

/**
 * Provides simple access to log levels.
 */
export enum LogLevel {
    DEBUG,
    INFO,
    NOTICE,
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
export class Logger {
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

    notice(message: string): void {
        this.writer(LogLevel.NOTICE, message)
    }

    warn(message: string): void {
        this.writer(LogLevel.WARN, message)
    }
}
