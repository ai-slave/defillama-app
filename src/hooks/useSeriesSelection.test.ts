import { describe, expect, it } from 'vitest'
import { boundSeriesSelection, reconcileSeriesSelection } from './useSeriesSelection'

describe('reconcileSeriesSelection', () => {
	it('uses stable defaults before the user makes a selection', () => {
		expect(
			reconcileSeriesSelection({
				availableSeries: ['Ethereum', 'Solana', 'Base'],
				selectedSeries: null,
				defaultSeries: ['Solana', 'Ethereum']
			})
		).toEqual(['Solana', 'Ethereum'])
	})

	it('preserves explicit selection order and removes stale names', () => {
		expect(
			reconcileSeriesSelection({
				availableSeries: ['Ethereum', 'Base', 'Arbitrum'],
				selectedSeries: ['Base', 'Solana', 'Ethereum']
			})
		).toEqual(['Base', 'Ethereum'])
	})

	it('does not silently select newly available series after user interaction', () => {
		expect(
			reconcileSeriesSelection({
				availableSeries: ['Ethereum', 'Solana', 'Base'],
				selectedSeries: ['Ethereum', 'Solana']
			})
		).toEqual(['Ethereum', 'Solana'])
	})

	it('falls back to one valid default instead of returning a blank selection', () => {
		expect(
			reconcileSeriesSelection({
				availableSeries: ['Ethereum', 'Base'],
				selectedSeries: [],
				defaultSeries: ['Solana', 'Base']
			})
		).toEqual(['Base'])
	})

	it('deduplicates values and applies the configured cap', () => {
		expect(
			reconcileSeriesSelection({
				availableSeries: ['A', 'A', 'B', 'C'],
				selectedSeries: ['C', 'C', 'B', 'A'],
				maxSelectedSeries: 2
			})
		).toEqual(['C', 'B'])
	})

	it('can restore the complete capped default when an explicit selection becomes stale', () => {
		expect(
			reconcileSeriesSelection({
				availableSeries: ['C', 'D', 'E'],
				selectedSeries: ['A', 'B'],
				defaultSeries: ['D', 'C', 'E'],
				maxSelectedSeries: 2,
				resetToDefaultWhenStale: true
			})
		).toEqual(['D', 'C'])
	})
})

describe('boundSeriesSelection', () => {
	it('keeps a newly selected tail series when the visible selection is at its cap', () => {
		const displayed = Array.from({ length: 30 }, (_, index) => `Series ${index}`)
		expect(boundSeriesSelection(displayed, [...displayed, 'Series 40'], 30)).toEqual([
			...displayed.slice(0, 29),
			'Series 40'
		])
	})
})
