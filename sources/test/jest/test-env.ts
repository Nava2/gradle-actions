import {
    cache, 
    CacheEntryAlreadyExistsError,
    CICacheEntry,
    RemoteCacheDownloadOptions, 
    exec, 
    CIExecOptions, 
    log, 
    state
} from '../../src/env'

import util from 'util'
import {exec as cp_exec} from 'child_process'
import {readFile as fs_readFile, writeFile as fs_writeFile} from 'fs'
import { CIStateImplementation } from '../../src/env/state'
import { CICacheImplementation } from '../../src/env/cache'

const pexec = util.promisify(cp_exec);
const readFile = util.promisify(fs_readFile)
const writeFile = util.promisify(fs_writeFile)

class TestStateImplementation implements CIStateImplementation {
    readonly state: Record<string, string> = {}

    readonly inputs: Record<string, string> = {}

    readonly env: Record<string, string> = {}

    _isDebug = false

    isDebug(): boolean {
        return this._isDebug
    }
    
    get(key: string): string {
        return this.state[key] ?? ''
    }

    save(key: string, value: string): void {
        this.state[key] = value
    }

    getInput(key: string): string {
        return this.inputs[key] ?? ''
    }

    setInput(key: string, value: string) {
        this.inputs[key] = value
    }

    getMultilineInput(name: string): string[] {
        const input = this.inputs[name]
        return input?.split('\n') ?? []
    }

    exportVariable(name: string, value: string): void {
        process.env[name] = value
    }

    setFailed(message: string | Error): void {
        throw new Error(message.toString())
    }
}

export const testState = new TestStateImplementation()

function setupState(): void {
    state.setImpl(testState)
}

function setupExec(): void {
    exec.setImpl(
        {
            group: <R>(name: string, fn: () => Promise<R>): Promise<R> => {
                try {
                    log.debug(`::group-enter:: ${name}`)
                    return fn()
                } finally {
                    log.debug(`::group-exit:: ${name}`)
                }
            },

            run: async (command: string, args?: string[], options?: CIExecOptions): Promise<void> => {
                await pexec([command, ...(args ?? [])].join(' '), options)
            },

            exec: async (command: string, args?: string[], options?: CIExecOptions): Promise<number> => {
                try {
                    await pexec([command, ...(args ?? [])].join(' '), options)
                    return 0
                } catch (error) {
                    log.warn(`Failed to run ${command}: ${error}`)
                    return 1
                }
            },

            getExecOutput: async (
                command: string,
                args?: string[],
                options?: CIExecOptions
            ): Promise<{stdout: string; stderr: string}> => {
                const result = await pexec([command, ...(args ?? [])].join(' '), options)
                return {stdout: result.stdout.toString(), stderr: result.stderr.toString()}
            }
        }
    )
}

class TestCacheImpl implements CICacheImplementation {
    private readonly cacheContent: Record<string, Record<string, Uint8Array>> = {}

    private _isAvailable: boolean = true

    isAvailable(): boolean {
        return this._isAvailable
    }

    enable(): void {
        this._isAvailable = true
    }

    disable(): void {
        this._isAvailable = false
    }

    async saveCache(paths: string[], key: string): Promise<CICacheEntry> {
        if (this.cacheContent[key]) {
            throw new CacheEntryAlreadyExistsError(`Cache entry with key ${key} already exists`)
        }

        const fileContents = paths.map(async (path) => {
            return await readFile(path)
        })

        let size = 0
        const value: Record<string, Buffer<ArrayBufferLike>> = {}
        for (const [path, contentsPromise] of zip(paths, fileContents)) {
            const contents = await contentsPromise
            value[path] = contents
            size += contents.byteLength
        }

        this.cacheContent[key] = value
        return { key, size }
    }

    async restoreCache(paths: string[], primaryKey: string, restoreKeys?: string[], options?: RemoteCacheDownloadOptions): Promise<CICacheEntry | undefined> {
        for (const key in [primaryKey, ...(restoreKeys ?? [])]) {
            const cacheEntry = this.cacheContent[key]
            // Look up is by hierarchal keys, so its possible the key does not exist.
            if (!cacheEntry) continue 
            
            // Write all the cached files to disk in parallel
            await Promise.all(paths.map(async (path) => {
                const content = cacheEntry[path]
                if (content) {
                    await writeFile(path, content)
                }
            }))

            return { key: primaryKey, size: Object.values(cacheEntry).reduce((acc, val) => acc + val.byteLength, 0) }
        }

        return undefined
    }
}

export const testCache = new TestCacheImpl()

function setupCache(): void {
    cache.setImpl(testCache)
}

export const configureTestEnv = (): void => {
    setupState()
    setupExec()
    setupCache()
}

function zip<A, B>(a: A[], b: B[]): [A, B][] {
    return a.map((k, i) => [k, b[i]]);
}
