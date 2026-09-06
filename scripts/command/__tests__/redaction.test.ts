import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createTeeLogger, createRedactedConsoleLogger } from '../logger'
import { createSecretRedactor } from '../redaction'
import { testEnv } from './testEnv'

const tempDirs: Array<string> = []

afterEach(async () => {
	vi.restoreAllMocks()
	await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { force: true, recursive: true })))
})

describe('secret redaction', () => {
	test('redacts secret-like env values but leaves non-secret values visible', () => {
		const redactor = createSecretRedactor(
			testEnv({
				API_KEY: 'secret-api-key',
				BRANCH_NAME: 'main'
			})
		)

		expect(redactor('url=https://pro-api.llama.fi/secret-api-key/api branch=main')).toBe(
			'url=https://pro-api.llama.fi/[REDACTED]/api branch=main'
		)
	})

	test('ignores inherited env values while collecting secrets', () => {
		const env = Object.create({ API_KEY: 'inherited-secret' }) as NodeJS.ProcessEnv
		env.LOGGER_API_KEY = 'own-secret'
		const redactor = createSecretRedactor(env)

		expect(redactor('own-secret inherited-secret')).toBe('[REDACTED] inherited-secret')
	})

	test('redacts raw and encoded connection strings', () => {
		const redisUrl = 'redis://cache-user:cache-password@cache.internal:6379'
		const databaseUrl = 'postgres://db-user:db-password@db.internal/app'
		const redactor = createSecretRedactor(testEnv({ LLAMA_DB_URL: databaseUrl, REDIS_URL: redisUrl }))

		expect(redactor(`redis=${redisUrl} encoded=${encodeURIComponent(databaseUrl)}`)).toBe(
			'redis=[REDACTED] encoded=[REDACTED]'
		)
	})

	test('redacts multiline secret values one output line at a time', () => {
		const redactor = createSecretRedactor(
			testEnv({ PRIVATE_KEY: 'private-key-header\nprivate-key-body\nprivate-key-footer' })
		)

		expect(redactor('key=private-key-body\n')).toBe('key=[REDACTED]\n')
	})

	test('redacts terminal and file output from the tee logger', async () => {
		const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'redaction-test-'))
		tempDirs.push(projectDir)
		const output: Array<string> = []
		const stream = {
			write: vi.fn((chunk: string) => {
				output.push(chunk)
				return true
			})
		} as unknown as NodeJS.WriteStream
		const logger = createTeeLogger({
			logPath: path.join(projectDir, 'build.log'),
			redactor: createSecretRedactor(testEnv({ LOGGER_API_KEY: 'super-secret-key' })),
			stderr: stream,
			stdout: stream
		})

		logger.log('parent super-secret-key')
		logger.stdout('child super-secret-key')
		logger.stderr(Buffer.from('error super-secret-key'))
		logger.close()

		const buildLog = await fs.readFile(path.join(projectDir, 'build.log'), 'utf8')
		expect(output.join('')).toBe('parent [REDACTED]\nchild [REDACTED]error [REDACTED]')
		expect(buildLog).toBe('parent [REDACTED]\nchild [REDACTED]error [REDACTED]')
	})

	test('redacts secrets split across child output chunks', async () => {
		const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'redaction-chunk-test-'))
		tempDirs.push(projectDir)
		const output: Array<string> = []
		const stream = {
			write: vi.fn((chunk: string) => {
				output.push(chunk)
				return true
			})
		} as unknown as NodeJS.WriteStream
		const logPath = path.join(projectDir, 'build.log')
		const logger = createTeeLogger({
			logPath,
			redactor: createSecretRedactor(testEnv({ LOGGER_API_KEY: 'super-secret-key' })),
			stdout: stream
		})

		logger.stdout('child super-')
		logger.stdout('secret-key\n')
		logger.close()

		expect(output.join('')).toBe('child [REDACTED]\n')
		expect(await fs.readFile(logPath, 'utf8')).toBe('child [REDACTED]\n')
	})

	test('preserves arrival order across partial stdout and stderr lines', async () => {
		const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'redaction-order-test-'))
		tempDirs.push(projectDir)
		const output: Array<string> = []
		const stream = {
			write: vi.fn((chunk: string) => {
				output.push(chunk)
				return true
			})
		} as unknown as NodeJS.WriteStream
		const logger = createTeeLogger({
			logPath: path.join(projectDir, 'build.log'),
			stderr: stream,
			stdout: stream
		})

		logger.stderr('first')
		logger.stdout('second\n')
		logger.stderr(' line\n')
		logger.close()

		expect(output.join('')).toBe('firstsecond\n line\n')
	})

	test('truncates oversized unterminated child output and resumes at the next line', async () => {
		const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'redaction-large-line-test-'))
		tempDirs.push(projectDir)
		const output: Array<string> = []
		const stream = {
			write: vi.fn((chunk: string) => {
				output.push(chunk)
				return true
			})
		} as unknown as NodeJS.WriteStream
		const logger = createTeeLogger({
			logPath: path.join(projectDir, 'build.log'),
			stderr: stream,
			stdout: stream
		})

		logger.stdout('a'.repeat(64 * 1024 + 1))
		logger.stdout('discarded')
		logger.stdout('\nvisible\n')
		logger.close()

		expect(output.join('')).toBe('[output truncated: unterminated line exceeded 64 KiB]\nvisible\n')
	})

	test('closes after a buffered terminal write fails', async () => {
		const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'logger-close-test-'))
		tempDirs.push(projectDir)
		const stream = {
			write: vi.fn(() => {
				throw new Error('terminal write failed')
			})
		} as unknown as NodeJS.WriteStream
		const logger = createTeeLogger({
			logPath: path.join(projectDir, 'build.log'),
			stdout: stream
		})

		logger.stdout('buffered output')

		expect(() => logger.close()).toThrow('terminal write failed')
		expect(() => logger.close()).not.toThrow()
	})

	test('delegates ephemeral build secret injection to the deployment platform', async () => {
		const dockerfile = await fs.readFile(path.join(process.cwd(), 'Dockerfile'), 'utf8')
		const secretInstruction =
			/^\s*(?:ARG|ENV)\s+\w*(?:API_KEY|TOKEN|SECRET|PASSWORD|AUTH|WEBHOOK|PRIVATE_KEY|ACCESS_KEY|CREDENTIAL|COOKIE|DATABASE_URL|DB_URL|POSTGRES_URL|REDIS_URL|CONNECTION_STRING)\w*/im

		expect(dockerfile).not.toMatch(secretInstruction)
		expect(dockerfile).not.toContain('dotenvx')
		expect(dockerfile).not.toContain('node_modules/@next/env')
		expect(dockerfile).toContain('# syntax=docker/dockerfile:1.10')
		expect(dockerfile).toContain('RUN bash ./scripts/build.sh')
	})

	test('adds context to build log open failures', async () => {
		const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'logger-open-test-'))
		tempDirs.push(projectDir)
		const logPath = path.join(projectDir, 'build.log')
		await fs.mkdir(logPath)

		expect(() => createTeeLogger({ logPath })).toThrow(`Failed to open build log for ${logPath}:`)
	})

	test('redacts notification logger output after build log capture closes', () => {
		const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
		const logger = createRedactedConsoleLogger(testEnv({ BUILD_STATUS_WEBHOOK: 'https://discord.example/secret' }))

		logger.log('failed to post', 'https://discord.example/secret')

		expect(consoleLog).toHaveBeenCalledWith('failed to post', '[REDACTED]')
	})

	test('keeps error stacks while redacting notification logger output', () => {
		const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
		const logger = createRedactedConsoleLogger(testEnv({ LOGGER_API_KEY: 'super-secret-key' }))
		const error = new Error('upload failed')
		error.stack = 'Error: upload failed\n    at upload(super-secret-key)'

		logger.log('Build log upload error', error)

		expect(consoleLog).toHaveBeenCalledWith('Build log upload error', 'Error: upload failed\n    at upload([REDACTED])')
	})
})
