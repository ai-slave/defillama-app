import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { OTHERS_COLOR } from '~/constants/colors'
import type { RefRatePoint } from './fetch'

// Chart series colors, [light, dark] per theme. Supply/Borrow are the app's up/down text steps
// (emerald-11, crimson-11: --text-data-up/down, which --apy-mid/--apy-very read), so the rates chart
// matches the sparklines, signed APYs and the pool chart's `accent`/`warn` series. ECharts needs
// literals, so the ramp hex is inlined; keep it in sync with src/styles/primitives.css.
const RATES_COLORS = {
	supply: ['#016d3c', '#12b167'],
	borrow: ['#bd0a31', '#ff686f'],
	spread: [OTHERS_COLOR, OTHERS_COLOR]
} as const

function ms(date: string): number {
	return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date)
}

export interface RatesChartSpec {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
}

export function buildRatesChart(points: Array<RefRatePoint>, isDark = true): RatesChartSpec | null {
	if (points.length === 0) return null
	const theme = isDark ? 1 : 0
	const source = points.map((p) => [ms(p.date), p.rates.supply.apy, p.rates.borrow.apy, p.rates.spread.apy])
	const charts: Array<MultiSeriesChartSeriesConfig> = [
		{
			type: 'line',
			name: 'Supply',
			encode: { x: 0, y: 1 },
			color: RATES_COLORS.supply[theme],
			valueSymbol: '%',
			hideAreaStyle: true
		},
		{
			type: 'line',
			name: 'Borrow',
			encode: { x: 0, y: 2 },
			color: RATES_COLORS.borrow[theme],
			valueSymbol: '%',
			hideAreaStyle: true
		},
		{
			type: 'line',
			name: 'Spread',
			encode: { x: 0, y: 3 },
			color: RATES_COLORS.spread[theme],
			valueSymbol: '%',
			hideAreaStyle: true
		}
	]
	return { dataset: { source, dimensions: ['timestamp', 'Supply', 'Borrow', 'Spread'] }, charts }
}
