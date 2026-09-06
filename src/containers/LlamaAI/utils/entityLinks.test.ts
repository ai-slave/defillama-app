import { describe, expect, test } from 'vitest'
import { getEntityUrl } from './entityLinks'

describe('getEntityUrl', () => {
	test('maps equity to the /equities/<ticker>:<country> route', () => {
		expect(getEntityUrl('equity', 'AAPL:US')).toBe('/equities/AAPL:US')
	})

	test('keeps existing protocol and chain routes', () => {
		expect(getEntityUrl('protocol', 'aave')).toBe('/protocol/aave')
		expect(getEntityUrl('chain', 'ethereum')).toBe('/chain/ethereum')
	})
})
