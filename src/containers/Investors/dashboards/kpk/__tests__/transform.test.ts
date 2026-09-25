import { describe, expect, test } from 'vitest'
import type { KpkComposition, KpkRangedComposition } from '../api'
import { KPK_LINE_STROKE_DARK, KPK_OTHER_DARK, KPK_PALETTE_DARK, kpkChartColors } from '../chartDefaults'
import {
	asRanged,
	buildComposition as build,
	compositionColors,
	defaultRange,
	gapNote,
	MILLION,
	PERIOD_DIMENSION,
	rangeOptions
} from '../transform'

const buildComposition = (comp: KpkComposition, colorNames?: ReadonlyArray<string>) =>
	build(comp, kpkChartColors(true), colorNames)

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

	// Names on a single graph take free slots in name order, so the union across ranges
	// has to decide them — not whichever range happens to be on screen.
	test('keeps a surviving segment colour when another range drops an earlier name', () => {
		const colorNames = ['Balancer', 'Euler', 'Euler']
		const widest = buildComposition(
			{
				...comp,
				segments: [{ name: 'Balancer', value: 10, share: 33.3333, series: [5, 7.5, 10] }, comp.segments[1]]
			},
			colorNames
		)
		const shortest = buildComposition({ ...comp, segments: [comp.segments[1]] }, colorNames)

		expect(shortest.rows[0].color).toBe(widest.rows[1].color)
		expect(shortest.rows[0].color).toBe(KPK_PALETTE_DARK[1])
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

	test("carries a band's own note where the payload states one", () => {
		const note = 'Symbiotic allocates into another KPK vault.'
		const model = buildComposition({
			...withLine,
			segments: [withLine.segments[0], { ...withLine.segments[1], note }]
		})

		expect(model.rows.map((row) => row.note)).toEqual([undefined, note])
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

describe('asRanged', () => {
	const ranged: KpkRangedComposition = { title: 'By venue', ranges: { max: comp } }

	test('passes a ranged payload through untouched', () => {
		expect(asRanged(ranged)).toBe(ranged)
	})

	test('lifts a pre-range composition into a lone max range', () => {
		const lifted = asRanged(comp)

		expect(lifted).toEqual({ title: 'By venue', ranges: { max: comp } })
		expect(rangeOptions(lifted)).toEqual([{ key: 'max', label: 'Max' }])
		expect(asRanged(undefined)).toBeUndefined()
	})
})

describe('rangeOptions and defaultRange', () => {
	const ranged: KpkRangedComposition = {
		title: 'By client',
		ranges: { '1m': comp, ytd: comp, max: comp }
	}

	test('offers a chip only for the ranges the payload carries, shortest first', () => {
		expect(rangeOptions(ranged)).toEqual([
			{ key: '1m', label: '1M' },
			{ key: 'ytd', label: 'YTD' },
			{ key: 'max', label: 'Max' }
		])
	})

	test('opens on the widest span available', () => {
		expect(defaultRange(ranged)).toBe('max')
		expect(defaultRange({ title: 'By client', ranges: { '1m': comp, '3m': comp } })).toBe('3m')
	})

	test('has no range to open on for an empty payload', () => {
		expect(defaultRange({ title: 'By client', ranges: {} })).toBeUndefined()
		expect(rangeOptions(undefined)).toEqual([])
	})
})

describe('gapNote', () => {
	test('names the days the line joins across', () => {
		const note = gapNote({
			...comp,
			window: {
				from: '2026-06-01',
				to: '2026-08-31',
				days: 78,
				points: 78,
				gaps: [{ from: '2026-07-06', to: '2026-07-19', days: 14 }],
				missingDays: 14
			}
		})

		expect(note).toBe('14 days missing between Jul 6, 2026 and Jul 19, 2026 — the line joins straight across it.')
	})

	test('says nothing for a range with no holes, or none measured at all', () => {
		expect(
			gapNote({
				...comp,
				window: { from: '2026-06-01', to: '2026-08-31', days: 92, points: 92, gaps: [], missingDays: 0 }
			})
		).toBe('')
		expect(gapNote(comp)).toBe('')
		expect(gapNote(undefined)).toBe('')
	})
})

describe('compositionColors', () => {
	const theme = kpkChartColors(true)
	const colorsOf = (names: ReadonlyArray<string>) => compositionColors(names, theme)

	test('assigns one distinct colour per segment', () => {
		const colors = colorsOf(['Morpho', 'Euler', 'Gearbox'])

		expect(Object.keys(colors)).toHaveLength(3)
		expect(new Set(Object.values(colors)).size).toBe(3)
	})

	test('paints a recurring category the same whatever else shares its graph', () => {
		const vaultsChain = colorsOf(['Ethereum', 'Arbitrum'])
		const overviewChain = colorsOf(['Ethereum', 'dYdX', 'Gnosis', 'Arbitrum', 'Base', 'Other (2)'])

		expect(vaultsChain.Ethereum).toBe(overviewChain.Ethereum)
		expect(vaultsChain.Arbitrum).toBe(overviewChain.Arbitrum)
	})

	test('keeps single-graph categories off the slots the recurring ones hold', () => {
		const colors = colorsOf(['Morpho', 'Gearbox', 'Symbiotic', 'Euler'])

		expect(new Set(Object.values(colors)).size).toBe(4)
	})

	test('paints every folded tail the neutral, whatever count it carries, and spends no slot on it', () => {
		const colors = colorsOf(['Other (15)', 'Euler', 'Other (27)'])

		expect(colors['Other (15)']).toBe(KPK_OTHER_DARK)
		expect(colors['Other (27)']).toBe(KPK_OTHER_DARK)
		expect(colors.Euler).toBe(KPK_PALETTE_DARK[0])
	})

	/** Every breakdown's membership as the payloads carried it in Sep 2026, union across ranges. */
	const LIVE_BREAKDOWNS: Record<string, Array<string>> = {
		'overview.line': ['Treasury mandates', 'Vaults', 'Mandates in KPK vaults/funds', 'Vaults in KPK vaults'],
		'overview.denom': [
			'ETH',
			'USD',
			'DYDX',
			'COW',
			'ARS',
			'NXM',
			'EUR',
			'Other (5)',
			'Other (8)',
			'Other (9)',
			'Other (68)'
		],
		'overview.chain': [
			'Ethereum',
			'dYdX',
			'Gnosis',
			'Arbitrum',
			'Base',
			'BNB Chain',
			'Polygon',
			'Avalanche',
			'Other (2)'
		],
		'overview.protocol': [
			'Morpho',
			'Ether.fi',
			'Fluid',
			'Stakewise',
			'Stader',
			'Gearbox',
			'Aave',
			'Other (15)',
			'Other (27)'
		],
		'mandates.client': [
			'ENS DAO',
			'CoW DAO',
			'dYdX',
			'Balancer DAO',
			'Nexus Mutual DAO',
			'Arbitrum DAO',
			'Gnosis DAO',
			'Aave DAO',
			'Safe-Gnosis JT'
		],
		'mandates.denom': ['USD', 'ETH', 'DYDX', 'COW', 'NXM', 'EUR', 'STKAAVE', 'Other (4)', 'Other (67)'],
		'mandates.protocol': ['Ether.fi', 'Fluid', 'Stakewise', 'Morpho', 'Stader', 'Aave', 'dYdX Staking', 'Other (14)'],
		'mandates.chain': [
			'Ethereum',
			'dYdX',
			'Gnosis',
			'Arbitrum',
			'Base',
			'BNB Chain',
			'Polygon',
			'Avalanche',
			'Optimism'
		],
		'vaults.venue': ['Morpho', 'Gearbox', 'Symbiotic', 'Euler'],
		'vaults.chain': ['Ethereum', 'Arbitrum'],
		'vaults.asset': ['USDC', 'wstETH', 'ETH', 'wARS', 'USDT', 'EURC', 'EURe'],
		'vaults.collateral': [
			'savETH',
			'cbBTC',
			'WBTC',
			'wstETH',
			'savUSD',
			'wmooCurveETH+-WETH',
			'Unallocated',
			'Other (26)'
		]
	}

	test('gives every category on a live graph its own colour, as far as eight slots allow', () => {
		for (const names of Object.values(LIVE_BREAKDOWNS)) {
			const colors = colorsOf(names)
			const categories = names.filter((name) => !name.startsWith('Other ('))
			const distinct = new Set(categories.map((name) => colors[name])).size

			expect(distinct).toBe(Math.min(categories.length, KPK_PALETTE_DARK.length))
		}
	})

	test('paints each category one colour across every live graph it appears on', () => {
		const seen = new Map<string, Set<string>>()
		for (const names of Object.values(LIVE_BREAKDOWNS)) {
			for (const [name, color] of Object.entries(colorsOf(names))) {
				seen.set(name, (seen.get(name) ?? new Set()).add(color))
			}
		}
		const repainted = [...seen].filter(([, colors]) => colors.size > 1).map(([name]) => name)

		expect(repainted).toEqual([])
	})
})
