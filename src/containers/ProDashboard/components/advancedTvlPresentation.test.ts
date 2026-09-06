import { describe, expect, test } from 'vitest'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { buildAdvancedTvlPresentation, orderAdvancedTvlChains } from './advancedTvlPresentation'

const chainsDataset: TimestampDataset = {
	dimensions: ['timestamp', 'Ethereum', 'Base'],
	source: [
		[1000, 10, 5],
		[2000, 20, 30]
	]
}

describe('advanced TVL presentation', () => {
	test('orders chains by the latest value without mutating the API dimension order', () => {
		const names = ['Ethereum', 'Base']

		expect(orderAdvancedTvlChains(chainsDataset, names)).toEqual(['Base', 'Ethereum'])
		expect(names).toEqual(['Ethereum', 'Base'])
		const presentation = buildAdvancedTvlPresentation({
			chartType: 'chainsTvl',
			chainsDataset,
			chainNames: names,
			tokenNames: []
		})
		expect(presentation.charts.map(({ name, encode }) => ({ name, encode }))).toEqual([
			{ name: 'Base', encode: { x: 0, y: 2 } },
			{ name: 'Ethereum', encode: { x: 0, y: 1 } }
		])
	})

	test('gives preview and saved inflow charts the same dollar semantics', () => {
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

	test('keeps raw token balances unitless', () => {
		expect(
			buildAdvancedTvlPresentation({
				chartType: 'tokenBalances',
				chainsDataset,
				chainNames: [],
				tokenNames: ['TOKEN']
			}).valueSymbol
		).toBe('')
	})

	test('reserves the established Others color without making it a selectable token', () => {
		const presentation = buildAdvancedTvlPresentation({
			chartType: 'tokensPie',
			chainsDataset,
			chainNames: [],
			tokenNames: ['USDC']
		})

		expect(presentation.stackColors.USDC).toBeTruthy()
		expect(presentation.stackColors.Others).toBeTruthy()
	})
})
