import { describe, expect, it } from 'vitest'
import { buildAdvancedTvlPresentation, orderAdvancedTvlChains } from './advancedTvlPresentation'

const chainsDataset = {
	dimensions: ['timestamp', 'Ethereum', 'Base'],
	source: [
		[1_000, 10, 5],
		[2_000, 20, 30]
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
