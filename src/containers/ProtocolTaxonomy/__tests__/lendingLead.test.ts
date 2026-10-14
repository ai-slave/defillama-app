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
			'Lending protocols let users deposit assets and borrow against collateral. Borrowers pay interest and can be liquidated if that collateral falls short. On Oct 14, 2026 the lending category held $53.1b across 655 protocols.'
		)
	})

	test('keeps the definition when the chart has no TVL', () => {
		expect(lendingIntro({ dateSec: DATE, tvl: null, protocolCount: 655 })).toBe(
			'Lending protocols let users deposit assets and borrow against collateral. Borrowers pay interest and can be liquidated if that collateral falls short.'
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
			'Lending protocols let users deposit assets and borrow against collateral. Borrowers pay interest and can be liquidated if that collateral falls short.'
		)
	})

	test('keeps the chain on a lending page', () => {
		const presentation = getProtocolCategoryPresentation({
			label: 'Lending',
			effectiveCategory: 'Lending',
			chain: 'Ethereum',
			protocolCount: 10,
			year: 2026
		})

		expect(presentation.seoDescription).toBe(
			"Compare 10 Lending protocols on Ethereum. Rank DefiLlama's directory by TVL, fees, revenue, volume, chains, and more."
		)
	})

	test('keeps the rankings and the chain when another category description does not fit', () => {
		const presentation = getProtocolCategoryPresentation({
			label: 'Cross Chain Bridge',
			effectiveCategory: 'Cross Chain Bridge',
			chain: 'Ethereum',
			protocolCount: 10,
			year: 2026
		})

		expect(presentation.seoDescription).toBe(
			"Compare 10 Cross-Chain Bridges protocols on Ethereum. Rank DefiLlama's directory by TVL, fees, revenue, volume, chains, and more."
		)
	})

	test('appends a short description after the rankings clause', () => {
		const presentation = getProtocolCategoryPresentation({
			label: 'MEV',
			effectiveCategory: 'MEV',
			protocolCount: 3,
			year: 2026
		})

		expect(presentation.seoDescription).toBe(
			"Compare 3 MEV protocols across all chains. Rank DefiLlama's directory by TVL, fees, revenue, volume, chains, and more. MEV Layer"
		)
	})
})
