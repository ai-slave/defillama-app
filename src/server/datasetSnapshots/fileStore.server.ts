import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
	DATASET_SNAPSHOT_CONTRACT,
	createDatasetSnapshotManifest,
	createDatasetSnapshotPointer,
	parseDatasetSnapshotManifest,
	parseDatasetSnapshotPointer,
	type DatasetSnapshotDomain,
	type DatasetSnapshotRef
} from './contract'
import { DatasetSnapshotIntegrityError, isDatasetSnapshotCompatibilityError } from './errors'
import { readJsonFileOnce, writeJsonFileAtomically } from './fileIo.server'
import {
	getDatasetSnapshotCurrentPath,
	getDatasetSnapshotDomainRoot,
	getDatasetSnapshotRoot,
	getDatasetSnapshotVersionDir,
	getDatasetSnapshotVersionsDir
} from './filePaths.server'
import type {
	DatasetSnapshotBuilder,
	DatasetSnapshotHandle,
	DatasetSnapshotStore,
	DatasetSnapshotStoreStats,
	DatasetSnapshotWriter
} from './store'

/**
 * Durable local-disk snapshot store.
 *
 * Versions are immutable and survive process restarts. Publication renames a
 * validated candidate into `versions/` and atomically replaces `current.json`.
 * A failed build or validation never changes the current pointer. This is not
 * an ISR cache, HTTP response cache, or process-local result cache.
 */

const MANIFEST_FILE = 'manifest.json'

