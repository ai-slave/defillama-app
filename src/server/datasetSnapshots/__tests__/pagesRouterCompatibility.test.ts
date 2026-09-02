import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The App Router `server-only` marker is blocked repo-wide by
// eslint/no-restricted-imports in .oxlintrc.json.
describe('dataset snapshot Pages Router compatibility', () => {
	it('does not change React package resolution for Bun preparation commands', async () => {
		const commandFiles = [
			'package.json',
			'scripts/build.sh',
			'scripts/buildMetadata.sh',
			'scripts/command/runPreparedNext.mjs'
		]
		const invalid = []
		for (const filePath of commandFiles) {
			if ((await fs.readFile(filePath, 'utf8')).includes('conditions=react-server')) invalid.push(filePath)
		}
		expect(invalid).toEqual([])
	})

	it('loads the Yields builder with ordinary React resolution', () => {
		const result = spawnSync(
			'bun',
			['-e', "await import('./src/containers/Yields/server/dataset.builder.server.ts')"],
			{ cwd: process.cwd(), encoding: 'utf8' }
		)
		expect(result.stderr).toBe('')
		expect(result.status).toBe(0)
	})
})
