import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])
const SNAPSHOT_READER = '~/server/datasetSnapshots/reader.server'

async function collectSourceFiles(rootDir: string): Promise<string[]> {
	const entries = await fs.readdir(rootDir, { withFileTypes: true })
	const files: string[] = []
	for (const entry of entries) {
		const filePath = path.join(rootDir, entry.name)
		if (entry.isDirectory()) {
			if (entry.name !== '__tests__') files.push(...(await collectSourceFiles(filePath)))
		} else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.includes('.test.')) {
			files.push(filePath)
		}
	}
	return files
}

function relativePath(filePath: string): string {
	return path.relative(process.cwd(), filePath).split(path.sep).join('/')
}

function isDomainDatasetModule(filePath: string): boolean {
	return /^src\/containers\/[^/]+\/server\/dataset(?:\.(?:liquidity|risk))?\.server\.(ts|tsx)$/.test(
		relativePath(filePath)
	)
}

describe('dataset snapshot reader boundary', () => {
	it('allows filesystem reads only in typed domain dataset modules', async () => {
		const errors: string[] = []
		for (const filePath of await collectSourceFiles('src/containers')) {
			const source = await fs.readFile(filePath, 'utf8')
			if (source.includes(SNAPSHOT_READER) && !isDomainDatasetModule(filePath)) {
				errors.push(relativePath(filePath))
			}
		}
		expect(errors).toEqual([])
	})
})