function isMissingFile(error: unknown): boolean {
	return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function resolveArtifactPath(baseDir: string, relativePath: string): string {
	const targetPath = path.resolve(baseDir, relativePath)
	const relativeTargetPath = path.relative(baseDir, targetPath)
	if (!relativePath || relativeTargetPath.startsWith('..') || path.isAbsolute(relativeTargetPath)) {
		throw new Error(`Dataset snapshot path escapes its version: ${relativePath}`)
	}
	return targetPath
}

async function validateOptionalShardDirectory(directory: string): Promise<void> {
	let entries
	try {
		entries = await fs.readdir(directory, { recursive: true, withFileTypes: true })
	} catch (error) {
		if (isMissingFile(error)) return
		throw error
	}

	for (const entry of entries) {
		if (!entry.isFile()) continue
		if (!entry.name.endsWith('.json')) {
			throw new Error(`Dataset snapshot shard is not JSON: ${path.join(entry.parentPath, entry.name)}`)
		}
		await readJsonFileOnce(path.join(entry.parentPath, entry.name))
	}
}

async function validateVersionDirectory(
	versionDir: string,
	expectedDomain: DatasetSnapshotDomain,
	expectedSnapshotId: string
): Promise<DatasetSnapshotRef> {
	const manifest = await readVersionManifest(versionDir, expectedDomain, expectedSnapshotId)

	const contract = DATASET_SNAPSHOT_CONTRACT[expectedDomain]
	for (const relativePath of Object.values(contract.files)) {
		await readJsonFileOnce(resolveArtifactPath(versionDir, relativePath))
	}
	if ('optionalShardDirs' in contract) {
		for (const relativePath of Object.values(contract.optionalShardDirs)) {
			await validateOptionalShardDirectory(resolveArtifactPath(versionDir, relativePath))
		}
	}
	return manifest
}

async function readVersionManifest(
	versionDir: string,
	expectedDomain: DatasetSnapshotDomain,
	expectedSnapshotId: string
): Promise<DatasetSnapshotRef> {
	const manifest = parseDatasetSnapshotManifest(await readJsonFileOnce(path.join(versionDir, MANIFEST_FILE)))
	if (manifest.domain !== expectedDomain || manifest.snapshotId !== expectedSnapshotId) {
		throw new Error('Dataset snapshot manifest does not match its storage path')
	}
	return manifest
}

function createFileSnapshotHandle(ref: DatasetSnapshotRef, versionDir: string): DatasetSnapshotHandle {
	const reads = new Map<string, Promise<unknown>>()
	return {
		ref,
		readJson<T>(relativePath: string): Promise<T> {
			let targetPath: string
			try {
				targetPath = resolveArtifactPath(versionDir, relativePath)
			} catch (error) {
				return Promise.reject(error)
			}

			let read = reads.get(targetPath)
			if (!read) {
				read = readJsonFileOnce(targetPath).catch((error) => {
					throw new DatasetSnapshotIntegrityError(ref.domain, relativePath, error)
				})
				reads.set(targetPath, read)
			}
			return read as Promise<T>
		}
	}
}

export class FileDatasetSnapshotStore implements DatasetSnapshotStore {
	private readonly handles = new Map<string, Promise<DatasetSnapshotHandle>>()
	private readonly currentHandleKeys = new Map<DatasetSnapshotDomain, string>()

	constructor(
		private readonly rootDir = getDatasetSnapshotRoot(),
		private readonly now: () => number = Date.now
	) {}

	private open(domain: DatasetSnapshotDomain, snapshotId: string): Promise<DatasetSnapshotHandle> {
		const key = `${domain}:${snapshotId}`
		let handle = this.handles.get(key)
		if (!handle) {
			const versionDir = getDatasetSnapshotVersionDir(this.rootDir, domain, snapshotId)
			handle = readVersionManifest(versionDir, domain, snapshotId)
				.then((ref) => createFileSnapshotHandle(ref, versionDir))
				.catch((error) => {
					throw new DatasetSnapshotIntegrityError(domain, MANIFEST_FILE, error)
				})
			this.handles.set(key, handle)
		}
		return handle
	}

	private openCurrent(domain: DatasetSnapshotDomain, snapshotId: string): Promise<DatasetSnapshotHandle> {
		const key = `${domain}:${snapshotId}`
		const previousKey = this.currentHandleKeys.get(domain)
		if (previousKey && previousKey !== key) this.handles.delete(previousKey)
		this.currentHandleKeys.set(domain, key)
		return this.open(domain, snapshotId)
	}

	async getCurrent(domain: DatasetSnapshotDomain): Promise<DatasetSnapshotHandle | null> {
		let pointerValue: unknown
		try {
			pointerValue = await readJsonFileOnce(getDatasetSnapshotCurrentPath(this.rootDir, domain))
		} catch (error) {
			if (isMissingFile(error)) return null
			throw new DatasetSnapshotIntegrityError(domain, 'current.json', error)
		}

		try {
			const pointer = parseDatasetSnapshotPointer(pointerValue)
			if (pointer.domain !== domain) throw new Error(`Current pointer names ${pointer.domain}`)
			return await this.openCurrent(domain, pointer.snapshotId)
		} catch (error) {
			// A deliberate contract bump replaces the old generation. Malformed data remains a hard failure.
			if (isDatasetSnapshotCompatibilityError(error)) return null
			if (error instanceof DatasetSnapshotIntegrityError) throw error
			throw new DatasetSnapshotIntegrityError(domain, 'current.json', error)
		}
	}

	async pruneVersions(domain: DatasetSnapshotDomain, retainedVersionCount: number): Promise<void> {
		const versionsDir = getDatasetSnapshotVersionsDir(this.rootDir, domain)
		let entries
		try {
			entries = await fs.readdir(versionsDir, { withFileTypes: true })
		} catch (error) {
			if (isMissingFile(error)) return
			throw error
		}

		const candidates = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith('.candidate-'))
		const current = await this.getCurrent(domain)
		if (!current) return

		const publishedVersions: Array<DatasetSnapshotRef> = []
		const incompatibleVersions: Array<string> = []
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith('.candidate-')) continue
			try {
				publishedVersions.push(await readVersionManifest(path.join(versionsDir, entry.name), domain, entry.name))
			} catch (error) {
				if (isDatasetSnapshotCompatibilityError(error)) incompatibleVersions.push(entry.name)
				// Unknown directories are preserved; cleanup must never guess that data is disposable.
			}
		}

		publishedVersions.sort((a, b) => b.createdAt - a.createdAt || b.snapshotId.localeCompare(a.snapshotId))
		const retained = new Set([current.ref.snapshotId])
		for (const version of publishedVersions) {
			if (retained.size >= retainedVersionCount) break
			if (version.snapshotId === current.ref.snapshotId || version.createdAt > current.ref.createdAt) continue
			retained.add(version.snapshotId)
		}

		await Promise.all([
			...candidates.map((entry) => fs.rm(path.join(versionsDir, entry.name), { recursive: true, force: true })),
			...incompatibleVersions.map(async (snapshotId) => {
				await fs.rm(path.join(versionsDir, snapshotId), { recursive: true, force: true })
				this.handles.delete(`${domain}:${snapshotId}`)
			}),
			...publishedVersions
				.filter((version) => !retained.has(version.snapshotId))
				.map(async (version) => {
					await fs.rm(path.join(versionsDir, version.snapshotId), { recursive: true, force: true })
					this.handles.delete(`${domain}:${version.snapshotId}`)
				})
		])
	}

	async getStats(domain: DatasetSnapshotDomain): Promise<DatasetSnapshotStoreStats> {
		const domainRoot = getDatasetSnapshotDomainRoot(this.rootDir, domain)
		let entries
		try {
			entries = await fs.readdir(domainRoot, { recursive: true, withFileTypes: true })
		} catch (error) {
			if (isMissingFile(error)) return { artifactCount: 0, totalBytes: 0, versionCount: 0 }
			throw error
		}

		let artifactCount = 0
		let totalBytes = 0
		for (const entry of entries) {
			if (!entry.isFile()) continue
			artifactCount++
			totalBytes += (await fs.stat(path.join(entry.parentPath, entry.name))).size
		}

		const versionsDir = getDatasetSnapshotVersionsDir(this.rootDir, domain)
		const versions = await fs.readdir(versionsDir, { withFileTypes: true }).catch((error) => {
			if (isMissingFile(error)) return []
			throw error
		})
		return {
			artifactCount,
			totalBytes,
			versionCount: versions.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.candidate-')).length
		}
	}

	async publish(domain: DatasetSnapshotDomain, builder: DatasetSnapshotBuilder): Promise<DatasetSnapshotHandle> {
		const createdAt = this.now()
		const snapshotId = `${createdAt}-${randomUUID()}`
		const versionsDir = getDatasetSnapshotVersionsDir(this.rootDir, domain)
		const candidateDir = path.join(versionsDir, `.candidate-${snapshotId}`)
		const versionDir = getDatasetSnapshotVersionDir(this.rootDir, domain, snapshotId)
		await fs.mkdir(candidateDir, { recursive: true })

		const writer: DatasetSnapshotWriter = {
			writeJson(relativePath, value) {
				return writeJsonFileAtomically(resolveArtifactPath(candidateDir, relativePath), value)
			}
		}

		try {
			await builder(writer)
			const manifest = createDatasetSnapshotManifest(domain, snapshotId, createdAt)
			await writeJsonFileAtomically(path.join(candidateDir, MANIFEST_FILE), manifest)
			await validateVersionDirectory(candidateDir, domain, snapshotId)
			await fs.rename(candidateDir, versionDir)
			await writeJsonFileAtomically(
				getDatasetSnapshotCurrentPath(this.rootDir, domain),
				createDatasetSnapshotPointer(manifest)
			)
			return await this.openCurrent(domain, snapshotId)
		} catch (error) {
			await fs.rm(candidateDir, { recursive: true, force: true }).catch(() => undefined)
			throw error
		}
	}
}

export const fileDatasetSnapshotStore = new FileDatasetSnapshotStore()
