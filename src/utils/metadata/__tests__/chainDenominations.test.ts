import { describe, expect, test } from 'vitest'
import { getChainDenominations } from '../chainDenominations'

const arbitrum = { name: 'Arbitrum', id: 'arbitrum', gecko_id: 'arbitrum', tokenSymbol: 'ARB' }

describe('chain denominations', () => {
	test('uses the explicit gas ID and symbol instead of the official token', () => {
		expect(getChainDenominations({ ...arbitrum, gasTokenGeckoId: 'ethereum', gasTokenSymbol: 'ETH' })).toEqual([
			{ symbol: 'USD', geckoId: null },
			{ symbol: 'ETH', geckoId: 'ethereum' }
		])
	})

	test.each([
		undefined,
		arbitrum,
		{ ...arbitrum, gasTokenGeckoId: null, gasTokenSymbol: null },
		{ ...arbitrum, gasTokenGeckoId: 'ethereum' },
		{ ...arbitrum, gasTokenSymbol: 'ETH' }
	])('offers only USD when gas metadata is incomplete', (metadata) => {
		expect(getChainDenominations(metadata)).toEqual([{ symbol: 'USD', geckoId: null }])
	})
})
