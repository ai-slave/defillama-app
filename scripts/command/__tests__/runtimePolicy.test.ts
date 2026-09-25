import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { findRuntimePolicyViolations } from '../runtimePolicy'

const TRACKED_LAUNCHER_FILES = [
	'package.json',
	'Dockerfile',
	'scripts/build.sh',
	'scripts/buildMetadata.sh',
	'scripts/docker-entrypoint.sh',
	'scripts/prestart.sh'
]

describe('runtime policy', () => {
	test('detects forbidden runtime invocations', () => {
		expect(
			findRuntimePolicyViolations([
				{ content: 'bun --bun next dev', filePath: 'package.json' },
				{ content: 'bun server.js', filePath: 'Dockerfile' },
				{ content: 'next start', filePath: 'standalone.sh' },
				{ content: '"start": "next start"', filePath: 'package.json' },
				{ content: 'wrangler deploy && next start', filePath: 'scripts/deploy-cloudflare.sh' },
				{ content: 'next dev', filePath: 'safe.json' }
			])
		).toEqual([
			{
				filePath: 'standalone.sh',
				message: expect.stringContaining('standalone server.js'),
				patternId: 'next-start-standalone-runtime'
			}
		])
	})

	test('contains no forbidden runtime invocations in tracked launcher files', async () => {
		const files = await Promise.all(
			TRACKED_LAUNCHER_FILES.map(async (filePath) => ({
				content: await fs.readFile(path.join(process.cwd(), filePath), 'utf8'),
				filePath
			}))
		)

		expect(findRuntimePolicyViolations(files)).toEqual([])
	})
})
