import * as React from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingIndicator } from '~/ui/Status'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
import { researchHallmarks } from './chartHallmarks'
import type { ExchangeResearchChartModel } from './models'
import type { ResearchPresentation } from './researchPresentation'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const EXCHANGE_COLORS = ['#5c9cf5', '#9b7cf7', '#33b38f', '#e48b52', '#d76184', '#58a8b8', '#d6a84b', '#7b8f52']
const OTHER_COLOR = '#8b8f97'
export const RESEARCH_SERIES_PALETTE = [...EXCHANGE_COLORS, OTHER_COLOR]
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
 * it landed in. Anything not named here falls through to the index palette.
 *
 * ponytail: a flat map, not a token per venue — these are third-party brand colours, not
 * ours to systematize. Add a row when a venue starts reaching a top-eight slot.
 *
 * `btc-spot` / `btc-usd-perp` / `btc-coin-perp` are deliberately absent: they are three
 * BTC series on one chart, so brand orange would make all three the same line.
 */
const BRAND_COLORS: Record<string, string> = {
	// Assets. the leftover `other` line takes the neutral via researchSeriesColor's fallback.
	btc: '#f7931a',
	eth: '#627eea',
	// Venues.
	binance: '#f3ba2f',
	bybit: '#f7a600',
	// OKX's brand is black, which disappears on the dark theme; this is its lightest
	// readable stand-in rather than a colour they actually publish.
	okx: '#b4bcc8',
	coinbase: '#0052ff',
	kraken: '#7132f5',
	bitget: '#00e8d0',
	gate: '#17e6a1',
	mexc: '#00b897',
	htx: '#1b8fe3',
	kucoin: '#24ae8f',
	hyperliquid: '#50d2c1',
	upbit: '#1e5eff',
	'crypto-com': '#03316c',
	bitfinex: '#16b157',
	dydx: '#6966ff',
	deribit: '#04a7c8',
	bingx: '#2b5cff'
}

export function researchSeriesColor(lineId: string, index: number): string {
	const brand = BRAND_COLORS[lineId]
	if (brand) return brand
	return lineId === 'other' ? OTHER_COLOR : (EXCHANGE_COLORS[index % EXCHANGE_COLORS.length] ?? OTHER_COLOR)
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
	const chartModel = React.useMemo(
		() =>
			buildAlignedCartesianChartModel(
				chart.days,
				chart.lines.map((line, index) => ({
					name: line.label,
					type: 'line' as const,
					color: researchSeriesColor(line.id, index),
					areaStyle: { opacity: 0 },
					values: chart.days.map((_, dayIndex) => {
						const value = line.values[dayIndex]
						return value == null ? null : researchChartDisplayValue(value, chart.valueSymbol)
					})
				}))
			),
		[chart]
	)
	const hallmarks = React.useMemo(() => researchHallmarks(chart.metric), [chart.metric])
	return (
		<ResearchChartFrame title={chart.title} description={chart.description} toolbar={toolbar} updatedAt={chart.builtAt}>
			<React.Suspense
				fallback={
					<ChartPanelBodyFallback>
						<LoadingIndicator />
					</ChartPanelBodyFallback>
				}
			>
				<ChartPanelBody role="img" aria-label={researchChartAriaLabel(chart)}>
					<MultiSeriesChart
						dataset={chartModel.dataset}
						charts={chartModel.charts}
						valueSymbol={chart.valueSymbol}
						height="360px"
						hideDefaultLegend={false}
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
	status
}: {
	presentation: ResearchPresentation
	toolbar?: React.ReactNode
	status: 'loading' | 'error'
}) {
	return (
		<ResearchChartFrame title={presentation.title} description={presentation.description} toolbar={toolbar}>
			<ChartPanelBodyFallback
				role={status === 'error' ? 'alert' : 'status'}
				aria-live={status === 'error' ? undefined : 'polite'}
				className={status === 'error' ? 'body-sm text-data-down' : undefined}
			>
				{status === 'error' ? 'Failed to load this chart.' : <LoadingIndicator />}
			</ChartPanelBodyFallback>
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
