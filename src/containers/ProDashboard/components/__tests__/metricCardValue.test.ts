import { expect, test } from 'vitest'
import { formatMetricValue, getMetricDelta, getMetricValueFormat } from '../metricCardValue'

test('a metric reads as USD, a count or a percent unless a saved format says otherwise', () => {
	expect(getMetricValueFormat({ type: 'tvl', aggregator: 'avg' })).toBe('currency')
	expect(getMetricValueFormat({ type: 'txs', aggregator: 'sum' })).toBe('number')
	expect(getMetricValueFormat({ type: 'medianApy', aggregator: 'latest' })).toBe('percent')
	expect(getMetricValueFormat({ type: 'tvl', aggregator: 'growth' })).toBe('percent')
	expect(getMetricValueFormat({ type: 'tvl', aggregator: 'growth', format: { value: 'number' } })).toBe('number')
	expect(getMetricValueFormat({ type: 'txs', aggregator: 'sum', format: { value: 'auto' } })).toBe('number')
})

test('values compact from a million and a missing value reads as a dash', () => {
	expect(formatMetricValue(1_500_000_000, 'currency')).toBe('$1.5b')
	expect(formatMetricValue(950_000, 'number')).toBe('950,000')
	expect(formatMetricValue(12.345, 'percent')).toBe('12.35%')
	expect(formatMetricValue(null, 'currency')).toBe('-')
})

test('a percent change carries its sign and arrow, and a change below two decimals shows no badge', () => {
	expect(getMetricDelta(null, 12.5, 'currency', 'percent')).toEqual({ direction: 'up', label: '▲+12.50%' })
	expect(getMetricDelta(null, -4, 'currency', 'percent')).toEqual({ direction: 'down', label: '▼-4.00%' })
	expect(getMetricDelta(null, 0.001, 'currency', 'percent')).toEqual({ direction: 'up', label: null })
	expect(getMetricDelta(null, null, 'currency', 'percent')).toEqual({ direction: 'flat', label: null })
})

test('an absolute change reads in the metric unit, and percent metrics change in points', () => {
	expect(getMetricDelta(2_000_000, 10, 'currency', 'absolute')).toEqual({ direction: 'up', label: '▲$2m' })
	expect(getMetricDelta(-1.25, -5, 'percent', 'absolute')).toEqual({ direction: 'down', label: '▼-1.25pp' })
	expect(getMetricDelta(0.001, 1, 'percent', 'absolute')).toEqual({ direction: 'up', label: null })
	expect(getMetricDelta(null, 3, 'currency', 'absolute')).toEqual({ direction: 'up', label: null })
})
