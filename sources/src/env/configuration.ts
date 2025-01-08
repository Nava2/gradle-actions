import * as cache from '@actions/cache'
import * as github from '@actions/github'
import * as deprecator from '../deprecation-collector'
import {SUMMARY_ENV_VAR} from '@actions/core/lib/summary'

import path from 'path'
import {GradleEnv, GradleEnvLogger, GradleEnvState} from './env'

const ACTION_ID_VAR = 'GRADLE_ACTION_ID'

export const ACTION_METADATA_DIR = '.setup-gradle'

export class DependencyGraphConfig {
    private readonly env: GradleEnv
    private readonly state: GradleEnvState
    private readonly log: GradleEnvLogger

    constructor(env: GradleEnv) {
        this.env = env
        this.log = env.log
        this.state = env.state
    }

    getDependencyGraphOption(): DependencyGraphOption {
        const val = this.state.getInput('dependency-graph')
        switch (val.toLowerCase().trim()) {
            case 'disabled':
                return DependencyGraphOption.Disabled
            case 'generate':
                return DependencyGraphOption.Generate
            case 'generate-and-submit':
                return DependencyGraphOption.GenerateAndSubmit
            case 'generate-and-upload':
                return DependencyGraphOption.GenerateAndUpload
            case 'download-and-submit':
                return DependencyGraphOption.DownloadAndSubmit
        }
        throw TypeError(
            `The value '${val}' is not valid for 'dependency-graph'. Valid values are: [disabled, generate, generate-and-submit, generate-and-upload, download-and-submit]. The default value is 'disabled'.`
        )
    }

    getDependencyGraphContinueOnFailure(): boolean {
        return this.state.getBooleanInput('dependency-graph-continue-on-failure', true)
    }

    getArtifactRetentionDays(): number {
        const val = this.state.getInput('artifact-retention-days')
        return parseNumericInput('artifact-retention-days', val, 0)
        // Zero indicates that the default repository settings should be used
    }

    getJobCorrelator(): string {
        return this.constructJobCorrelator(
            this.env.context.workflowIdentifier,
            github.context.job,
            getJobMatrix(this.env)
        )
    }

    getReportDirectory(): string {
        const param = this.state.getInput('dependency-graph-report-dir')
        return path.resolve(this.env.context.workspaceDirectory, param)
    }

    getDownloadArtifactName(): string | undefined {
        return process.env['DEPENDENCY_GRAPH_DOWNLOAD_ARTIFACT_NAME']
    }

    getExcludeProjects(): string | undefined {
        return this.state.getOptionalInput('dependency-graph-exclude-projects')
    }

    getIncludeProjects(): string | undefined {
        return this.state.getOptionalInput('dependency-graph-include-projects')
    }

    getExcludeConfigurations(): string | undefined {
        return this.state.getOptionalInput('dependency-graph-exclude-configurations')
    }

    getIncludeConfigurations(): string | undefined {
        return this.state.getOptionalInput('dependency-graph-include-configurations')
    }

    // visible for testing
    constructJobCorrelator(workflow: string, jobId: string, matrixJson: string): string {
        const matrixString = this.describeMatrix(matrixJson)
        const label = matrixString ? `${workflow}-${jobId}-${matrixString}` : `${workflow}-${jobId}`
        return this.sanitize(label)
    }

    private describeMatrix(matrixJson: string): string {
        this.log.debug(`Got matrix json: ${matrixJson}`)
        const matrix = JSON.parse(matrixJson)
        if (matrix) {
            return Object.values(matrix).join('-')
        }
        return ''
    }

    private sanitize(value: string): string {
        return value
            .replace(/[^a-zA-Z0-9_-\s]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase()
    }
}

export enum DependencyGraphOption {
    Disabled = 'disabled',
    Generate = 'generate',
    GenerateAndSubmit = 'generate-and-submit',
    GenerateAndUpload = 'generate-and-upload',
    DownloadAndSubmit = 'download-and-submit'
}

export class CacheConfig {
    private readonly env: GradleEnv
    private readonly log: GradleEnvLogger
    private readonly state: GradleEnvState

    constructor(env: GradleEnv) {
        this.env = env
        this.log = env.log
        this.state = env.state
    }

    isCacheDisabled(): boolean {
        if (!cache.isFeatureAvailable()) {
            return true
        }

        return this.state.getBooleanInput('cache-disabled')
    }

    isCacheReadOnly(): boolean {
        return !this.isCacheWriteOnly() && this.state.getBooleanInput('cache-read-only')
    }

    isCacheWriteOnly(): boolean {
        return this.state.getBooleanInput('cache-write-only')
    }

    isCacheOverwriteExisting(): boolean {
        return this.state.getBooleanInput('cache-overwrite-existing')
    }

    isCacheStrictMatch(): boolean {
        return this.state.getBooleanInput('gradle-home-cache-strict-match')
    }

    isCacheCleanupEnabled(): boolean {
        if (this.isCacheReadOnly()) {
            return false
        }
        const cleanupOption = this.getCacheCleanupOption()
        return cleanupOption === CacheCleanupOption.Always || cleanupOption === CacheCleanupOption.OnSuccess
    }

