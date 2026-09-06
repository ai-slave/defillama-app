import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { getDatasetIndexFileName } from '../indexKeys.server'

function hashedFileName(key: string): string {
	return `${createHash('sha256').update(key).digest('hex')}.json`
}

describe('getDatasetIndexFileName', () => {
	test('keeps short encoded keys readable', () => {
		expect(getDatasetIndexFileName('btc')).toBe('btc.json')
		expect(getDatasetIndexFileName('staked eth')).toBe('staked%20eth.json')
		expect(getDatasetIndexFileName('usd*')).toBe('usd%2A.json')
		expect(getDatasetIndexFileName('conway')).toBe('conway.json')
	})

	test('hashes Windows reserved device names', () => {
		expect(getDatasetIndexFileName('con')).toBe(hashedFileName('con'))
		expect(getDatasetIndexFileName('CON')).toBe(hashedFileName('CON'))
		expect(getDatasetIndexFileName('lpt1')).toBe(hashedFileName('lpt1'))
		expect(getDatasetIndexFileName('con.market')).toBe(hashedFileName('con.market'))
		expect(getDatasetIndexFileName('aux.foo')).toBe(hashedFileName('aux.foo'))
	})

	test('uses a deterministic bounded filename for long keys', () => {
		const key = 'wrapped-'.repeat(80)
		const fileName = getDatasetIndexFileName(key)

		expect(fileName).toBe(hashedFileName(key))
		expect(Buffer.byteLength(fileName)).toBeLessThanOrEqual(240)
		expect(fileName).toBe(getDatasetIndexFileName(key))
	})

	test('measures encoded byte length before choosing the filename', () => {
		const key = '東京'.repeat(30)
		const fileName = getDatasetIndexFileName(key)

		expect(Buffer.byteLength(`${encodeURIComponent(key)}.json`)).toBeGreaterThan(240)
		expect(fileName).toBe(hashedFileName(key))
	})
})
