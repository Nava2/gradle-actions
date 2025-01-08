export interface GradleGlob {
    /**
     * Hashes all files matching the glob pattern.
     * @param glob Glob pattern to match files.
     */
    hashFiles(glob: string): Promise<string>

    create(patterns: string, options?: GlobOptions): Promise<Globber>
}

/**
 * Used to match files and directories
 */
export interface Globber {
    /**
     * Returns files and directories matching the glob patterns.
     *
     * Order of the results is not guaranteed.
     */
    glob(): Promise<string[]>
}

/**
 * Options to control globbing behavior
 */
export interface GlobOptions {
    /**
     * Indicates whether directories that match a glob pattern, should implicitly
     * cause all descendant paths to be matched.
     *
     * For example, given the directory `my-dir`, the following glob patterns
     * would produce the same results: `my-dir/**`, `my-dir/`, `my-dir`
     *
     * @default true
     */
    implicitDescendants?: boolean
}
