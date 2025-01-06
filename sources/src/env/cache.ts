export interface GradleEnvCache {
    /**
     * True if the cache is available.
     */
    isAvailable(): boolean

    /**
     * Restores cache from keys
     *
     * @param paths a list of file paths to restore from the cache
     * @param primaryKey an explicit key for restoring the cache. Lookup is done with prefix matching.
     * @param restoreKeys an optional ordered list of keys to use for restoring the cache if no cache hit occurred for primaryKey
     * @param downloadOptions cache download options
     * @param enableCrossOsArchive an optional boolean enabled to restore on windows any cache created on any platform
     * @returns string returns the key for the cache hit, otherwise returns undefined
     */
    restoreCache(
        paths: string[],
        primaryKey: string,
        restoreKeys?: string[],
        options?: RemoteCacheDownloadOptions
    ): Promise<GradleEnvCacheEntry | undefined>

    /**
     * Saves a list of files with the specified key
     *
     * @param paths a list of file paths to be cached
     * @param key an explicit key for restoring the cache
     * @param enableCrossOsArchive an optional boolean enabled to save cache on windows which could be restored on any platform
     * @param options cache upload options
     * @returns number returns cacheId if the cache was saved successfully and throws an error if save fails
     */
    saveCache(paths: string[], key: string): Promise<GradleEnvCacheEntry>
}

/**
 * Thrown when a validation error occurs during caching.
 */
export class CacheValidationError extends Error {}

/**
 * Thrown when a cache entry already exists and can not be written to.
 */
export class CacheEntryAlreadyExistsError extends Error {}

/**
 * Options to control cache download
 */
export interface RemoteCacheDownloadOptions {
    /** optional cache download timeout.  defaults to 2 minutes */
    segmentTimeoutInMs?: number
}

export interface GradleEnvCacheEntry {
    key: string
    size?: number
}