    shouldPerformCacheCleanup(hasFailure: boolean): boolean {
        const cleanupOption = this.getCacheCleanupOption()
        if (cleanupOption === CacheCleanupOption.Always) {
            return true
        }
        if (cleanupOption === CacheCleanupOption.OnSuccess) {
            return !hasFailure
        }
        return false
    }

    private getCacheCleanupOption(): CacheCleanupOption {
        const legacyVal = this.state.getOptionalBooleanInput('gradle-home-cache-cleanup')
        if (legacyVal !== undefined) {
            deprecator.recordDeprecation(
                'The `gradle-home-cache-cleanup` input parameter has been replaced by `cache-cleanup`'
            )
            return legacyVal ? CacheCleanupOption.Always : CacheCleanupOption.Never
        }

        const val = this.state.getInput('cache-cleanup')
        switch (val.toLowerCase().trim()) {
            case 'always':
                return CacheCleanupOption.Always
            case 'on-success':
                return CacheCleanupOption.OnSuccess
            case 'never':
                return CacheCleanupOption.Never
        }
        throw TypeError(
            `The value '${val}' is not valid for cache-cleanup. Valid values are: [never, always, on-success].`
        )
    }

    getCacheEncryptionKey(): string {
        return this.state.getInput('cache-encryption-key')
    }

    getCacheIncludes(): string[] {
        return this.state.getMultilineInput('gradle-home-cache-includes')
    }

    getCacheExcludes(): string[] {
        return this.state.getMultilineInput('gradle-home-cache-excludes')
    }
}

export enum CacheCleanupOption {
    Never = 'never',
    OnSuccess = 'on-success',
    Always = 'always'
}

export class SummaryConfig {
    private readonly state: GradleEnvState

    constructor(env: GradleEnv) {
        this.state = env.state
    }

    shouldGenerateJobSummary(hasFailure: boolean): boolean {
        // Check if Job Summary is supported on this platform
        if (!process.env[SUMMARY_ENV_VAR]) {
            return false
        }

        return this.shouldAddJobSummary(this.getJobSummaryOption(), hasFailure)
    }

    shouldAddPRComment(hasFailure: boolean): boolean {
        return this.shouldAddJobSummary(this.getPRCommentOption(), hasFailure)
    }

    private shouldAddJobSummary(option: JobSummaryOption, hasFailure: boolean): boolean {
        switch (option) {
            case JobSummaryOption.Always:
                return true
            case JobSummaryOption.Never:
                return false
            case JobSummaryOption.OnFailure:
                return hasFailure
        }
    }

    private getJobSummaryOption(): JobSummaryOption {
        return this.parseJobSummaryOption('add-job-summary')
    }

    private getPRCommentOption(): JobSummaryOption {
        return this.parseJobSummaryOption('add-job-summary-as-pr-comment')
    }

    private parseJobSummaryOption(paramName: string): JobSummaryOption {
        const val = this.state.getInput(paramName)
        switch (val.toLowerCase().trim()) {
            case 'never':
                return JobSummaryOption.Never
            case 'always':
                return JobSummaryOption.Always
            case 'on-failure':
                return JobSummaryOption.OnFailure
        }
        throw TypeError(
            `The value '${val}' is not valid for ${paramName}. Valid values are: [never, always, on-failure].`
        )
    }
}

export enum JobSummaryOption {
    Never = 'never',
    Always = 'always',
    OnFailure = 'on-failure'
}

export class BuildScanConfig {
    private readonly log: GradleEnvLogger
    private readonly state: GradleEnvState

    constructor(env: GradleEnv) {
        this.log = env.log
        this.state = env.state
    }

    static DevelocityAccessKeyEnvVar = 'DEVELOCITY_ACCESS_KEY'
    static GradleEnterpriseAccessKeyEnvVar = 'GRADLE_ENTERPRISE_ACCESS_KEY'

    getBuildScanPublishEnabled(): boolean {
        return this.state.getBooleanInput('build-scan-publish') && this.verifyTermsOfUseAgreement()
    }

    getBuildScanTermsOfUseUrl(): string {
        return this.state.getInput('build-scan-terms-of-use-url')
    }

    getBuildScanTermsOfUseAgree(): string {
        return this.state.getInput('build-scan-terms-of-use-agree')
    }

    getDevelocityAccessKey(): string {
        return (
            this.state.getInput('develocity-access-key') ||
            process.env[BuildScanConfig.DevelocityAccessKeyEnvVar] ||
            process.env[BuildScanConfig.GradleEnterpriseAccessKeyEnvVar] ||
            ''
        )
    }

    getDevelocityTokenExpiry(): string {
        return this.state.getInput('develocity-token-expiry')
    }

    getDevelocityInjectionEnabled(): boolean | undefined {
        return this.state.getOptionalBooleanInput('develocity-injection-enabled')
    }

    getDevelocityUrl(): string {
        return this.state.getInput('develocity-url')
    }

    getDevelocityAllowUntrustedServer(): boolean | undefined {
        return this.state.getOptionalBooleanInput('develocity-allow-untrusted-server')
    }

