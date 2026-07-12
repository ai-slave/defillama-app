import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

async function collectSourceFiles(rootDir: string): Promise<string[]> {
	const files: string[] = []
	for (const entry of await fs.readdir(rootDir, { withFileTypes: true })) {
		const filePath = path.join(rootDir, entry.name)
		if (entry.isDirectory()) files.push(...(await collectSourceFiles(filePath)))
		else if (/\.[jt]sx?$/.test(entry.name)) files.push(filePath)
	}
	return files
}

describe('dataset snapshot Pages Router compatibility', () => {
	it('does not use the App Router server-only marker', async () => {
		const invalid = []

		for (const filePath of await collectSourceFiles('src')) {
			const source = await fs.readFile(filePath, 'utf8')
			if (/import\s+['"]server-only['"]/.test(source)) invalid.push(filePath)
		}

		expect(invalid).toEqual([])
	})

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
			['-e', "await import('./src/containers/Yields/server/snapshot.builder.server.ts')"],
			{ cwd: process.cwd(), encoding: 'utf8' }
		)
		expect(result.stderr).toBe('')
		expect(result.status).toBe(0)
	})
})
