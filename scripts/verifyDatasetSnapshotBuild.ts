import { promises as fs } from 'node:fs'
import path from 'node:path'

/** Post-build guard: snapshots belong to standalone server output, never browser assets. */

const FORBIDDEN_BROWSER_MARKERS = [
	'.cache/dataset-snapshots',
	'DatasetSnapshotRefreshCoordinator',
	'FileDatasetSnapshotStore'
]
const TEXT_BUNDLE_EXTENSIONS = new Set(['.js', '.json', '.map', '.css'])

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}

async function collectFiles(rootDir: string): Promise<string[]> {
	const files: string[] = []
	for (const entry of await fs.readdir(rootDir, { withFileTypes: true })) {
		const filePath = path.join(rootDir, entry.name)
		if (entry.isDirectory()) files.push(...(await collectFiles(filePath)))
		else files.push(filePath)
	}
	return files
}

async function main(): Promise<void> {
	const projectDir = process.cwd()
	const browserDir = path.join(projectDir, '.next', 'static')
	if (!(await pathExists(browserDir))) throw new Error('Expected .next/static; run this guard after next build')

	const leaks: string[] = []
	for (const filePath of await collectFiles(browserDir)) {
		if (!TEXT_BUNDLE_EXTENSIONS.has(path.extname(filePath))) continue
		const source = await fs.readFile(filePath, 'utf8').catch(() => '')
		if (FORBIDDEN_BROWSER_MARKERS.some((marker) => source.includes(marker))) {
			leaks.push(path.relative(projectDir, filePath))
		}
	}
	if (leaks.length > 0) throw new Error(`Dataset snapshot server code found in browser output:\n${leaks.join('\n')}`)

	const sourceSnapshots = path.join(projectDir, '.cache', 'dataset-snapshots')
	const standaloneSnapshots = path.join(projectDir, '.next', 'standalone', '.cache', 'dataset-snapshots')
	if ((await pathExists(sourceSnapshots)) && !(await pathExists(standaloneSnapshots))) {
		throw new Error('Dataset snapshots were not copied into standalone server output')
	}
	if (
		(await pathExists(path.join(projectDir, 'public', '.cache'))) ||
		(await pathExists(path.join(projectDir, 'public', 'dataset-snapshots')))
	) {
		throw new Error('Snapshot artifacts must never be copied under public')
	}

	console.log('[dataset-snapshots] Browser and standalone output boundaries verified')
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
