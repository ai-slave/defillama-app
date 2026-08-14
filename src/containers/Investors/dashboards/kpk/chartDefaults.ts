import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { formatTooltipValue } from '~/components/ECharts/shared/formatters'
import { getTooltipRawYValue, normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'

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

export const kpkPalette = (isDark: boolean): readonly string[] => (isDark ? KPK_PALETTE_DARK : KPK_PALETTE_LIGHT)

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

/** Compact USD for chart axes and tooltips, matching the page's `$47.27m` house style. */
function chartUsd(value: number): string {
	return formatTooltipValue(value, '$')
}

/**
 * The category tooltip with a stacked total, as the mockup has it: one row per segment,
 * then a ruled Total. The renderer's own category formatter omits the total, and its
 * time-series formatter — which does add one — cannot label a month-string axis.
 */
function categoryTotalTooltipFormatter(params: unknown): string {
	const items = normalizeTooltipItems(params)
	if (items.length === 0) return ''

	const heading = items[0]?.axisValue ?? items[0]?.name
	let out = heading == null ? '' : `<strong>${heading}</strong><br/>`
	let total = 0
	let counted = 0

	for (const item of items) {
		const name = item.seriesName
		if (!name) continue
		const raw = getTooltipRawYValue(item, name)
		const value = typeof raw === 'number' ? raw : Number(raw)
		if (!Number.isFinite(value) || value === 0) continue
		total += value
		counted += 1
		out += `<li style="list-style:none">${item.marker ?? ''}${name}&nbsp;&nbsp;${chartUsd(value)}</li>`
	}

	if (counted > 1) {
		out += `<li style="list-style:none;border-top:1px solid currentColor;opacity:0.85;margin-top:6px;padding-top:5px">Total&nbsp;&nbsp;${chartUsd(total)}</li>`
	}
	return out
}

/** Month labels are plotted as categories: the payload carries `"Sept 25"`, not a date. */
export const KPK_MONTHLY_USD_CHART_OPTIONS: IMultiSeriesChartProps['chartOptions'] = {
	...createCategoryChartOptions('$'),
	tooltip: { formatter: categoryTotalTooltipFormatter }
}
