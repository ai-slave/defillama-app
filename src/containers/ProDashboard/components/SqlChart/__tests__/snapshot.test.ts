import { describe, expect, it } from 'vitest'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { captureSnapshot, snapshotToResult, SQL_SNAPSHOT_ROW_CAP } from '../../../sqlSnapshot'

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

class JsonBackedSqlValue {
	readonly toJSON: () => unknown

	constructor(value: unknown) {
		this.toJSON = () => value
	}
}

const jsonBackedSqlValue = (value: unknown) =>
	new Proxy(new JsonBackedSqlValue(value), {
		// Arrow StructRow proxies expose `toJSON` through property access but not the `in` operator.
		has: () => false
	})

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
		expect(snap.rows).toEqual([[42, '2026-06-24T00:00:00.000Z']])
		expect(() => JSON.stringify(snap)).not.toThrow()
	})

	it('normalizes nested plain records and omits undefined properties', () => {
		const result: QueryResult = {
			columns: [{ name: 'value', type: 'STRUCT' }],
			rows: [[{ amount: 42n, values: [1, new Date('2026-06-24T00:00:00.000Z')], missing: undefined }]]
		}

		expect(captureSnapshot(result, 'browser', AT).rows).toEqual([
			[{ amount: 42, values: [1, '2026-06-24T00:00:00.000Z'] }]
		])
	})

	it('normalizes JSON-backed LIST and STRUCT values returned by the SQL engine', () => {
		const result: QueryResult = {
			columns: [{ name: 'value', type: 'STRUCT' }],
			rows: [
				[
					jsonBackedSqlValue({
						amount: 42n,
						values: jsonBackedSqlValue([1, new Date('2026-06-24T00:00:00.000Z')])
					})
				]
			]
		}

		expect(captureSnapshot(result, 'browser', AT).rows).toEqual([
			[{ amount: 42, values: [1, '2026-06-24T00:00:00.000Z'] }]
		])
	})

	it('does not invent JSON shapes for unsupported object instances', () => {
		const result: QueryResult = {
			columns: [
				{ name: 'map', type: 'UNKNOWN' },
				{ name: 'inherited', type: 'UNKNOWN' }
			],
			rows: [[new Map([['value', 1]]), Object.create({ inherited: 1 })]]
		}

		expect(captureSnapshot(result, 'browser', AT).rows).toEqual([[null, null]])
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
