import { describe, expect, it } from 'vitest'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { captureSnapshot, snapshotToResult, SQL_SNAPSHOT_ROW_CAP } from '../snapshot'

function resultWithRows(n: number): QueryResult {
	return {
		columns: [
			{ name: 'ts', type: 'VARCHAR' },
			{ name: 'value', type: 'DOUBLE' }
		],
		rows: Array.from({ length: n }, (_, i) => [`2026-01-${i}`, i])
	}
}

const AT = '2026-06-24T12:00:00.000Z'

describe('captureSnapshot', () => {
	it('keeps all rows and omits the truncated flag when under the cap', () => {
		const snap = captureSnapshot(resultWithRows(3), 'browser', AT)
		expect(snap.rows).toHaveLength(3)
		expect(snap.rowCount).toBe(3)
		expect(snap.truncated).toBeUndefined()
		expect(snap.columns).toEqual([
			{ name: 'ts', type: 'VARCHAR' },
			{ name: 'value', type: 'DOUBLE' }
		])
		expect(snap.engine).toBe('browser')
		expect(snap.computedAt).toBe(AT)
	})

	it('caps rows at SQL_SNAPSHOT_ROW_CAP and flags truncation while keeping the true rowCount', () => {
		const snap = captureSnapshot(resultWithRows(1500), 'browser', AT)
		expect(snap.rows).toHaveLength(SQL_SNAPSHOT_ROW_CAP)
		expect(snap.truncated).toBe(true)
		expect(snap.rowCount).toBe(1500)
	})

	it('treats a result exactly at the cap as not truncated', () => {
		const snap = captureSnapshot(resultWithRows(SQL_SNAPSHOT_ROW_CAP), 'browser', AT)
		expect(snap.rows).toHaveLength(SQL_SNAPSHOT_ROW_CAP)
		expect(snap.truncated).toBeUndefined()
		expect(snap.rowCount).toBe(SQL_SNAPSHOT_ROW_CAP)
	})

	it('records the engine that produced the snapshot', () => {
		expect(captureSnapshot(resultWithRows(1), 'server', AT).engine).toBe('server')
	})

	it('honors a custom row cap and clamps it to the allowed range', () => {
		const snap = captureSnapshot(resultWithRows(500), 'browser', AT, 200)
		expect(snap.rows).toHaveLength(200)
		expect(snap.truncated).toBe(true)
		expect(snap.rowCount).toBe(500)
		const clamped = captureSnapshot(resultWithRows(500), 'browser', AT, 5)
		expect(clamped.rows).toHaveLength(100)
	})

	it('normalizes BigInt and Date values so the snapshot is JSON-serializable', () => {
		const result: QueryResult = {
			columns: [
				{ name: 'n', type: 'BIGINT' },
				{ name: 'd', type: 'DATE' }
			],
			rows: [[42n, new Date('2026-06-24T00:00:00.000Z')]]
		}
		const snap = captureSnapshot(result, 'browser', AT)
		expect(snap.rows[0][0]).toBe(42)
		expect(snap.rows[0][1]).toBe('2026-06-24T00:00:00.000Z')
		expect(() => JSON.stringify(snap)).not.toThrow()
	})
})

describe('snapshotToResult', () => {
	it('round-trips columns and rows back into a QueryResult', () => {
		const snap = captureSnapshot(resultWithRows(2), 'browser', AT)
		const result = snapshotToResult(snap)
		expect(result.columns).toEqual(snap.columns)
		expect(result.rows).toEqual(snap.rows)
	})
})
