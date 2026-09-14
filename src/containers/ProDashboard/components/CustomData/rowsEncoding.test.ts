import { afterEach, describe, expect, test, vi } from 'vitest'
import { isCustomDataEncodedRows, type SqlSnapshotValue } from '../../types'
import {
	CUSTOM_DATA_ENCODED_MAX_LENGTH,
	CUSTOM_DATA_INLINE_ROWS_MAX_LENGTH,
	CustomDataTooLargeError,
	decodeRows,
	encodeRows,
	gzipBase64Decode,
	gzipBase64Encode,
	supportsRowsCompression
} from './rowsEncoding'

function numericRows(count: number, seed = 1): Array<Array<SqlSnapshotValue>> {
	return Array.from({ length: count }, (_, index) => [
		`2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
		index * seed,
		Math.round(Math.sin(index) * 1_000_000) / 1000,
		index % 3 === 0 ? null : `label-${index % 17}`
	])
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('encodeRows', () => {
	test('keeps small datasets as the same inline array', async () => {
		const rows = numericRows(20)
		expect(JSON.stringify(rows).length).toBeLessThanOrEqual(CUSTOM_DATA_INLINE_ROWS_MAX_LENGTH)
		await expect(encodeRows(rows)).resolves.toBe(rows)
	})

	test('compresses datasets above the inline threshold and round-trips them', async () => {
		const rows = numericRows(2000)
		const json = JSON.stringify(rows)
		expect(json.length).toBeGreaterThan(CUSTOM_DATA_INLINE_ROWS_MAX_LENGTH)
		const encoded = await encodeRows(rows)
		if (!isCustomDataEncodedRows(encoded)) throw new Error('Expected compressed rows')
		expect(encoded).toMatchObject({ encoding: 'gzip-base64', rowCount: 2000 })
		expect(encoded.data.length).toBeLessThan(json.length / 2)
		expect(/^[A-Za-z0-9+/]+=*$/.test(encoded.data)).toBe(true)
		await expect(decodeRows(encoded)).resolves.toEqual(rows)
		await expect(gzipBase64Decode(await gzipBase64Encode('héllo'))).resolves.toBe('héllo')
	})

	test('rejects datasets whose compressed form is still too large', async () => {
		let state = 12_345
		const random = () => {
			state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
			return state / 2_147_483_648
		}
		const rows = Array.from({ length: 5000 }, () => Array.from({ length: 20 }, () => random()))
		await expect(encodeRows(rows)).rejects.toBeInstanceOf(CustomDataTooLargeError)
		await expect(encodeRows(rows)).rejects.toThrow('This dataset is too large to store in a dashboard.')
		expect(CUSTOM_DATA_ENCODED_MAX_LENGTH).toBe(256 * 1024)
	})

	test('explains when the browser cannot compress a dataset that does not fit inline', async () => {
		expect(supportsRowsCompression()).toBe(true)
		vi.stubGlobal('CompressionStream', undefined)
		expect(supportsRowsCompression()).toBe(false)
		await expect(encodeRows(numericRows(20))).resolves.toHaveLength(20)
		await expect(encodeRows(numericRows(2000))).rejects.toThrow('This browser cannot compress large datasets.')
	})
})

describe('decodeRows', () => {
	test('returns inline rows synchronously resolved and caches decoding per encoded object', async () => {
		const inline = numericRows(3)
		await expect(decodeRows(inline)).resolves.toBe(inline)
		const encoded = await encodeRows(numericRows(2000))
		if (!isCustomDataEncodedRows(encoded)) throw new Error('Expected compressed rows')
		const first = decodeRows(encoded)
		expect(decodeRows(encoded)).toBe(first)
		expect(decodeRows({ ...encoded })).not.toBe(first)
		await expect(first).resolves.toHaveLength(2000)
	})

	test('drops entries that are not rows when a stored payload is malformed', async () => {
		const data = await gzipBase64Encode(JSON.stringify([[1, 2], 'junk', null, [3, 4]]))
		await expect(decodeRows({ encoding: 'gzip-base64', data, rowCount: 4 })).resolves.toEqual([
			[1, 2],
			[3, 4]
		])
		const notAList = await gzipBase64Encode(JSON.stringify({ rows: [] }))
		await expect(decodeRows({ encoding: 'gzip-base64', data: notAList, rowCount: 0 })).rejects.toThrow(
			'Stored dataset rows are not a list'
		)
	})
})
