import path from 'node:path'
import type { BuildResult } from './buildResult'
import type { CommandLogger } from './logger'
import { runChild, type ActiveChildren, type RunChildResult } from './runChild'

type ArtifactSyncOptions = {
	activeChildren?: ActiveChildren
	env?: NodeJS.ProcessEnv
	logger: Pick<CommandLogger, 'log' | 'stderr' | 'stdout'>
	projectDir?: string
	result: BuildResult
	runCommand?: typeof runChild
}

type ArtifactSyncResult =
	| { status: 'failed'; step: 'upload'; result: RunChildResult }
	| { status: 'skipped'; reason: string }
	| { status: 'success' }

const ARTIFACT_REMOTE_ENV_KEYS = [
	'RCLONE_CONFIG_ARTIFACTS_ACCESS_KEY_ID',
	'RCLONE_CONFIG_ARTIFACTS_SECRET_ACCESS_KEY',
	'RCLONE_CONFIG_ARTIFACTS_ENDPOINT'
] as const

function getMissingArtifactRemoteEnv(env: NodeJS.ProcessEnv): Array<string> {
	const missing: Array<string> = []
	for (const key of ARTIFACT_REMOTE_ENV_KEYS) {
		if (!env[key]?.trim()) missing.push(key)
	}
	return missing
}

export async function syncBuildArtifacts({
	activeChildren,
	env = process.env,
	logger,
	projectDir = process.cwd(),
	result,
	runCommand = runChild
}: ArtifactSyncOptions): Promise<ArtifactSyncResult> {
	if (env.SKIP_ARTIFACT_SYNC === '1') {
		logger.log('SKIP_ARTIFACT_SYNC=1, skipping artifact upload')
		return { reason: 'skip flag', status: 'skipped' }
	}
	if (result.exitCode !== 0) {
		logger.log('Build failed, skipping .next artifact sync')
		return { reason: 'build failed', status: 'skipped' }
	}
	const missingArtifactRemoteEnv = getMissingArtifactRemoteEnv(env)
	if (missingArtifactRemoteEnv.length > 0) {
		logger.log(
			`Artifact remote is not configured; missing ${missingArtifactRemoteEnv.join(', ')}, skipping artifact upload`
		)
		return { reason: 'missing rclone env', status: 'skipped' }
	}

	const configPath = path.join('scripts', 'rclone.conf')
	const staticPath = path.join('.', '.next', 'static')
	const remotePath = 'artifacts:defillama-app-artifacts'
	const upload = await runCommand('rclone', ['--config', configPath, 'copy', staticPath, remotePath], {
		activeChildren,
		cwd: projectDir,
		env,
		logger
	})
	if (upload.exitCode !== 0) {
		logger.log('rclone artifact upload failed')
		return { result: upload, status: 'failed', step: 'upload' }
	}

	return { status: 'success' }
}
