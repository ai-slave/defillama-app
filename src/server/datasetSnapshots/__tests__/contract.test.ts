import { describe, expect, it } from 'vitest'
import {
	createDatasetSnapshotManifest,
	createDatasetSnapshotPointer,
	parseDatasetSnapshotManifest,
	parseDatasetSnapshotPointer
} from '../contract'

describe('dataset snapshot contract', () => {
	it('creates matching domain manifests and current pointers', () => {
		const manifest = createDatasetSnapshotManifest('yields', 'snapshot-1', 123)
		expect(manifest).toEqual({
			domain: 'yields',
			snapshotId: 'snapshot-1',
			formatVersion: 2,
			schemaVersion: 1,
			createdAt: 123
		})
		expect(parseDatasetSnapshotManifest(manifest)).toEqual(manifest)
		expect(parseDatasetSnapshotPointer(createDatasetSnapshotPointer(manifest))).toEqual({
			domain: 'yields',
			snapshotId: 'snapshot-1',
			formatVersion: 2
		})
	})

	it('rejects unknown domains, stale schemas, and unsafe snapshot ids', () => {
		const manifest = createDatasetSnapshotManifest('yields', 'snapshot-1')
		expect(() => parseDatasetSnapshotManifest({ ...manifest, domain: 'yields-v2' })).toThrow('unknown domain')
		expect(() => parseDatasetSnapshotManifest({ ...manifest, schemaVersion: 2 })).toThrow('schema mismatch for yields')
		expect(() => parseDatasetSnapshotManifest({ ...manifest, snapshotId: '../escape' })).toThrow('invalid snapshotId')
	})
})
