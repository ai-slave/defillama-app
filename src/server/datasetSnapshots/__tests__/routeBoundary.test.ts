import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])
const SNAPSHOT_ACQUISITION = '~/server/datasetSnapshots/refresh.server'

async function collectSourceFiles(rootDir: string): Promise<Array<string>> {
	const entries = await fs.readdir(rootDir, { withFileTypes: true })
	const files: Array<string> = []
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
	return /^src\/containers\/[^/]+\/server\/dataset(?:\.risk)?\.server\.(ts|tsx)$/.test(relativePath(filePath))
}

describe('dataset snapshot reader boundary', () => {
	test('acquires snapshots only in typed domain dataset modules', async () => {
		const files = (await collectSourceFiles('src/containers')).filter((filePath) => !isDomainDatasetModule(filePath))
		const sources = await Promise.all(files.map((filePath) => fs.readFile(filePath, 'utf8')))
		const errors = files.filter((_, i) => sources[i].includes(SNAPSHOT_ACQUISITION)).map(relativePath)
		expect(errors).toEqual([])
	})
})
