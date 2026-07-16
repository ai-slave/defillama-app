import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
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
	const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : new Date(date)
	return d.getTime()
}

export interface RatesChartSpec {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
}

export function buildRatesChart(points: RefRatePoint[], isDark = true): RatesChartSpec | null {
	if (!points.length) return null
	const theme = isDark ? 1 : 0
	const source = points.map((p) => ({
		timestamp: ms(p.date),
		Supply: p.rates.supply.apy,
		Borrow: p.rates.borrow.apy,
		Spread: p.rates.spread.apy
	}))
	const charts: MultiSeriesChart2SeriesConfig[] = [
		{
			type: 'line',
			name: 'Supply',
			encode: { x: 'timestamp', y: 'Supply' },
			color: RATES_COLORS.supply[theme],
			valueSymbol: '%',
			hideAreaStyle: true
		},
		{
			type: 'line',
			name: 'Borrow',
			encode: { x: 'timestamp', y: 'Borrow' },
			color: RATES_COLORS.borrow[theme],
			valueSymbol: '%',
			hideAreaStyle: true
		},
		{
			type: 'line',
			name: 'Spread',
			encode: { x: 'timestamp', y: 'Spread' },
			color: RATES_COLORS.spread[theme],
			valueSymbol: '%',
			hideAreaStyle: true
		}
	]
	return { dataset: { source, dimensions: ['timestamp', 'Supply', 'Borrow', 'Spread'] }, charts }
}
