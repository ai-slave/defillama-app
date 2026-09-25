import { describe, expect, test } from 'vitest'
import {
	createDatasetSnapshotManifest,
	createDatasetSnapshotPointer,
	DatasetSnapshotCompatibilityError,
	parseDatasetSnapshotManifest,
	parseDatasetSnapshotPointer
} from '../contract'

describe('dataset snapshot contract', () => {
	test('round-trips created manifests and current pointers through their parsers', () => {
		const manifest = createDatasetSnapshotManifest('yields', 'snapshot-1', 123)
		expect(parseDatasetSnapshotManifest(manifest)).toEqual(manifest)
		expect(parseDatasetSnapshotPointer(createDatasetSnapshotPointer(manifest))).toEqual({
			domain: 'yields',
			snapshotId: 'snapshot-1',
			formatVersion: manifest.formatVersion
		})
	})

	test('rejects unknown domains, stale schemas, and unsafe snapshot ids', () => {
		const manifest = createDatasetSnapshotManifest('yields', 'snapshot-1')
		expect(() => parseDatasetSnapshotManifest({ ...manifest, domain: 'yields-v2' })).toThrow('unknown domain')
		expect(() => parseDatasetSnapshotManifest({ ...manifest, schemaVersion: 1 })).toThrow('schema mismatch for yields')
		expect(() => parseDatasetSnapshotManifest({ ...manifest, snapshotId: '../escape' })).toThrow('invalid snapshotId')
	})

	test('allows replacement of older contracts but refuses to overwrite newer ones', () => {
		const manifest = createDatasetSnapshotManifest('yields', 'snapshot-1')
		const pointer = createDatasetSnapshotPointer(manifest)

		expect(() => parseDatasetSnapshotManifest({ ...manifest, schemaVersion: 1 })).toThrow(
			DatasetSnapshotCompatibilityError
		)
		expect(() => parseDatasetSnapshotManifest({ ...manifest, schemaVersion: 5 })).toThrow(
			'cannot replace a newer or invalid schema'
		)
		expect(() => parseDatasetSnapshotPointer({ ...pointer, formatVersion: 1 })).toThrow(
			DatasetSnapshotCompatibilityError
		)
		expect(() => parseDatasetSnapshotPointer({ ...pointer, formatVersion: 3 })).toThrow('unsupported by this process')
	})
})
