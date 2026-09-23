import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { getTooltipRawYValue, normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { formatUsd } from '~/utils/numberFormat'

/**
 * KPK's palette, from the design mockup: mint, periwinkle, amber, cyan, coral, violet,
 * lime, rose — in that hue order.
 *
 * The mockup is a fixed dark page, so its literal hex values do not survive this app's
 * light/dark surfaces (mint `#58e0b0` is 1.65:1 on white). Each hue is therefore re-stepped
 * per theme, and the lightness is deliberately staggered across slots rather than flat:
 * mint and lime are both greens and at equal lightness sit ΔE 7.4 apart, which no legend
 * can rescue for a full-colour reader.
 *
 * Validated with the dataviz palette validator (OKLab ΔE ×100):
 *   dark  (surface #0c0e13) — all checks pass · adjacent CVD ΔE 16.6 · all-pairs normal ΔE 17.8
 *   light (surface #ffffff) — all checks pass · adjacent CVD ΔE 13.0 · all-pairs normal ΔE 15.6
 *
 * All-pairs *CVD* separation sits under the ΔE 8 floor (worst: cyan↔violet). Eight
 * categorical slots cannot clear that on any hue wheel, so it is permitted here only
 * because every chart ships secondary encoding: a legend, and a share table naming each
 * segment beside its swatch, value and share. Do not add a ninth series — fold the tail
 * into "Other" instead. Re-run the validator if you touch these values.
 */
export const KPK_PALETTE_DARK = [
	'#00af82', // mint
	'#7384ef', // periwinkle
	'#b27e00', // amber
	'#007094', // cyan
	'#a52b1e', // coral
	'#7a3c9f', // violet
	'#357800', // lime
	'#ce5a96' // rose
] as const

export const KPK_PALETTE_LIGHT = [
	'#007556',
	'#5865cd',
	'#e9a600',
	'#00a0d2',
	'#94180c',
	'#6b2c8f',
	'#579e31',
	'#b94784'
] as const

export const kpkPalette = (isDark: boolean): ReadonlyArray<string> => (isDark ? KPK_PALETTE_DARK : KPK_PALETTE_LIGHT)

export const KPK_LINE_STROKE_DARK = '#e9ebf0'
export const KPK_LINE_STROKE_LIGHT = '#1f2330'

export const kpkLineStroke = (isDark: boolean): string => (isDark ? KPK_LINE_STROKE_DARK : KPK_LINE_STROKE_LIGHT)

export const KPK_OTHER_DARK = '#363b44'
export const KPK_OTHER_LIGHT = '#b4b8c0'

export interface KpkChartColors {
	palette: ReadonlyArray<string>
	/** The dashed overlay line, e.g. Adjusted TVA. */
	line: string
	/** The folded tail. */
	other: string
}

export const kpkChartColors = (isDark: boolean): KpkChartColors => ({
	palette: kpkPalette(isDark),
	line: kpkLineStroke(isDark),
	other: isDark ? KPK_OTHER_DARK : KPK_OTHER_LIGHT
})

export const KPK_CATEGORY_SLOTS: Readonly<Record<string, number>> = {
	// Chains
	Ethereum: 0,
	dYdX: 1,
	Arbitrum: 2,
	Gnosis: 3,
	Base: 4,
	'BNB Chain': 5,
	Polygon: 6,
	Avalanche: 7,
	// Denominations and supply assets. ETH matches Ethereum, and DYDX the dYdX chain.
	ETH: 0,
	DYDX: 1,
	USD: 2,
	COW: 3,
	NXM: 4,
	EUR: 5,
	wstETH: 1,
	// Protocols and venues
	Morpho: 0,
	'Ether.fi': 1,
	Fluid: 2,
	Stakewise: 3,
	Gearbox: 4,
	Stader: 5,
	Aave: 6
}

/**
 * Brand accents as Tailwind class pairs rather than hex, so they follow `html.dark`
 * without a render-time theme read. Mint carries KPK's own figures, periwinkle the
 * benchmark it is measured against — the same division as the mockup.
 */
export const KPK_MINT_TEXT = 'text-sl-kpk-mint'
export const KPK_MINT_BG = 'bg-sl-kpk-mint'
export const KPK_MINT_BORDER = 'border-sl-kpk-mint/45'
export const KPK_BENCH_TEXT = 'text-sl-kpk-benchmark'
export const KPK_BENCH_BG = 'bg-sl-kpk-benchmark'

const DUST_USD = 0.01

/**
 * Every dollar figure on the dashboard — tiles, table cells, chart tooltips and the
 * totals under them alike — on the app's standard compact precision: two decimals for
 * k/m, three for bn. Named once so the whole dashboard moves together.
 *
 * Lives here rather than in `ui`, which already imports this module.
 */
export const KPK_USD_OPTIONS = { compact: true, compactSuffix: 'lowercase' } as const

const TOTAL_ROW_STYLE = 'border-top:1px solid currentColor;opacity:0.85;margin-top:6px;padding-top:5px;'

/** One tooltip line: marker and name on the left, the figure flush right in tabular digits. */
function tooltipRow(name: string, value: number, marker = '', style = ''): string {
	return (
		`<li style="list-style:none;display:flex;align-items:center;${style}">${marker}` +
		`<span style="margin-right:16px">${escapeHtml(name)}</span>` +
		`<span style="margin-left:auto;font-variant-numeric:tabular-nums">${formatUsd(value, KPK_USD_OPTIONS) ?? '—'}</span></li>`
	)
}

/**
 * The category tooltip with a stacked total, as the mockup has it: one row per segment,
 * largest first, then a ruled Total. The renderer's own category formatter omits the
 * total, and its time-series formatter — which does add one — cannot label a
 * month-string axis.
 */
function compositionTooltipFormatter(params: unknown, overlaySeries?: string): string {
	const items = normalizeTooltipItems(params)
	if (items.length === 0) return ''

	const rows: Array<{ marker: string; name: string; value: number }> = []
	let overlay: (typeof rows)[number] | null = null

	for (const item of items) {
		const name = item.seriesName
		if (!name) continue
		const raw = getTooltipRawYValue(item, name)
		const value = typeof raw === 'number' ? raw : Number(raw)
		if (!Number.isFinite(value) || Math.abs(value) < DUST_USD) continue
		const row = { marker: item.marker ?? '', name, value }
		if (name === overlaySeries) overlay = row
		else rows.push(row)
	}
	rows.sort((a, b) => b.value - a.value)

	const heading = items[0]?.axisValue ?? items[0]?.name
	let out = heading == null ? '' : `<strong>${escapeHtml(String(heading))}</strong><br/>`
	for (const row of rows) out += tooltipRow(row.name, row.value, row.marker)
	if (rows.length > 1) {
		out += tooltipRow(
			'Total',
			rows.reduce((sum, row) => sum + row.value, 0),
			'',
			TOTAL_ROW_STYLE
		)
	}
	if (overlay) out += tooltipRow(overlay.name, overlay.value, overlay.marker)
	return out
}

/**
 * Period labels are plotted as categories: the payload carries `"Sept 25"` or
 * `"3 Oct 25"`, not a date. Built per breakdown, because only the breakdowns that
 * carry an overlay line need one held out of the total.
 */
export function kpkCompositionChartOptions(overlaySeries?: string): IMultiSeriesChartProps['chartOptions'] {
	const base = createCategoryChartOptions('$')
	return {
		...base,
		xAxis: { ...base.xAxis, axisLabel: { showMaxLabel: true, alignMaxLabel: 'right' } },
		dataZoom: [{}, { labelFormatter: (_index: number, period: string) => period }],
		tooltip: { formatter: (params: unknown) => compositionTooltipFormatter(params, overlaySeries) }
	}
}

/** The shared instance for every breakdown without an overlay line. */
export const KPK_COMPOSITION_CHART_OPTIONS = kpkCompositionChartOptions()
