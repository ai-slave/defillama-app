import { describe, expect, it } from 'vitest'
import {
	getProDimensionDatasetQueryKey,
	getProTokenUsageQueryKey,
	getProYieldsDatasetQueryKey,
	isProDimensionDatasetType,
	normalizeProTokenSymbols
} from './tableQueryKeys'

describe('Pro dashboard table query keys', () => {
	it('uses one aggregate identity for empty and All chain filters', () => {
		expect(getProDimensionDatasetQueryKey('fees', [])).toEqual(getProDimensionDatasetQueryKey('fees', ['All']))
		expect(getProDimensionDatasetQueryKey('revenue', [])).toEqual(
			getProDimensionDatasetQueryKey('revenue', ['Ethereum', 'All'])
		)
	})

	it('normalizes chain order only in the cache identity', () => {
		expect(getProDimensionDatasetQueryKey('fees', ['Ethereum', 'Base'])).toEqual(
			getProDimensionDatasetQueryKey('fees', ['Base', 'Ethereum'])
		)
	})

	it('normalizes token order and casing for shared token-usage requests', () => {
		expect(getProTokenUsageQueryKey(['usdt', 'USDC'], false)).toEqual(getProTokenUsageQueryKey(['usdc', 'USDT'], false))
		expect(normalizeProTokenSymbols([' usdc ', 'USDT', 'USDC', ''])).toEqual(['USDC', 'USDT'])
	})

	it('uses one aggregate Yields identity for empty and All chain filters', () => {
		expect(getProYieldsDatasetQueryKey([])).toEqual(getProYieldsDatasetQueryKey(['All']))
	})

	it('rejects unknown persisted dataset types', () => {
		expect(isProDimensionDatasetType('__proto__')).toBe(false)
		expect(isProDimensionDatasetType(null)).toBe(false)
	})
})
