import { describe, expect, test } from 'vitest'
import { toRWAPerpsBreakdownChartDataset } from '../breakdownDataset'

describe('rwa perps breakdownDataset', () => {
	test('keeps server row order while building the dataset', () => {
		expect(
			toRWAPerpsBreakdownChartDataset([
				{ timestamp: 1_774_569_600, NVIDIA: 130 },
				{ timestamp: 1_774_483_200, Meta: 120 }
			])
		).toEqual({
			source: [
				{ timestamp: 1_774_569_600_000, NVIDIA: 130 },
				{ timestamp: 1_774_483_200_000, Meta: 120 }
			],
			dimensions: ['timestamp', 'NVIDIA', 'Meta']
		})
	})

	test('orders series dimensions by latest available value descending', () => {
		expect(
			toRWAPerpsBreakdownChartDataset([
				{ timestamp: 1_774_483_200, alpha: 100, beta: 80, gamma: 60 },
				{ timestamp: 1_774_569_600, alpha: 90, beta: 90 }
			]).dimensions
		).toEqual(['timestamp', 'alpha', 'beta', 'gamma'])
	})

	test('preserves zero values returned by the backend', () => {
		expect(
			toRWAPerpsBreakdownChartDataset([
				{ timestamp: 1, PreStocks: 0, Securitize: 10 },
				{ timestamp: 2, PreStocks: 0, Securitize: 11 },
				{ timestamp: 3, PreStocks: 12, Securitize: 12 },
				{ timestamp: 4, PreStocks: 0, Securitize: 13 }
			])
		).toEqual({
			source: [
				{ timestamp: 1000, PreStocks: 0, Securitize: 10 },
				{ timestamp: 2000, PreStocks: 0, Securitize: 11 },
				{ timestamp: 3000, PreStocks: 12, Securitize: 12 },
				{ timestamp: 4000, PreStocks: 0, Securitize: 13 }
			],
			dimensions: ['timestamp', 'Securitize', 'PreStocks']
		})
	})
})
