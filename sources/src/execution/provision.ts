import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as httpm from '@actions/http-client'
import * as core from '@actions/core'
import * as cache from '@actions/cache'
import * as toolCache from '@actions/tool-cache'

import {GradleExecutableExecutor, versionIsAtLeast} from './gradle'
import * as gradlew from './gradlew'
import {handleCacheFailure} from '../caching/cache-utils'
import {CacheConfig} from '../env/configuration'
import {GradleEnv} from '../env/env'

const gradleVersionsBaseUrl = 'https://services.gradle.org/versions'

export class GradleProvisioner {
    private readonly env: GradleEnv
    private readonly gradleExecutor: GradleExecutableExecutor
    private readonly cacheConfig: CacheConfig

    constructor(env: GradleEnv, gradleExecutor: GradleExecutableExecutor, cacheConfig: CacheConfig) {
        this.env = env
        this.gradleExecutor = gradleExecutor
        this.cacheConfig = cacheConfig
    }

    /**
     * Install any configured version of Gradle, adding the executable to the PATH.
     * @return Installed Gradle executable or undefined if no version configured.
     */
    async provisionGradle(gradleVersion: string): Promise<string | undefined> {
        if (gradleVersion !== '' && gradleVersion !== 'wrapper') {
            return this.addToPath(await this.installGradle(gradleVersion))
        }

        return undefined
    }

    /**
     * Ensure that the Gradle version on PATH is no older than the specified version.
     * If the version on PATH is older, install the specified version and add it to the PATH.
     * @return Installed Gradle executable or undefined if no version configured.
     */
    async provisionGradleAtLeast(gradleVersion: string): Promise<string> {
        const installedVersion = await this.installGradleVersionAtLeast(await this.gradleRelease(gradleVersion))
        return this.addToPath(installedVersion)
    }

    private async addToPath(executable: string): Promise<string> {
        core.addPath(path.dirname(executable))
        return executable
    }

    private async installGradle(version: string): Promise<string> {
        const versionInfo = await this.resolveGradleVersion(version)
        core.setOutput('gradle-version', versionInfo.version)
        return this.installGradleVersion(versionInfo)
    }

    private async resolveGradleVersion(version: string): Promise<GradleVersionInfo> {
        switch (version) {
            case 'current':
                return this.gradleCurrent()
            case 'rc':
                core.warning(`Specifying gradle-version 'rc' has been deprecated. Use 'release-candidate' instead.`)
                return this.gradleReleaseCandidate()
            case 'release-candidate':
                return this.gradleReleaseCandidate()
            case 'nightly':
                return this.gradleNightly()
            case 'release-nightly':
                return this.gradleReleaseNightly()
            default:
                return this.gradleRelease(version)
        }
    }

    private async gradleCurrent(): Promise<GradleVersionInfo> {
        return await this.gradleVersionDeclaration(`${gradleVersionsBaseUrl}/current`)
    }

    private async gradleReleaseCandidate(): Promise<GradleVersionInfo> {
        const versionInfo = await this.gradleVersionDeclaration(`${gradleVersionsBaseUrl}/release-candidate`)
        if (versionInfo && versionInfo.version && versionInfo.downloadUrl) {
            return versionInfo
        }
        core.info('No current release-candidate found, will fallback to current')
        return this.gradleCurrent()
    }

    private async gradleNightly(): Promise<GradleVersionInfo> {
        return await this.gradleVersionDeclaration(`${gradleVersionsBaseUrl}/nightly`)
    }

    private async gradleReleaseNightly(): Promise<GradleVersionInfo> {
        return await this.gradleVersionDeclaration(`${gradleVersionsBaseUrl}/release-nightly`)
    }

    private async gradleRelease(version: string): Promise<GradleVersionInfo> {
        const versionInfo = await this.findGradleVersionDeclaration(version)
        if (!versionInfo) {
            throw new Error(`Gradle version ${version} does not exists`)
        }
        return versionInfo
    }

    private async gradleVersionDeclaration(url: string): Promise<GradleVersionInfo> {
        return await httpGetGradleVersion(url)
    }

    private async findGradleVersionDeclaration(version: string): Promise<GradleVersionInfo | undefined> {
        const gradleVersions = await httpGetGradleVersions(`${gradleVersionsBaseUrl}/all`)
        return gradleVersions.find((entry: GradleVersionInfo) => {
            return entry.version === version
        })
    }

