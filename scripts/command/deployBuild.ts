import path from 'node:path'
import { flushTelemetry, recordDomainEvent } from '~/utils/telemetry'
import { syncBuildArtifacts } from './artifactSync'
import { detectBranchName } from './branch'
import { commitShaFromEnv, createBuildCommitEnv } from './buildIdentity'
import { sendBuildNotification } from './buildNotification'
import { createBuildResult, findNextBuildId, formatBuildResultSummary, type BuildResult } from './buildResult'
import type { CommandLogger } from './logger'
import { createRedactedConsoleLogger, createTeeLogger } from './logger'
import { runPreparationCommand } from './prepare'
import { createSecretRedactor } from './redaction'
import { runChild, type ActiveChildren, type RunChildResult } from './runChild'

type DeployBuildOptions = {
	activeChildren?: ActiveChildren
	branchName?: string
	env?: NodeJS.ProcessEnv
	findBuildId?: () => Promise<string>
	logger?: CommandLogger
	logPath?: string
	now?: () => Date
	notify?: (result: BuildResult) => Promise<unknown>
	projectDir?: string
	readGitCommitSha?: (projectDir: string) => string
	runNextBuild?: (logger: CommandLogger) => Promise<RunChildResult>
	runPrepare?: () => Promise<number>
	syncArtifacts?: (result: BuildResult) => Promise<unknown>
}

const REQUIRED_DEPLOY_BUILD_ENV = ['API_KEY'] as const

function getMissingDeployBuildEnv(env: NodeJS.ProcessEnv): string[] {
	const missing: string[] = []
	for (const key of REQUIRED_DEPLOY_BUILD_ENV) {
		if (!env[key]?.trim()) missing.push(key)
	}
	return missing
}

function createDefaultNextBuildRunner({
	activeChildren,
	env,
	projectDir
}: {
	activeChildren?: ActiveChildren
	env: NodeJS.ProcessEnv
	projectDir: string
}): (logger: CommandLogger) => Promise<RunChildResult> {
	return (logger) =>
		runChild(
			path.join(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next'),
			['build'],
			{
				activeChildren,
				cwd: projectDir,
				env,
				logger
			}
		)
}

function formatNextBuildFailure(result: RunChildResult): string {
	if (result.signal) {
		return `Next.js build failed after signal ${result.signal}`
	}
	return `Next.js build failed with exit code ${result.exitCode ?? 1}`
}

function finishedAtFromBuildResult(result: BuildResult): string {
	return new Date(Date.parse(result.startedAt) + result.durationMs).toISOString()
}

async function recordBuildCompleteTelemetry(result: BuildResult, env: NodeJS.ProcessEnv): Promise<void> {
	const branch = result.branchName || 'unknown'
	const level = result.status === 'success' ? 'info' : 'warn'
	recordDomainEvent(
		'build.complete',
		level,
		branch,
		`Build ${result.status === 'success' ? 'completed' : 'failed'} on ${branch}`,
		{
			branch,
			build_id: result.buildId,
			commit_sha: commitShaFromEnv(env),
			duration_ms: result.durationMs,
			exit_code: result.exitCode,
			finished_at: finishedAtFromBuildResult(result),
			started_at: result.startedAt,
			status: result.status
		}
	)
	await flushTelemetry({ runtime: 'build', timeoutMs: 2000 })
}

export async function runDeployBuild({
	activeChildren,
	branchName,
	env = process.env,
	findBuildId,
	logger,
	logPath,
	now = () => new Date(),
	notify,
	projectDir = process.cwd(),
	readGitCommitSha,
	runNextBuild,
	runPrepare,
	syncArtifacts
}: DeployBuildOptions = {}): Promise<BuildResult> {
	const buildLogPath = logPath ?? path.join(projectDir, 'build.log')
	const buildEnv = createBuildCommitEnv({ env, projectDir, readGitCommitSha })
	const buildLogger = logger ?? createTeeLogger({ logPath: buildLogPath, redactor: createSecretRedactor(buildEnv) })
	const startedAt = now()
	const resolvedBranchName = branchName ?? detectBranchName(buildEnv)
	const commitSha = commitShaFromEnv(buildEnv)

	buildLogger.log('')
	buildLogger.log('=======================')
	buildLogger.log('New build started')
	if (resolvedBranchName) buildLogger.log(`Branch: ${resolvedBranchName}`)
	if (commitSha) {
		buildLogger.log(`Commit: ${commitSha}`)
	} else {
		buildLogger.log('Commit: unavailable; Next.js will generate a random build ID')
	}
	buildLogger.log('=======================')
	buildLogger.log('')

	const missingBuildEnv = getMissingDeployBuildEnv(buildEnv)
	let exitCode = 1
	if (missingBuildEnv.length > 0) {
		buildLogger.log(
			`[build:preflight] Missing required build environment: ${missingBuildEnv.join(', ')}. Configure it as a Coolify build secret.`
		)
		buildLogger.log('Skipping preparation due to failed build environment preflight')
	} else {
		const runPrepareStep =
			runPrepare ??
			(async () => {
				const result = await runPreparationCommand({
					env: buildEnv,
					logger: buildLogger,
					prefix: '[build:prepare]',
					repoRoot: projectDir
				})
				return result.exitCode
			})
		exitCode = await runPrepareStep()
	}

	if (exitCode === 0) {
		buildLogger.log('Next.js build started')
		const runNextBuildStep = runNextBuild ?? createDefaultNextBuildRunner({ activeChildren, env: buildEnv, projectDir })
		const nextResult = await runNextBuildStep(buildLogger)
		exitCode = nextResult.exitCode ?? 1
		if (exitCode === 0 && !nextResult.signal) {
			buildLogger.log('Next.js build finished successfully')
		} else {
			buildLogger.log(formatNextBuildFailure(nextResult))
		}
	} else {
		buildLogger.log('Skipping next build due to earlier failure')
	}

	const finishedAt = now()
	const buildId = await (findBuildId ?? (() => findNextBuildId(projectDir)))().catch((error) => {
		buildLogger.log(`Failed to resolve Next.js build ID: ${error instanceof Error ? error.message : String(error)}`)
		return ''
	})
	const result = createBuildResult({
		branchName: resolvedBranchName,
		buildId,
		exitCode,
		finishedAt,
		logPath: buildLogPath,
		startedAt
	})

	buildLogger.log('')
	buildLogger.log('=======================')
	buildLogger.log(formatBuildResultSummary(result))
	buildLogger.log('=======================')
	buildLogger.log('')

	if (result.exitCode === 0) {
		const syncArtifactsStep =
			syncArtifacts ??
			((buildResult: BuildResult) =>
				syncBuildArtifacts({
					activeChildren,
					env: buildEnv,
					logger: buildLogger,
					projectDir,
					result: buildResult
				}))
		await syncArtifactsStep(result)
	} else {
		buildLogger.log('Build failed, skipping .next artifact sync')
	}
	await recordBuildCompleteTelemetry(result, buildEnv)

	buildLogger.flush()
	buildLogger.close()
	const notificationLogger = createRedactedConsoleLogger(buildEnv)
	try {
		const notifyStep =
			notify ??
			((buildResult: BuildResult) =>
				sendBuildNotification({ env: buildEnv, logger: notificationLogger, result: buildResult }))
		await notifyStep(result)
	} catch (error) {
		notificationLogger.log('Build notification failed:', error)
	}

	return result
}