    getDevelocityCaptureFileFingerprints(): boolean | undefined {
        return this.state.getOptionalBooleanInput('develocity-capture-file-fingerprints')
    }

    getDevelocityEnforceUrl(): boolean | undefined {
        return this.state.getOptionalBooleanInput('develocity-enforce-url')
    }

    getDevelocityPluginVersion(): string {
        return this.state.getInput('develocity-plugin-version')
    }

    getDevelocityCcudPluginVersion(): string {
        return this.state.getInput('develocity-ccud-plugin-version')
    }

    getGradlePluginRepositoryUrl(): string {
        return this.state.getInput('gradle-plugin-repository-url')
    }

    getGradlePluginRepositoryUsername(): string {
        return this.state.getInput('gradle-plugin-repository-username')
    }

    getGradlePluginRepositoryPassword(): string {
        return this.state.getInput('gradle-plugin-repository-password')
    }

    private verifyTermsOfUseAgreement(): boolean {
        if (
            (this.getBuildScanTermsOfUseUrl() !== 'https://gradle.com/terms-of-service' &&
                this.getBuildScanTermsOfUseUrl() !== 'https://gradle.com/help/legal-terms-of-use') ||
            this.getBuildScanTermsOfUseAgree() !== 'yes'
        ) {
            this.log.warning(
                `Terms of use at 'https://gradle.com/help/legal-terms-of-use' must be agreed in order to publish build scans.`
            )
            return false
        }
        return true
    }
}

export class GradleExecutionConfig {
    private readonly env: GradleEnv
    private readonly state: GradleEnvState

    constructor(env: GradleEnv) {
        this.env = env
        this.state = env.state
    }

    getGradleVersion(): string {
        return this.state.getInput('gradle-version')
    }

    getBuildRootDirectory(): string {
        const baseDirectory = this.env.context.workspaceDirectory
        const buildRootDirectoryInput = this.state.getInput('build-root-directory')
        const resolvedBuildRootDirectory =
            buildRootDirectoryInput === ''
                ? path.resolve(baseDirectory)
                : path.resolve(baseDirectory, buildRootDirectoryInput)
        return resolvedBuildRootDirectory
    }

    getDependencyResolutionTask(): string {
        return (
            this.state.getInput('dependency-resolution-task') ||
            ':ForceDependencyResolutionPlugin_resolveAllDependencies'
        )
    }

    getAdditionalArguments(): string {
        return this.state.getInput('additional-arguments')
    }

    verifyNoArguments(): void {
        const input = this.state.getInput('arguments')
        if (input.length !== 0) {
            deprecator.failOnUseOfRemovedFeature(
                `The 'arguments' parameter is no longer supported for ${getActionId()}`,
                'Using the action to execute Gradle via the `arguments` parameter is deprecated'
            )
        }
    }
}

export class WrapperValidationConfig {
    private readonly state: GradleEnvState

    constructor(env: GradleEnv) {
        this.state = env.state
    }

    doValidateWrappers(): boolean {
        return this.state.getBooleanInput('validate-wrappers')
    }

    allowSnapshotWrappers(): boolean {
        return this.state.getBooleanInput('allow-snapshot-wrappers')
    }
}

// Internal parameters
export function getJobMatrix(env: GradleEnv): string {
    return env.state.getInput('workflow-job-context')
}

export function getGithubToken(env: GradleEnv): string {
    return env.state.getInput('github-token', {required: true})
}

export function getWorkspaceDirectory(): string {
    return process.env[`GITHUB_WORKSPACE`] || ''
}

export function getActionId(): string | undefined {
    return process.env[ACTION_ID_VAR]
}

export function setActionId(env: GradleEnv, id: string): void {
    env.state.exportVariable(ACTION_ID_VAR, id)
}

export function parseNumericInput(paramName: string, paramValue: string, paramDefault: number): number {
    if (paramValue.length === 0) {
        return paramDefault
    }
    const numericValue = parseInt(paramValue)
    if (isNaN(numericValue)) {
        throw TypeError(`The value '${paramValue}' is not a valid numeric value for '${paramName}'.`)
    }
    return numericValue
}

export interface ConfigurationDependencies {
    readonly cacheConfig: CacheConfig
    readonly buildScanConfig: BuildScanConfig
    readonly wrapperValidationConfig: WrapperValidationConfig
    readonly summaryConfig: SummaryConfig
    readonly dependencyGraphConfig: DependencyGraphConfig
    readonly gradleExecutionConfig: GradleExecutionConfig
}

export function setupConfigurations(env: GradleEnv, supplied?: ConfigurationDependencies): ConfigurationDependencies {
    return {
        ...supplied,
        cacheConfig: new CacheConfig(env),
        buildScanConfig: new BuildScanConfig(env),
        wrapperValidationConfig: new WrapperValidationConfig(env),
        summaryConfig: new SummaryConfig(env),
        dependencyGraphConfig: new DependencyGraphConfig(env),
        gradleExecutionConfig: new GradleExecutionConfig(env)
    }
}