    private async installGradleVersion(versionInfo: GradleVersionInfo): Promise<string> {
        return core.group(`Provision Gradle ${versionInfo.version}`, async () => {
            const gradleOnPath = await this.gradleExecutor.findGradleVersionOnPath()
            if (gradleOnPath?.version === versionInfo.version) {
                core.info(`Gradle version ${versionInfo.version} is already available on PATH. Not installing.`)
                return gradleOnPath.executable
            }

            return this.locateGradleAndDownloadIfRequired(versionInfo)
        })
    }

    private async installGradleVersionAtLeast(versionInfo: GradleVersionInfo): Promise<string> {
        return core.group(`Provision Gradle >= ${versionInfo.version}`, async () => {
            const gradleOnPath = await this.gradleExecutor.findGradleVersionOnPath()
            if (gradleOnPath && versionIsAtLeast(gradleOnPath.version, versionInfo.version)) {
                core.info(
                    `Gradle version ${gradleOnPath.version} is available on PATH and >= ${versionInfo.version}. Not installing.`
                )
                return gradleOnPath.executable
            }

            return this.locateGradleAndDownloadIfRequired(versionInfo)
        })
    }

    private async locateGradleAndDownloadIfRequired(versionInfo: GradleVersionInfo): Promise<string> {
        const installsDir = path.join(getProvisionDir(), 'installs')
        const installDir = path.join(installsDir, `gradle-${versionInfo.version}`)
        if (fs.existsSync(installDir)) {
            core.info(`Gradle installation already exists at ${installDir}`)
            return executableFrom(installDir)
        }

        const downloadPath = await this.downloadAndCacheGradleDistribution(versionInfo)
        await toolCache.extractZip(downloadPath, installsDir)
        core.info(`Extracted Gradle ${versionInfo.version} to ${installDir}`)

        const executable = executableFrom(installDir)
        fs.chmodSync(executable, '755')
        core.info(`Provisioned Gradle executable ${executable}`)

        return executable
    }

    private async downloadAndCacheGradleDistribution(versionInfo: GradleVersionInfo): Promise<string> {
        const downloadPath = path.join(getProvisionDir(), `downloads/gradle-${versionInfo.version}-bin.zip`)

        // TODO: Convert this to a class and inject config
        if (this.cacheConfig.isCacheDisabled()) {
            await this.downloadGradleDistribution(versionInfo, downloadPath)
            return downloadPath
        }

        const cacheKey = `gradle-${versionInfo.version}`
        try {
            const restoreKey = await cache.restoreCache([downloadPath], cacheKey)
            if (restoreKey) {
                core.info(`Restored Gradle distribution ${cacheKey} from cache to ${downloadPath}`)
                return downloadPath
            }
        } catch (error) {
            handleCacheFailure(this.env, error, `Restore Gradle distribution ${versionInfo.version} failed`)
        }

        core.info(`Gradle distribution ${versionInfo.version} not found in cache. Will download.`)
        await this.downloadGradleDistribution(versionInfo, downloadPath)

        if (!this.cacheConfig.isCacheReadOnly()) {
            try {
                await cache.saveCache([downloadPath], cacheKey)
            } catch (error) {
                handleCacheFailure(this.env, error, `Save Gradle distribution ${versionInfo.version} failed`)
            }
        }
        return downloadPath
    }

    private async downloadGradleDistribution(versionInfo: GradleVersionInfo, downloadPath: string): Promise<void> {
        await toolCache.downloadTool(versionInfo.downloadUrl, downloadPath)
        core.info(`Downloaded ${versionInfo.downloadUrl} to ${downloadPath} (size ${fs.statSync(downloadPath).size})`)
    }
}

function getProvisionDir(): string {
    const tmpDir = process.env['RUNNER_TEMP'] ?? os.tmpdir()
    return path.join(tmpDir, `.gradle-actions/gradle-installations`)
}

function executableFrom(installDir: string): string {
    return path.join(installDir, 'bin', `${gradlew.installScriptFilename()}`)
}

async function httpGetGradleVersion(url: string): Promise<GradleVersionInfo> {
    return JSON.parse(await httpGetString(url))
}

async function httpGetGradleVersions(url: string): Promise<GradleVersionInfo[]> {
    return JSON.parse(await httpGetString(url))
}

async function httpGetString(url: string): Promise<string> {
    const httpClient = new httpm.HttpClient('gradle/actions')
    const response = await httpClient.get(url)
    return response.readBody()
}

interface GradleVersionInfo {
    version: string
    downloadUrl: string
}
