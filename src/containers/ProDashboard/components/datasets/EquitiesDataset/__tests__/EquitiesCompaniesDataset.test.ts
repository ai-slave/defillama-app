import { describe, expect, test } from 'vitest'
import {
	formatEquitiesDividendYield,
	formatEquitiesVolume,
	getEquitiesCompanyCsvRow
} from '../EquitiesCompaniesDataset.utils'

describe('Pro Equities company units', () => {
	test('formats company volume as a share count', () => {
		expect(formatEquitiesVolume(50_000_000)).toBe('50m')
		expect(formatEquitiesVolume(0)).toBe('0')
		expect(formatEquitiesVolume(undefined)).toBeNull()
	})

	test('formats dividend yield as producer percentage points', () => {
		expect(formatEquitiesDividendYield(0.34)).toBe('0.34%')
		expect(formatEquitiesDividendYield(0)).toBe('0.00%')
		expect(formatEquitiesDividendYield(undefined)).toBe('—')
	})

	test('preserves raw share volume and percentage-point yield in CSV', () => {
		expect(
			getEquitiesCompanyCsvRow({
				ticker: 'AAPL',
				name: 'Apple Inc.',
				currentPrice: 230,
				marketCap: 3_400_000_000_000,
				volume: 50_000_000,
				priceChangePercentage1d: 1,
				priceChangePercentage7d: 2,
				priceChangePercentage1m: 3,
				trailingPE: 30,
				dividendYield: 0.34,
				revenueTTM: 400_000_000_000,
				earningsTTM: 100_000_000_000
			})
		).toEqual([
			'AAPL',
			'Apple Inc.',
			230,
			3_400_000_000_000,
			50_000_000,
			1,
			2,
			3,
			30,
			0.34,
			400_000_000_000,
			100_000_000_000
		])
	})
})
