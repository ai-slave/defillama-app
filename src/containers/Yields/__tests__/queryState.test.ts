import { describe, expect, test } from 'vitest'
import { decodeYieldsQuery, resetYieldsPoolPageOnFilterChange, selectedSubsetQuery } from '../queryState'

describe('selectedSubsetQuery', () => {
	test('encodes all, none, and partial selections for include filters', () => {
		expect(selectedSubsetQuery(['Ethereum', 'Base'], ['Ethereum', 'Base'])).toBeUndefined()
		expect(selectedSubsetQuery([], ['Ethereum', 'Base'])).toEqual(['__none__'])
		expect(selectedSubsetQuery(['Base'], ['Ethereum', 'Base'])).toEqual(['Base'])
	})

	test('does not turn unavailable metadata into a deselect-all filter', () => {
		expect(selectedSubsetQuery([], [])).toBeUndefined()
		expect(selectedSubsetQuery(['Ethereum'], [])).toEqual(['Ethereum'])
	})
})

describe('decodeYieldsQuery', () => {
	test('applies selection, exclusion, range, and ALL_EVM semantics consistently', () => {
		const decoded = decodeYieldsQuery(
			{
				project: ['Aave', 'Compound'],
				excludeProject: 'Compound',
				chain: 'ALL_EVM',
				excludeChain: 'Arbitrum',
				attribute: ['single_exposure', 'no_il'],
				minTvl: '1000',
				maxApy: '12'
			},
			{
				projectList: ['Aave', 'Compound', 'Morpho'],
				chainList: ['Ethereum', 'Arbitrum', 'Solana'],
				evmChains: ['Ethereum', 'Arbitrum']
			}
		)

		expect(decoded.selectedProjects).toEqual(['Aave'])
		expect(decoded.selectedChains).toEqual(['Ethereum'])
		expect(decoded.selectedAttributes).toEqual(['single_exposure', 'no_il'])
		expect(decoded.minTvl).toBe(1000)
		expect(decoded.maxApy).toBe(12)
	})
})

describe('resetYieldsPoolPageOnFilterChange', () => {
	test('clears table pagination only on server-paginated yield routes', () => {
		expect(resetYieldsPoolPageOnFilterChange('/yields', { chain: 'Ethereum' })).toEqual({
			chain: 'Ethereum',
			page: undefined
		})
		expect(resetYieldsPoolPageOnFilterChange('/yields/loop', { token: 'ETH' })).toEqual({
			token: 'ETH',
			page: undefined
		})
		expect(resetYieldsPoolPageOnFilterChange('/borrow', { chain: 'Ethereum' })).toEqual({
			chain: 'Ethereum'
		})
	})
})
