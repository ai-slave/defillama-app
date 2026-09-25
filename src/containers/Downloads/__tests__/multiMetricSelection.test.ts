import { describe, expect, test } from 'vitest'
import { pruneUnavailableMetrics, resolveActiveMetric } from '~/containers/Downloads/MultiMetricModal'

const available = (...slugs: Array<string>) => slugs.map((slug) => ({ slug }))

describe('pruneUnavailableMetrics', () => {
	test('drops selections the param no longer offers', () => {
		expect(pruneUnavailableMetrics(['tvl', 'fees'], available('tvl'))).toEqual(['tvl'])
	})

	test('keeps the same array when every selection is still available', () => {
		const selected = ['tvl', 'fees']
		expect(pruneUnavailableMetrics(selected, available('tvl', 'fees', 'revenue'))).toBe(selected)
	})
})

describe('resolveActiveMetric', () => {
	test('keeps the highlighted metric while it is still selected', () => {
		expect(resolveActiveMetric('fees', ['tvl', 'fees'])).toBe('fees')
	})

	test('falls back to the first selected metric when the highlight is gone', () => {
		expect(resolveActiveMetric('fees', ['tvl', 'revenue'])).toBe('tvl')
	})

	test('clears the highlight when nothing is selected', () => {
		expect(resolveActiveMetric('fees', [])).toBeNull()
	})
})
