import { describe, expect, it } from 'vitest'
import { buildAdvancedTvlPresentation, orderAdvancedTvlChains } from './advancedTvlPresentation'

const chainsDataset = {
	dimensions: ['timestamp', 'Ethereum', 'Base'],
	source: [
		{ timestamp: 1_000, Ethereum: 10, Base: 5 },
		{ timestamp: 2_000, Ethereum: 20, Base: 30 }
	]
}

describe('advanced TVL presentation', () => {
	it('orders chains by the latest value without mutating the API dimension order', () => {
		const names = ['Ethereum', 'Base']

		expect(orderAdvancedTvlChains(chainsDataset, names)).toEqual(['Base', 'Ethereum'])
		expect(names).toEqual(['Ethereum', 'Base'])
	})

	it('gives preview and saved inflow charts the same dollar semantics', () => {
		const presentation = buildAdvancedTvlPresentation({
			chartType: 'tokenInflows',
			chainsDataset,
			chainNames: ['Ethereum', 'Base'],
			tokenNames: ['USDC', 'USDT']
		})

		expect(presentation.valueSymbol).toBe('$')
		expect(presentation.charts.map(({ name, type, stack }) => ({ name, type, stack }))).toEqual([
			{ name: 'USDC', type: 'bar', stack: 'stackA' },
			{ name: 'USDT', type: 'bar', stack: 'stackA' }
		])
		expect(presentation.stackColors.USDC).toBeTruthy()
	})

	it('keeps raw token balances unitless', () => {
		expect(
			buildAdvancedTvlPresentation({
				chartType: 'tokenBalances',
				chainsDataset,
				chainNames: [],
				tokenNames: ['TOKEN']
			}).valueSymbol
		).toBe('')
	})
})
