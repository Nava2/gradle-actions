/**
 * Provides read/write access to saving state within the environment.
 */
export interface GradleEnvStateImplementation {
    /**
     * True if this build is being debugged.
     */
    isDebug(): boolean

    /**
     * Read a persistent value.
     *
     * @param key Property key
     * @returns The value of the property or `''` if not found.
     */
    get(key: string): string

    /**
     * Write a persistent value.
     *
     * @param key Property key
     * @param value Value to store
     */
    set(key: string, value: string): void

    /**
     * Read an input parameter from the triggered workflow.
     * @param key Input key
     * @param options optional. See [GradleEnvInputOptions].
     * @returns The value of the input or `''` if not found.
     */
    getInput(key: string, options?: GradleEnvInputOptions): string

    /**
     * Gets the values of an multiline input.  Each value is also trimmed.
     *
     * @param     name     name of the input to get
     * @param     options  optional. See [GradleEnvInputOptions].
     * @returns   string[] Values stored, or empty array if not found.
     */
    getMultilineInput(name: string, options?: GradleEnvInputOptions): string[]

    /**
     * Sets env variable for this action and future actions in the job.
     *
     * @param name the name of the variable to set
     * @param val the value of the variable.
     */
    exportVariable(name: string, val: string): void

    /**
     * Sets the action status to failed.
     * When the action exits it will be with an exit code of 1
     * @param message add error issue message
     */
    setFailed(message: string | Error): void
}

export interface GradleEnvInputOptions {
    /**
     * True if input is required.
     */
    readonly required?: boolean
}

/**
 * Provides read/write access to saving state within the environment.
 */
class GradleEnvState implements GradleEnvStateImplementation {
    private impl!: GradleEnvStateImplementation

    setImpl(impl: GradleEnvStateImplementation): void {
        this.impl = impl
    }

    isDebug(): boolean {
        return this.impl.isDebug()
    }

    isCacheDebuggingEnabled(): boolean {
        if (state.isDebug()) {
            return true
        }
        return process.env['GRADLE_BUILD_ACTION_CACHE_DEBUG_ENABLED'] ? true : false
    }

    get(key: string): string {
        return this.impl.get(key)
    }

    set(key: string, value: string): void {
        this.impl.set(key, value)
    }

    getInput(key: string, options?: GradleEnvInputOptions): string {
        return this.impl.getInput(key, options)
    }

    getMultilineInput(name: string, options?: GradleEnvInputOptions): string[] {
        return this.impl.getMultilineInput(name, options)
    }

    getOptionalInput(paramName: string): string | undefined {
        const paramValue = this.getInput(paramName)
        if (paramValue.length > 0) {
            return paramValue
        }
        return undefined
    }

    getBooleanInput(paramName: string, paramDefault = false): boolean {
        const paramValue = this.getInput(paramName)
        switch (paramValue.toLowerCase().trim()) {
            case '':
                return paramDefault
            case 'false':
                return false
            case 'true':
                return true
        }
        throw TypeError(`The value '${paramValue} is not valid for '${paramName}. Valid values are: [true, false]`)
    }

    getOptionalBooleanInput(paramName: string): boolean | undefined {
        const paramValue = this.getInput(paramName)
        if (paramValue === '') {
            return undefined
        }
        return this.getBooleanInput(paramName)
    }

    exportVariable(name: string, val: string): void {
        return this.impl.exportVariable(name, val)
    }

    setFailed(message: string | Error): void {
        return this.impl.setFailed(message)
    }
}

export const state = new GradleEnvState()
