import * as core from '@actions/core'
import * as exec from '@actions/exec'
import fs from 'fs'
import path from 'path'
import {GradleProvisioner} from '../execution/provision'
import {GradleEnv} from '../env/env'

export class CacheCleaner {
    private readonly env: GradleEnv
    private readonly gradleProvisioner: GradleProvisioner

    constructor(env: GradleEnv, gradleProvisioner: GradleProvisioner) {
        this.env = env
        this.gradleProvisioner = gradleProvisioner
    }

    async prepare(): Promise<string> {
        // Save the current timestamp
        const timestamp = Date.now().toString()
        this.env.state.set('clean-timestamp', timestamp)
        return timestamp
    }

    async forceCleanup(gradleUserHome: string, tmpDir: string): Promise<void> {
        const cleanTimestamp = this.env.state.get('clean-timestamp')
        await this.forceCleanupFilesOlderThan({gradleUserHome, tmpDir, cleanTimestamp})
    }

    // Visible for testing
    async forceCleanupFilesOlderThan({
        gradleUserHome,
        tmpDir,
        cleanTimestamp
    }: {
        gradleUserHome: string
        tmpDir: string
        cleanTimestamp: string
    }): Promise<void> {
        // Run a dummy Gradle build to trigger cache cleanup
        const cleanupProjectDir = path.resolve(tmpDir, 'dummy-cleanup-project')
        fs.mkdirSync(cleanupProjectDir, {recursive: true})
        fs.writeFileSync(
            path.resolve(cleanupProjectDir, 'settings.gradle'),
            'rootProject.name = "dummy-cleanup-project"'
        )
        fs.writeFileSync(
            path.resolve(cleanupProjectDir, 'init.gradle'),
            `
            beforeSettings { settings ->
                def cleanupTime = ${cleanTimestamp}
            
                settings.caches {
                    cleanup = Cleanup.ALWAYS
            
                    releasedWrappers.setRemoveUnusedEntriesOlderThan(cleanupTime)
                    snapshotWrappers.setRemoveUnusedEntriesOlderThan(cleanupTime)
                    downloadedResources.setRemoveUnusedEntriesOlderThan(cleanupTime)
                    createdResources.setRemoveUnusedEntriesOlderThan(cleanupTime)
                    buildCache.setRemoveUnusedEntriesOlderThan(cleanupTime)
                }
            }
            `
        )
        fs.writeFileSync(path.resolve(cleanupProjectDir, 'build.gradle'), 'task("noop") {}')

        // TODO: This is ineffective: we should be using the newest version of Gradle that ran a build, or a newer version if it's available on PATH.
        const executable = await this.gradleProvisioner.provisionGradleAtLeast('8.12')

        await core.group('Executing Gradle to clean up caches', async () => {
            this.env.log.info(`Cleaning up caches last used before ${cleanTimestamp}`)
            await this.executeCleanupBuild({gradleUserHome, executable, cleanupProjectDir})
        })
    }

    private async executeCleanupBuild({
        gradleUserHome,
        executable,
        cleanupProjectDir
    }: {
        gradleUserHome: string
        executable: string
        cleanupProjectDir: string
    }): Promise<void> {
        const args = [
            '-g',
            gradleUserHome,
            '-I',
            'init.gradle',
            '--info',
            '--no-daemon',
            '--no-scan',
            '--build-cache',
            '-DGITHUB_DEPENDENCY_GRAPH_ENABLED=false',
            'noop'
        ]

        await exec.exec(executable, args, {
            cwd: cleanupProjectDir
        })
    }
}
