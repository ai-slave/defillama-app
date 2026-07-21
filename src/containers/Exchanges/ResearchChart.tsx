import * as React from 'react'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingIndicator } from '~/ui/Status'
import { formattedNum } from '~/utils'
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
	return symbol === '$' ? formattedNum(value, true) : `${formattedNum(researchChartDisplayValue(value, symbol))}%`
}

export function researchSeriesColor(lineId: string, index: number): string {
	return lineId === 'other' ? OTHER_COLOR : EXCHANGE_COLORS[index % EXCHANGE_COLORS.length]
}

export function researchChartAriaLabel(chart: ExchangeResearchChartModel): string {
	const lines = chart.lines.map((line) => {
		const first = line.values.findIndex((value) => value != null)
		const last = line.values.findLastIndex((value) => value != null)
		if (first < 0 || last < 0) return `${line.label}: no observations.`
		const latest = `${accessibleValue(line.values[last] as number, chart.valueSymbol)} on ${UTC_DAY.format(new Date(chart.days[last] * 1000))}`
		if (first === last) return `${line.label}: ${latest}.`
		const earliest = `${accessibleValue(line.values[first] as number, chart.valueSymbol)} on ${UTC_DAY.format(new Date(chart.days[first] * 1000))}`
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
	updatedAt?: string
	children: React.ReactNode
}) {
	return (
		<ChartPanel className="flex-1">
			<ChartPanelToolbar className="items-start justify-end">
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
