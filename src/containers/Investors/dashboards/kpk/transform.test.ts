import { describe, expect, it } from 'vitest'
import type { KpkComposition, KpkVault } from './api'
import { KPK_PALETTE_DARK } from './chartDefaults'
import { buildComposition as build, compositionColors, MILLION, MONTH_DIMENSION, vaultTotals } from './transform'

const buildComposition = (comp: KpkComposition) => build(comp, KPK_PALETTE_DARK)

const comp: KpkComposition = {
	title: 'By venue',
	total: 30,
	months: ['Jun 26', 'Jul 26', 'Aug 26'],
	segments: [
		{ name: 'Morpho', value: 20, share: 66.6667, series: [10, 15, 20] },
		{ name: 'Euler', value: 10, share: 33.3333, series: [5, 7.5, 10] }
	]
}

function vault(overrides: Partial<KpkVault>): KpkVault {
	return {
		name: 'Vault',
		venue: 'Morpho',
		chain: 'Ethereum',
		asset: 'USDC',
		tva: 0,
		interest: 0,
		liqTarget: 15,
		spreadBps: null,
		belowTarget: false,
		health: 'ok',
		...overrides
	}
}

describe('buildComposition', () => {
	it('plots month labels as categories with one stacked band per segment', () => {
		const model = buildComposition(comp)

		expect(model.dataset.dimensions).toEqual([MONTH_DIMENSION, 'Morpho', 'Euler'])
		expect(model.dataset.source).toEqual([
			['Jun 26', 10 * MILLION, 5 * MILLION],
			['Jul 26', 15 * MILLION, 7.5 * MILLION],
			['Aug 26', 20 * MILLION, 10 * MILLION]
		])
		expect(model.charts.map((chart) => [chart.name, chart.stack, chart.encode.x])).toEqual([
			['Morpho', 'total', MONTH_DIMENSION],
			['Euler', 'total', MONTH_DIMENSION]
		])
	})

	it('converts $m payload values to absolute USD', () => {
		const model = buildComposition(comp)

		expect(model.totalUsd).toBe(30 * MILLION)
		expect(model.rows.map((row) => row.valueUsd)).toEqual([20 * MILLION, 10 * MILLION])
	})

	it('keeps the payload order for the breakdown table', () => {
		expect(buildComposition(comp).rows.map((row) => row.name)).toEqual(['Morpho', 'Euler'])
	})

	it('carries a missing point through as a gap rather than zero', () => {
		const sparse: KpkComposition = {
			...comp,
			segments: [{ name: 'Morpho', value: 20, share: 100, series: [10, undefined as unknown as number, 20] }]
		}

		expect(buildComposition(sparse).dataset.source[1]).toEqual(['Jul 26', null])
	})

	it('gives a segment the same colour whatever position it arrives in', () => {
		const reordered: KpkComposition = { ...comp, segments: [comp.segments[1], comp.segments[0]] }
		const byName = new Map(buildComposition(comp).rows.map((row) => [row.name, row.color]))

		for (const row of buildComposition(reordered).rows) {
			expect(row.color).toBe(byName.get(row.name))
		}
	})
})

describe('compositionColors', () => {
	it('assigns one distinct colour per segment', () => {
		const colors = compositionColors(['Morpho', 'Euler', 'Gearbox'], KPK_PALETTE_DARK)

		expect(Object.keys(colors)).toHaveLength(3)
		expect(new Set(Object.values(colors)).size).toBe(3)
	})
})

describe('vaultTotals', () => {
	it('sums the rows on screen and converts to USD', () => {
		const totals = vaultTotals([
			vault({ tva: 20.5, interest: 0.25 }),
			vault({ tva: 9.5, interest: 0.75, venue: 'Euler' })
		])

		expect(totals.tvaUsd).toBe(30 * MILLION)
		expect(totals.interestUsd).toBe(1 * MILLION)
	})

	it('returns zeroes for an empty filter result', () => {
		expect(vaultTotals([])).toEqual({ tvaUsd: 0, interestUsd: 0 })
	})
})
