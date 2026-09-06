import { describe, expect, test } from 'vitest'
import type { KpkComposition, KpkVault } from './api'
import { KPK_LINE_STROKE_DARK, KPK_PALETTE_DARK } from './chartDefaults'
import { buildComposition as build, compositionColors, MILLION, PERIOD_DIMENSION, vaultTotals } from './transform'

const buildComposition = (comp: KpkComposition) => build(comp, KPK_PALETTE_DARK, KPK_LINE_STROKE_DARK)

const comp: KpkComposition = {
	title: 'By venue',
	total: 30,
	months: ['Jun 26', 'Jul 26', 'Aug 26'],
	segments: [
		{ name: 'Morpho', value: 20, share: 66.6667, series: [10, 15, 20] },
		{ name: 'Euler', value: 10, share: 33.3333, series: [5, 7.5, 10] }
	]
}

const withLine: KpkComposition = {
	...comp,
	segments: [comp.segments[0], { ...comp.segments[1], duplicate: true }],
	line: {
		name: 'Adjusted TVA',
		note: 'Nets out Euler, whose assets are already counted inside another venue.',
		value: 20,
		series: [10, 15, 20]
	}
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
		...overrides
	}
}

describe('buildComposition', () => {
	test('plots period labels as categories with one stacked band per segment', () => {
		const model = buildComposition(comp)

		expect(model.dataset.dimensions).toEqual([PERIOD_DIMENSION, 'Morpho', 'Euler'])
		expect(model.dataset.source).toEqual([
			['Jun 26', 10 * MILLION, 5 * MILLION],
			['Jul 26', 15 * MILLION, 7.5 * MILLION],
			['Aug 26', 20 * MILLION, 10 * MILLION]
		])
		expect(model.charts.map((chart) => [chart.name, chart.stack, chart.encode.x])).toEqual([
			['Morpho', 'total', PERIOD_DIMENSION],
			['Euler', 'total', PERIOD_DIMENSION]
		])
	})

	test('converts $m payload values to absolute USD', () => {
		const model = buildComposition(comp)

		expect(model.totalUsd).toBe(30 * MILLION)
		expect(model.rows.map((row) => row.valueUsd)).toEqual([20 * MILLION, 10 * MILLION])
	})

	test('keeps the payload order for the breakdown table', () => {
		expect(buildComposition(comp).rows.map((row) => row.name)).toEqual(['Morpho', 'Euler'])
	})

	test('carries a missing point through as a gap rather than zero', () => {
		const sparse: KpkComposition = {
			...comp,
			segments: [{ name: 'Morpho', value: 20, share: 100, series: [10, undefined as unknown as number, 20] }]
		}

		expect(buildComposition(sparse).dataset.source[1]).toEqual(['Jul 26', null])
	})

	test('gives a segment the same colour whatever position it arrives in', () => {
		const reordered: KpkComposition = { ...comp, segments: [comp.segments[1], comp.segments[0]] }
		const byName = new Map(buildComposition(comp).rows.map((row) => [row.name, row.color]))

		for (const row of buildComposition(reordered).rows) {
			expect(row.color).toBe(byName.get(row.name))
		}
	})

	test('emits no line for a breakdown that carries none', () => {
		const model = buildComposition(comp)

		expect(model.line).toBeUndefined()
		expect(model.rows.some((row) => row.duplicate)).toBe(false)
	})

	test('adds the overlay line as an unstacked dashed series after the bands', () => {
		const model = buildComposition(withLine)

		expect(model.dataset.dimensions).toEqual([PERIOD_DIMENSION, 'Morpho', 'Euler', 'Adjusted TVA'])
		expect(model.dataset.source[2]).toEqual(['Aug 26', 20 * MILLION, 10 * MILLION, 20 * MILLION])

		const overlay = model.charts[model.charts.length - 1]
		expect(overlay.name).toBe('Adjusted TVA')
		expect(overlay.stack).toBeUndefined()
		expect(overlay.color).toBe(KPK_LINE_STROKE_DARK)
		expect(overlay.lineStyle).toMatchObject({ type: 'dashed' })
		expect(overlay.hideAreaStyle).toBe(true)
		expect(overlay.excludeFromTooltipTotal).toBe(true)
	})

	test('marks the double-counted band and carries the line note for the table', () => {
		const model = buildComposition(withLine)

		expect(model.rows.map((row) => row.duplicate)).toEqual([undefined, true])
		expect(model.line).toEqual({
			name: 'Adjusted TVA',
			note: withLine.line!.note,
			valueUsd: 20 * MILLION
		})
	})

	// A short series would plot as a straight run to zero off the left of the chart
	// rather than as a gap, so it is dropped whole — the footnote and footer stay.
	test('drops a line whose series does not span the axis', () => {
		const model = buildComposition({ ...withLine, line: { ...withLine.line!, series: [20] } })

		expect(model.dataset.dimensions).toEqual([PERIOD_DIMENSION, 'Morpho', 'Euler'])
		expect(model.charts).toHaveLength(2)
		expect(model.line?.name).toBe('Adjusted TVA')
	})
})

describe('compositionColors', () => {
	test('assigns one distinct colour per segment', () => {
		const colors = compositionColors(['Morpho', 'Euler', 'Gearbox'], KPK_PALETTE_DARK)

		expect(Object.keys(colors)).toHaveLength(3)
		expect(new Set(Object.values(colors)).size).toBe(3)
	})
})

describe('vaultTotals', () => {
	test('sums the rows on screen and converts to USD', () => {
		const totals = vaultTotals([
			vault({ tva: 20.5, interest: 0.25 }),
			vault({ tva: 9.5, interest: 0.75, venue: 'Euler' })
		])

		expect(totals.tvaUsd).toBe(30 * MILLION)
		expect(totals.interestUsd).toBe(1 * MILLION)
	})

	test('returns zeroes for an empty filter result', () => {
		expect(vaultTotals([])).toEqual({
			tvaUsd: 0,
			interestUsd: 0,
			tvaAdjustedUsd: 0,
			interestAdjustedUsd: 0,
			duplicateVenues: []
		})
	})

	test('nets a double-counted vault out of the adjusted pair and names its venue', () => {
		const totals = vaultTotals([
			vault({ tva: 20, interest: 0.5 }),
			vault({ tva: 10, interest: 0.25, venue: 'Symbiotic', doubleCounted: true })
		])

		expect(totals.tvaUsd).toBe(30 * MILLION)
		expect(totals.tvaAdjustedUsd).toBe(20 * MILLION)
		expect(totals.interestAdjustedUsd).toBe(0.5 * MILLION)
		expect(totals.duplicateVenues).toEqual(['Symbiotic'])
	})

	test('reports no duplicate venues for a filter that nets out nothing', () => {
		expect(vaultTotals([vault({ tva: 20, interest: 0.5 })]).duplicateVenues).toEqual([])
	})
})
