import { describe, expect, test, vi } from 'vitest'
import { sendBuildNotification } from '../buildNotification'
import type { BuildResult } from '../buildResult'
import { testEnv } from './testEnv'

const failedBuild: BuildResult = {
	branchName: 'main',
	buildId: 'id',
	durationMs: 1000,
	exitCode: 1,
	logPath: 'build.log',
	startedAt: '2026-01-01T00:00:00.000Z',
	status: 'failure'
}

const skippedUpload = { reason: 'build failed', status: 'skipped' } as const

describe('build notification adapter', () => {
	test('skips when requested by env', async () => {
		const fetchImpl = vi.fn()

		const result = await sendBuildNotification({
			artifactSync: skippedUpload,
			env: testEnv({ SKIP_BUILD_NOTIFY: '1' }),
			fetchImpl,
			logger: { log: vi.fn() },
			result: failedBuild
		})

		expect(result).toEqual({ reason: 'skip flag', status: 'skipped' })
		expect(fetchImpl).not.toHaveBeenCalled()
	})

	test('posts summary, build log URL, and failure mentions', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response('', { status: 200 }))
			.mockResolvedValueOnce(new Response('log-id', { status: 200 }))
			.mockResolvedValueOnce(new Response('', { status: 200 }))
			.mockResolvedValueOnce(new Response('', { status: 200 }))

		const result = await sendBuildNotification({
			artifactSync: skippedUpload,
			env: testEnv({
				BUILD_NOTIFY_USERS: '1,2',
				BUILD_STATUS_WEBHOOK: 'https://discord.example/webhook',
				BUILD_DEPLOYMENT_NAME: 'core-next',
				COOLIFY_URL: 'https://core.example',
				LOGGER_API_URL: 'https://logs.example'
			}),
			fetchImpl,
			logger: { log: vi.fn() },
			readFile: vi.fn().mockResolvedValue('build log'),
			result: failedBuild
		})

		expect(result).toEqual({ buildLogUrl: 'https://logs.example/get/log-id', status: 'sent' })
		expect(fetchImpl.mock.calls[0][1]?.body).toContain('Deployment: core-next')
		expect(fetchImpl.mock.calls[0][1]?.body).toContain('URL: https://core.example')
		expect(JSON.parse(fetchImpl.mock.calls[2][1]?.body).content).toBe('https://logs.example/get/log-id')
		expect(JSON.parse(fetchImpl.mock.calls[3][1]?.body).content).toBe('<@1> <@2>')
	})

	test('uses Coolify identifiers when no custom deployment name is set', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 200 }))

		await sendBuildNotification({
			artifactSync: skippedUpload,
			env: testEnv({
				BUILD_STATUS_WEBHOOK: 'https://discord.example/webhook',
				COOLIFY_CONTAINER_NAME: 'defillama-app-core'
			}),
			fetchImpl,
			logger: { log: vi.fn() },
			result: failedBuild
		})

		expect(fetchImpl.mock.calls[0][1]?.body).toContain('Deployment: defillama-app-core')
	})

	test('keeps notification successful when build-log upload fails', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response('', { status: 200 }))
			.mockResolvedValueOnce(new Response('bad', { status: 500 }))
			.mockResolvedValueOnce(new Response('', { status: 200 }))

		const result = await sendBuildNotification({
			artifactSync: skippedUpload,
			env: testEnv({
				BUILD_NOTIFY_USERS: '1',
				BUILD_STATUS_WEBHOOK: 'https://discord.example/webhook',
				LOGGER_API_URL: 'https://logs.example'
			}),
			fetchImpl,
			logger: { log: vi.fn() },
			readFile: vi.fn().mockResolvedValue('build log'),
			result: failedBuild
		})

		expect(result).toEqual({ buildLogUrl: '', status: 'sent' })
		expect(fetchImpl).toHaveBeenCalledTimes(3)
	})

	test('warns and mentions users when the R2 upload fails after a successful build', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 200 }))

		await sendBuildNotification({
			artifactSync: { result: { exitCode: 1, signal: null, stdoutTail: '' }, status: 'failed', step: 'upload' },
			env: testEnv({ BUILD_NOTIFY_USERS: '1', BUILD_STATUS_WEBHOOK: 'https://discord.example/webhook' }),
			fetchImpl,
			logger: { log: vi.fn() },
			result: { ...failedBuild, exitCode: 0, status: 'success' }
		})

		expect(fetchImpl).toHaveBeenCalledTimes(2)
		expect(fetchImpl.mock.calls[0][1]?.body).toContain('R2 static upload failed')
		expect(JSON.parse(fetchImpl.mock.calls[1][1]?.body).content).toBe('<@1>')
	})

	test('keeps a successful build quiet when the R2 upload succeeds', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 200 }))

		await sendBuildNotification({
			artifactSync: { status: 'success' },
			env: testEnv({ BUILD_NOTIFY_USERS: '1', BUILD_STATUS_WEBHOOK: 'https://discord.example/webhook' }),
			fetchImpl,
			logger: { log: vi.fn() },
			result: { ...failedBuild, exitCode: 0, status: 'success' }
		})

		expect(fetchImpl).toHaveBeenCalledOnce()
		expect(fetchImpl.mock.calls[0][1]?.body).not.toContain('R2 static upload failed')
	})

	test('keeps notification successful when webhook posting throws', async () => {
		const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('network down'))

		const result = await sendBuildNotification({
			artifactSync: skippedUpload,
			env: testEnv({ BUILD_STATUS_WEBHOOK: 'https://discord.example/webhook' }),
			fetchImpl,
			logger: { log: vi.fn() },
			result: failedBuild
		})

		expect(result).toEqual({ buildLogUrl: '', status: 'sent' })
		expect(fetchImpl).toHaveBeenCalledTimes(1)
	})
})
