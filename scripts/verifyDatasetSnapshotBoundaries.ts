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

async function main(): Promise<void> {
	const projectDir = process.cwd()
	const browserDir = path.join(projectDir, '.next', 'static')
	if (!(await pathExists(browserDir))) throw new Error('Expected .next/static; run this guard after next build')

	const leaks: Array<string> = []
	// Stream the tree and read one bundle at a time to bound memory use on large builds.
	for await (const entry of await fs.opendir(browserDir, { recursive: true })) {
		if (entry.isDirectory()) continue
		const filePath = path.join(entry.parentPath, entry.name)
		if (!TEXT_BUNDLE_EXTENSIONS.has(path.extname(filePath))) continue
		const source = await fs.readFile(filePath, 'utf8').catch(() => '')
		if (FORBIDDEN_BROWSER_MARKERS.some((marker) => source.includes(marker))) {
			leaks.push(path.relative(projectDir, filePath))
		}
	}
	if (leaks.length > 0) throw new Error(`Dataset snapshot server code found in browser output:\n${leaks.join('\n')}`)

	// Vercel builds skip standalone output; the copy check only applies when the build produced it.
	const sourceSnapshots = path.join(projectDir, '.cache', 'dataset-snapshots')
	const standaloneDir = path.join(projectDir, '.next', 'standalone')
	const standaloneSnapshots = path.join(standaloneDir, '.cache', 'dataset-snapshots')
	if (
		(await pathExists(sourceSnapshots)) &&
		(await pathExists(standaloneDir)) &&
		!(await pathExists(standaloneSnapshots))
	) {
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
