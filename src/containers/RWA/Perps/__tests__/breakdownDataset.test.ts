import { describe, expect, it } from 'vitest'
import { toRWAPerpsBreakdownChartDataset } from '../breakdownDataset'

describe('rwa perps breakdownDataset', () => {
	it('keeps server row order while building the dataset', () => {
		expect(
			toRWAPerpsBreakdownChartDataset([
				{ timestamp: 1774569600, NVIDIA: 130 },
				{ timestamp: 1774483200, Meta: 120 }
			])
		).toEqual({
			source: [
				{ timestamp: 1774569600000, NVIDIA: 130 },
				{ timestamp: 1774483200000, Meta: 120 }
			],
			dimensions: ['timestamp', 'NVIDIA', 'Meta']
		})
	})

	it('orders series dimensions by latest available value descending', () => {
		expect(
			toRWAPerpsBreakdownChartDataset([
				{ timestamp: 1774483200, alpha: 100, beta: 80, gamma: 60 },
				{ timestamp: 1774569600, alpha: 90, beta: 90 }
			]).dimensions
		).toEqual(['timestamp', 'alpha', 'beta', 'gamma'])
	})

	it('preserves zero values returned by the backend', () => {
		expect(
			toRWAPerpsBreakdownChartDataset([
				{ timestamp: 1, PreStocks: 0, Securitize: 10 },
				{ timestamp: 2, PreStocks: 0, Securitize: 11 },
				{ timestamp: 3, PreStocks: 12, Securitize: 12 },
				{ timestamp: 4, PreStocks: 0, Securitize: 13 }
			])
		).toEqual({
			source: [
				{ timestamp: 1_000, PreStocks: 0, Securitize: 10 },
				{ timestamp: 2_000, PreStocks: 0, Securitize: 11 },
				{ timestamp: 3_000, PreStocks: 12, Securitize: 12 },
				{ timestamp: 4_000, PreStocks: 0, Securitize: 13 }
			],
			dimensions: ['timestamp', 'Securitize', 'PreStocks']
		})
	})
})
