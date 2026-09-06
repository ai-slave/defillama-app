import { describe, expect, test } from 'vitest'
import { calculateCumulativePercentageChange, getCumulativeChangeOfPeriod } from '../queries'

const NOW = Date.parse('2026-07-14T12:00:00Z')
const seconds = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1e3

describe('narrative performance freshness', () => {
	test('returns a category change only when both period endpoints are present and current', () => {
		const performance = {
			'30': [
				{ date: seconds('2026-06-14'), DeFi: 0 },
				{ date: seconds('2026-07-01'), DeFi: 5 },
				{ date: seconds('2026-07-14'), DeFi: 12 }
			]
		}

		expect(getCumulativeChangeOfPeriod(performance, '30', 'DeFi', NOW)).toBe(12)
	})

	test('does not use day 29 or day 31 as a 30-day narrative baseline', () => {
		const performance = {
			'30': [
				{ date: seconds('2026-06-13'), DeFi: 0 },
				{ date: seconds('2026-06-15'), DeFi: 1 },
				{ date: seconds('2026-07-14'), DeFi: 12 }
			]
		}

		expect(getCumulativeChangeOfPeriod(performance, '30', 'DeFi', NOW)).toBeNull()
	})

	test('requires the selected category on the comparison endpoint', () => {
		const performance = {
			'30': [
				{ date: seconds('2026-06-14'), Other: 0 },
				{ date: seconds('2026-07-14'), DeFi: 12 }
			]
		}

		expect(getCumulativeChangeOfPeriod(performance, '30', 'DeFi', NOW)).toBeNull()
	})

	test('builds sparse coin return series from exact fresh endpoints', () => {
		const result = calculateCumulativePercentageChange(
			[
				['coin', '2026-06-14T00:00:00Z', 100],
				['coin', '2026-07-01T00:00:00Z', 110],
				['coin', '2026-07-14T00:00:00Z', 125]
			],
			{ coin: 'Coin' },
			30,
			NOW
		)

		expect(result).toEqual([
			{ date: seconds('2026-06-14'), Coin: 0 },
			{ date: seconds('2026-07-01'), Coin: 10 },
			{ date: seconds('2026-07-14'), Coin: 25 }
		])
	})

	test('omits a coin when its current or exact comparison price is missing', () => {
		const result = calculateCumulativePercentageChange(
			[
				['missing-target', '2026-06-15T00:00:00Z', 100],
				['missing-target', '2026-07-14T00:00:00Z', 125],
				['stale', '2026-06-13T00:00:00Z', 100],
				['stale', '2026-07-13T00:00:00Z', 125]
			],
			{ 'missing-target': 'Missing Target', stale: 'Stale' },
			30,
			NOW
		)

		expect(result).toEqual([])
	})
})
