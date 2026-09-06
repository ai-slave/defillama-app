import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { RefRatePoint } from './fetch'

// Chart series colors, [light, dark] per theme. Supply/Borrow mirror the ONE yields green/red —
// `--apy-mid` (#089981 / #22ab94) and `--apy-very` (#f23645 / #f7525f) from tailwind.css — so the
// rates chart matches the sparklines, stability pills, signed APYs, and the pool-page chart's
// `accent`/`warn` series (ECharts needs literals, so the hex is inlined; keep in sync with the vars).
const RATES_COLORS = {
	supply: ['#089981', '#22ab94'],
	borrow: ['#f23645', '#f7525f'],
	spread: ['#7e8aa0', '#7e8aa0']
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
