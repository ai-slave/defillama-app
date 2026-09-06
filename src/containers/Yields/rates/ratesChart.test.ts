import { describe, expect, test } from 'vitest'
import type { RefRatePoint } from './fetch'
import { buildRatesChart } from './ratesChart'

describe('buildRatesChart', () => {
	test('maps typed rate values and null gaps without coercion', () => {
		const points: Array<RefRatePoint> = [
			{
				date: '2026-01-01',
				rates: {
					supply: { apy: 3 },
					borrow: { apy: null },
					spread: { apy: -2 }
				}
			}
		]

		expect(buildRatesChart(points, false)?.dataset.source).toEqual([[Date.UTC(2026, 0, 1), 3, null, -2]])
	})
})
