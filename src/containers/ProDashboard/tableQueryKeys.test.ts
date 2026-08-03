import { describe, expect, it } from 'vitest'
import { getProTokenUsageQueryKey, getProYieldsDatasetQueryKey, normalizeProTokenSymbols } from './tableQueryKeys'

describe('Pro dashboard table query keys', () => {
	it('normalizes token order and casing for shared token-usage requests', () => {
		expect(getProTokenUsageQueryKey(['usdt', 'USDC'], false)).toEqual(getProTokenUsageQueryKey(['usdc', 'USDT'], false))
		expect(normalizeProTokenSymbols([' usdc ', 'USDT', 'USDC', ''])).toEqual(['USDC', 'USDT'])
	})

	it('uses one aggregate Yields identity for empty and All chain filters', () => {
		expect(getProYieldsDatasetQueryKey([])).toEqual(getProYieldsDatasetQueryKey(['All']))
	})
})
