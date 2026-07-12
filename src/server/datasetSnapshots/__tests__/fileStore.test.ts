import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DATASET_SNAPSHOT_CONTRACT } from '../contract'
import { getDatasetSnapshotCurrentPath, getDatasetSnapshotVersionsDir } from '../filePaths.server'
import { FileDatasetSnapshotStore } from '../fileStore.server'
import type { DatasetSnapshotWriter } from '../store'

async function writeMarketsArtifacts(writer: DatasetSnapshotWriter, version: number): Promise<void> {
	for (const relativePath of Object.values(DATASET_SNAPSHOT_CONTRACT.markets.files)) {
		await writer.writeJson(relativePath, { version, relativePath })
	}
}

describe('filesystem dataset snapshot store', () => {
	let rootDir = ''

	afterEach(async () => {
		if (rootDir) await rm(rootDir, { recursive: true, force: true })
	})

	it('publishes immutable versions and keeps old handles stable', async () => {
		rootDir = await mkdtemp(path.join(os.tmpdir(), 'dataset-snapshot-store-'))
		let now = 100
		const store = new FileDatasetSnapshotStore(rootDir, () => now)
		const first = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 1))
		now = 200
		const second = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 2))

		expect(first.ref.snapshotId).not.toBe(second.ref.snapshotId)
		const firstRead = await first.readJson('tokens-list.json')
		expect(await first.readJson('tokens-list.json')).toBe(firstRead)
		expect(firstRead).toEqual({
			version: 1,
			relativePath: 'tokens-list.json'
		})
		const currentRead = await (await store.getCurrent('markets'))?.readJson('tokens-list.json')
		expect(currentRead).not.toBe(firstRead)
		expect(currentRead).toEqual({
			version: 2,
			relativePath: 'tokens-list.json'
		})
	})

	it('leaves the current pointer untouched when building or validation fails', async () => {
		rootDir = await mkdtemp(path.join(os.tmpdir(), 'dataset-snapshot-store-'))
		const store = new FileDatasetSnapshotStore(rootDir)
		await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 1))
		const pointerPath = getDatasetSnapshotCurrentPath(rootDir, 'markets')
		const before = await readFile(pointerPath, 'utf8')

		await expect(
			store.publish('markets', async () => {
				throw new Error('upstream failed')
			})
		).rejects.toThrow('upstream failed')
		await expect(store.publish('markets', (writer) => writer.writeJson('tokens-list.json', {}))).rejects.toThrow()
		await expect(readFile(pointerPath, 'utf8')).resolves.toBe(before)
	})

	it('retains the current and previous versions while removing older versions and candidates', async () => {
		rootDir = await mkdtemp(path.join(os.tmpdir(), 'dataset-snapshot-store-'))
		let now = 100
		const store = new FileDatasetSnapshotStore(rootDir, () => now)
		const first = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 1))
		now = 200
		const previous = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 2))
		now = 300
		const current = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 3))
		const versionsDir = getDatasetSnapshotVersionsDir(rootDir, 'markets')
		await mkdir(path.join(versionsDir, '.candidate-abandoned'))

		await store.pruneVersions('markets', 2)

		const versions = (await readdir(versionsDir)).sort()
		expect(versions).toEqual([current.ref.snapshotId, previous.ref.snapshotId].sort())
		expect(versions).not.toContain(first.ref.snapshotId)
		await expect(previous.readJson('tokens-list.json')).resolves.toEqual({
			version: 2,
			relativePath: 'tokens-list.json'
		})
		await expect(store.getStats('markets')).resolves.toMatchObject({ versionCount: 2 })
	})

	it('does not mistake a newer unreferenced version for the previous generation', async () => {
		rootDir = await mkdtemp(path.join(os.tmpdir(), 'dataset-snapshot-store-'))
		let now = 100
		const store = new FileDatasetSnapshotStore(rootDir, () => now)
		const previous = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 1))
		now = 200
		const current = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 2))
		const pointerPath = getDatasetSnapshotCurrentPath(rootDir, 'markets')
		const currentPointer = await readFile(pointerPath, 'utf8')
		now = 300
		const orphan = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 3))
		await writeFile(pointerPath, currentPointer)

		await store.pruneVersions('markets', 2)

		const versions = (await readdir(getDatasetSnapshotVersionsDir(rootDir, 'markets'))).sort()
		expect(versions).toEqual([current.ref.snapshotId, previous.ref.snapshotId].sort())
		expect(versions).not.toContain(orphan.ref.snapshotId)
		expect(await store.getCurrent('markets')).toMatchObject({ ref: { snapshotId: current.ref.snapshotId } })
	})

	it('rejects corrupt pointers and paths outside a version', async () => {
		rootDir = await mkdtemp(path.join(os.tmpdir(), 'dataset-snapshot-store-'))
		const store = new FileDatasetSnapshotStore(rootDir)
		const handle = await store.publish('markets', (writer) => writeMarketsArtifacts(writer, 1))
		await expect(handle.readJson('../current.json')).rejects.toThrow('path escapes')

		await writeFile(getDatasetSnapshotCurrentPath(rootDir, 'markets'), '{')
		await expect(store.getCurrent('markets')).rejects.toThrow('markets/current.json')
	})
})
