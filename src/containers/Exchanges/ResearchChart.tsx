import * as React from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { ASSET_BRAND_COLORS, chartColor, OTHERS_COLOR } from '~/constants/colors'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBody,
	ChartPanelBodyError,
	ChartPanelBodyLoading,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
import type { QueryRetry } from '~/utils/query'
import { researchHallmarks } from './chartHallmarks'
import type { ExchangeResearchChartModel } from './models'
import type { ResearchPresentation } from './researchPresentation'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const UTC_DAY = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })
const UTC_TIMESTAMP = new Intl.DateTimeFormat('en', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: 'UTC',
	timeZoneName: 'short'
})

export function researchChartDisplayValue(value: number, symbol: ExchangeResearchChartModel['valueSymbol']): number {
	return symbol === '%' ? value * 100 : value
}

function accessibleValue(value: number, symbol: ExchangeResearchChartModel['valueSymbol']) {
	return symbol === '$'
		? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		: `${formatPercent(researchChartDisplayValue(value, symbol), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
}

/**
 * Brand and asset colors, keyed by the line id the mappers emit. A venue keeps the same
 * colour on every chart it appears in, and BTC reads as BTC rather than as whatever slot
 * it landed in. Anything not named here takes the chart palette colour for its rank.
 *
 * Each is [light, dark]: a brand under 3:1 on a chart background in one mode moves its
 * lightness (OKLCH, same hue) just far enough there; a brand that passes keeps its hex.
 *
 * ponytail: a flat map, not a token per venue — these are third-party brand colours, not
 * ours to systematize. Add a row when a venue starts reaching a top-eight slot.
 *
 * `btc-spot` / `btc-usd-perp` / `btc-coin-perp` are deliberately absent: they are three
 * BTC series on one chart, so brand orange would make all three the same line.
 */
const BRAND_COLORS: Record<string, readonly [light: string, dark: string]> = {
	// Assets. the leftover `other` line takes the neutral via researchSeriesColor's fallback.
	btc: ASSET_BRAND_COLORS.Bitcoin,
	eth: ASSET_BRAND_COLORS.Ethereum,
	// Venues.
	binance: ['#b6880f', '#f3ba2f'],
	bybit: ['#c1820b', '#f7a600'],
	// OKX's brand is black, which disappears on the dark theme; this is its lightest
	// readable stand-in rather than a colour they actually publish.
	okx: ['#88909b', '#b4bcc8'],
	coinbase: ['#0052ff', '#0052ff'],
	kraken: ['#7132f5', '#7132f5'],
	bitget: ['#17a08f', '#00e8d0'],
	gate: ['#0ea371', '#17e6a1'],
	mexc: ['#12a285', '#00b897'],
	htx: ['#1b8fe3', '#1b8fe3'],
	kucoin: ['#04a284', '#24ae8f'],
	hyperliquid: ASSET_BRAND_COLORS.Hyperliquid,
	upbit: ['#1e5eff', '#1e5eff'],
	'crypto-com': ['#03316c', '#3763a2'],
	bitfinex: ['#03a54f', '#16b157'],
	dydx: ['#6966ff', '#6966ff'],
	deribit: ['#199cba', '#04a7c8'],
	bingx: ['#2b5cff', '#2b5cff']
}

export function researchSeriesColor(lineId: string, index: number, isDark: boolean): string {
	const brand = BRAND_COLORS[lineId]
	if (brand) return brand[isDark ? 1 : 0]
	return lineId === 'other' ? OTHERS_COLOR : chartColor(index)
}

export function researchChartAriaLabel(chart: ExchangeResearchChartModel): string {
	const lines = chart.lines.map((line) => {
		const first = line.values.findIndex((value) => value != null)
		const last = line.values.findLastIndex((value) => value != null)
		const firstValue = line.values[first]
		const lastValue = line.values[last]
		const firstDay = chart.days[first]
		const lastDay = chart.days[last]
		if (firstValue == null || lastValue == null || firstDay === undefined || lastDay === undefined) {
			return `${line.label}: no observations.`
		}
		const latest = `${accessibleValue(lastValue, chart.valueSymbol)} on ${UTC_DAY.format(new Date(lastDay * 1000))}`
		if (first === last) return `${line.label}: ${latest}.`
		const earliest = `${accessibleValue(firstValue, chart.valueSymbol)} on ${UTC_DAY.format(new Date(firstDay * 1000))}`
		return `${line.label}: from ${earliest} to ${latest}.`
	})
	return `${chart.title}. ${chart.description} ${lines.join(' ')}`
}

export function ResearchChart({ chart, toolbar }: { chart: ExchangeResearchChartModel; toolbar?: React.ReactNode }) {
	const [isDark] = useDarkModeManager()
	const chartModel = React.useMemo(
		() =>
			buildAlignedCartesianChartModel(
				chart.days,
				chart.lines.map((line, index) => ({
					name: line.label,
					type: 'line' as const,
					color: researchSeriesColor(line.id, index, isDark),
					areaStyle: { opacity: 0 },
					values: chart.days.map((_, dayIndex) => {
						const value = line.values[dayIndex]
						return value == null ? null : researchChartDisplayValue(value, chart.valueSymbol)
					})
				}))
			),
		[chart, isDark]
	)
	const hallmarks = React.useMemo(() => researchHallmarks(chart.metric), [chart.metric])
	return (
		<ResearchChartFrame title={chart.title} description={chart.description} toolbar={toolbar} updatedAt={chart.builtAt}>
			<React.Suspense fallback={<ChartPanelBodyLoading />}>
				<ChartPanelBody role="img" aria-label={researchChartAriaLabel(chart)}>
					<MultiSeriesChart
						dataset={chartModel.dataset}
						charts={chartModel.charts}
						valueSymbol={chart.valueSymbol}
						containerClassName={CHART_FILL}
						showLegend
						exportButtons="hidden"
						hallmarks={hallmarks}
					/>
				</ChartPanelBody>
			</React.Suspense>
		</ResearchChartFrame>
	)
}

export function ResearchChartStatus({
	presentation,
	toolbar,
	failedRead
}: {
	presentation: ResearchPresentation
	toolbar?: React.ReactNode
	/** The read that failed, for the chart's Try again; null while the chart loads. */
	failedRead: QueryRetry | null
}) {
	return (
		<ResearchChartFrame title={presentation.title} description={presentation.description} toolbar={toolbar}>
			{failedRead ? (
				<ChartPanelBodyError retry={failedRead}>Couldn&apos;t load this chart.</ChartPanelBodyError>
			) : (
				<ChartPanelBodyLoading />
			)}
		</ResearchChartFrame>
	)
}

function ResearchChartFrame({
	title,
	description,
	toolbar,
	updatedAt,
	children
}: {
	title: string
	description: string
	toolbar?: React.ReactNode
	updatedAt?: string | null
	children: React.ReactNode
}) {
	return (
		<ChartPanel className="flex-1">
			<ChartPanelToolbar className="items-start">
				<div className="mr-auto flex min-w-0 basis-full flex-col">
					<h2 className="heading-xs">{title}</h2>
					<p className="body-sm text-secondary">{description}</p>
				</div>
				{toolbar}
			</ChartPanelToolbar>
			{children}
			{/* Loading and error cards keep the same mobile-wrapping chrome as the ready chart. */}
			<p
				aria-hidden={updatedAt ? undefined : true}
				className={`px-2 pt-0 pb-2 text-right body-sm text-tertiary ${updatedAt ? '' : 'invisible'}`.trim()}
			>
				{updatedAt ? `Last updated ${UTC_TIMESTAMP.format(new Date(updatedAt))}` : 'Last updated'}
			</p>
		</ChartPanel>
	)
}
