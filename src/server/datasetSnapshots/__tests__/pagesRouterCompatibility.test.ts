import { spawnSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

// The App Router `server-only` marker is blocked repo-wide by
// eslint/no-restricted-imports in .oxlintrc.json.
describe('dataset snapshot Pages Router compatibility', () => {
	test('loads the Yields builder with ordinary React resolution', () => {
		const result = spawnSync(
			'bun',
			['-e', "await import('./src/containers/Yields/server/dataset.builder.server.ts')"],
			{ cwd: process.cwd(), encoding: 'utf8' }
		)
		expect(result.stderr).toBe('')
		expect(result.status).toBe(0)
	})
})
