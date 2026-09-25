import { describe, expect, test } from 'vitest'
import { getProTokenUsageQueryKey, getProYieldsDatasetQueryKey, normalizeProTokenSymbols } from '../tableQueryKeys'

describe('Pro dashboard table query keys', () => {
	test('normalizes token order and casing for shared token-usage requests', () => {
		expect(getProTokenUsageQueryKey(['usdt', 'USDC'], false)).toEqual(getProTokenUsageQueryKey(['usdc', 'USDT'], false))
		expect(getProTokenUsageQueryKey(['usdt'], false)).not.toEqual(getProTokenUsageQueryKey(['usdc'], false))
		expect(normalizeProTokenSymbols([' usdc ', 'USDT', 'USDC', ''])).toEqual(['USDC', 'USDT'])
	})

	test('uses one aggregate Yields identity for empty and All chain filters', () => {
		expect(getProYieldsDatasetQueryKey([])).toEqual(getProYieldsDatasetQueryKey(['All']))
		expect(getProYieldsDatasetQueryKey([])).not.toEqual(getProYieldsDatasetQueryKey(['Ethereum']))
	})
})
