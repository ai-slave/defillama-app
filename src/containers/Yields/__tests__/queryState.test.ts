import { describe, expect, test } from 'vitest'
import { decodeYieldsQuery, resetYieldsPoolPageOnFilterChange } from '../queryState'

describe('decodeYieldsQuery', () => {
	test('reads the protocol, chain and category pickers, attributes and ranges from the page URL', () => {
		const decoded = decodeYieldsQuery(
			{
				excludeProtocol: 'Compound',
				chain: ['Ethereum', 'Solana'],
				category: 'None',
				attribute: ['single_exposure', 'no_il'],
				minTvl: '1000',
				maxApy: '12'
			},
			{
				projectList: ['Aave', 'Compound', 'Morpho'],
				chainList: ['Ethereum', 'Arbitrum', 'Solana'],
				categoryList: ['Lending', 'Dexs']
			}
		)

		expect(decoded.selectedProjects).toEqual(['Aave', 'Morpho'])
		expect(decoded.selectedChains).toEqual(['Ethereum', 'Solana'])
		expect(decoded.selectedCategories).toEqual([])
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
