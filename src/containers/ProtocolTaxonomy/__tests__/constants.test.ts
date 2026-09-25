import { describe, expect, test } from 'vitest'
import { getProtocolCategoryChartMetrics, getProtocolCategoryColumns, protocolCategoryConfig } from '../constants'

describe('ProtocolTaxonomy constants', () => {
	test('charts TVL unless a category opts out with tvl: false', () => {
		expect(getProtocolCategoryChartMetrics('Physical TCG')).not.toContain('tvl')
		expect(getProtocolCategoryChartMetrics('Physical TCG')).toContain('revenue')
		expect(getProtocolCategoryChartMetrics('Services')).toContain('tvl')
		expect(getProtocolCategoryChartMetrics('Not A Category')).toEqual(['tvl'])
		expect(getProtocolCategoryChartMetrics(null)).toEqual(['tvl'])
	})

	test('keeps every configured default sort backed by a visible category column', () => {
		const sorted = Object.entries(protocolCategoryConfig).flatMap(([category, config]) =>
			config?.defaultSort ? [{ category, defaultSort: config.defaultSort }] : []
		)

		expect(sorted.length).toBeGreaterThan(0)
		expect(
			sorted.filter(({ category, defaultSort }) => !getProtocolCategoryColumns(category).includes(defaultSort))
		).toEqual([])
	})
})
