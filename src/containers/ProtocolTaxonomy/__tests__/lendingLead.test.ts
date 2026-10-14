import { describe, expect, test } from 'vitest'
import { getProtocolCategoryPresentation } from '../constants'
import { categoryChartTvl, lendingIntro } from '../lendingLead'
import type { ProtocolTaxonomyCharts } from '../types'

const DATE = Date.UTC(2026, 9, 14) / 1000

const charts = {
	dataset: {
		dimensions: ['timestamp', 'TVL'],
		source: [
			[1, 1],
			[2, 53.1e9]
		]
	},
	charts: []
} as unknown as ProtocolTaxonomyCharts

describe('lendingIntro', () => {
	test('states the category total and the protocol count on the page date', () => {
		expect(lendingIntro({ dateSec: DATE, tvl: categoryChartTvl(charts), protocolCount: 655 })).toBe(
			'Lending protocols let users borrow and lend assets. On Oct 14, 2026 the lending category held $53.1b across 655 protocols.'
		)
	})

	test('keeps the definition when the chart has no TVL', () => {
		expect(lendingIntro({ dateSec: DATE, tvl: null, protocolCount: 655 })).toBe(
			'Lending protocols let users borrow and lend assets.'
		)
	})
})

describe('getProtocolCategoryPresentation lending', () => {
	test('leads the title and description with lending, and keeps the definition inside the snippet cap', () => {
		const presentation = getProtocolCategoryPresentation({
			label: 'Lending',
			effectiveCategory: 'Lending',
			protocolCount: 655,
			year: 2026
		})

		expect(presentation.headingLabel).toBe('DeFi lending and borrowing protocols')
		expect(presentation.seoTitle).toBe('DeFi Lending & Borrowing Protocols - TVL, Fees, & Revenue')
		expect(presentation.seoDescription).toBe(
			'Lending protocols let users borrow and lend assets. Compare 655 of them by TVL, borrows, and fees.'
		)
	})

	test('keeps a definition that no longer fits beside the rankings clause', () => {
		const presentation = getProtocolCategoryPresentation({
			label: 'Cross Chain Bridge',
			effectiveCategory: 'Cross Chain Bridge',
			protocolCount: 10,
			year: 2026
		})

		expect(presentation.seoDescription).toBe(
			'Protocols that transfer assets between different blockchains through pooled liquidity on each network, instead of relying on mint/burn mechanisms'
		)
	})

	test('puts a short definition ahead of the rankings clause', () => {
		const presentation = getProtocolCategoryPresentation({
			label: 'MEV',
			effectiveCategory: 'MEV',
			protocolCount: 3,
			year: 2026
		})

		expect(presentation.seoDescription).toBe(
			"MEV Layer. Compare 3 MEV protocols across all chains. Rank DefiLlama's directory by TVL, fees, revenue, volume, chains, and more."
		)
	})
})
