import { state } from '../../src/env'
import { CIStateImplementation } from '../../src/env/state'

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

const testState = new TestStateImplementation()

function setupState(): void {
    state.setImpl(testState)
}

export const configureTestEnv = (): void => {
    setupState()
}
