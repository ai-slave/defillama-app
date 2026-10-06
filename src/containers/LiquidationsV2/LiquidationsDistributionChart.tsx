import type { ECharts } from 'echarts/core'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesChartOptions
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE, CHART_ZOOM_RESERVE } from '~/components/ECharts/shared/chartSpacing'
import { useLocalSelection } from '~/components/Select/localSelection'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type {
	LiquidationsDistributionChartBreakdownKey,
	LiquidationsDistributionChartData,
	LiquidationsDistributionChartView
} from './api.types'
import {
	formatLiquidationMetricValue,
	formatLiquidationPrice,
	getLiquidationsTooltipHtml,
	type LiquidationsMetric
} from './chartTooltip'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type BreakdownMode = 'total' | 'protocol' | 'chain'
type ChartMode = 'cumulative' | 'distribution'
type LiquidationsChartState = {
	token: string | null
	tokenLabel: string
	tokenTotalUsd: number | null
	metric: LiquidationsMetric
	mode: ChartMode
	modeLabel: string
	breakdownMode: BreakdownMode
	breakdownLabel: string
}
const TOKEN_QUERY_PARAM = 'token'
const METRIC_QUERY_PARAM = 'metric'
const BREAKDOWN_QUERY_PARAM = 'breakdown'
const VIEW_QUERY_PARAM = 'view'
const BREAKDOWN_OPTIONS: ReadonlyArray<{ key: BreakdownMode; name: string }> = [
	{ key: 'total', name: 'Total' },
	{ key: 'protocol', name: 'Protocol Breakdown' },
	{ key: 'chain', name: 'Chain Breakdown' }
]
const CHART_MODE_OPTIONS: ReadonlyArray<{ key: ChartMode; name: string }> = [
	{ key: 'cumulative', name: 'Cumulative' },
	{ key: 'distribution', name: 'Distribution' }
]
const DEFAULT_BREAKDOWN_MODES = BREAKDOWN_OPTIONS.map((option) => option.key)

export function LiquidationsDistributionChartFooter({ timestamp }: { timestamp: number }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pb-3 body-sm text-tertiary italic">
			<span>Positions with at least $100k collateral.</span>
			<span className="ml-auto">Snapshot {new Date(timestamp * 1000).toUTCString()}</span>
		</div>
	)
}

function LiquidationsDistributionChartCard({
	availableSeries,
	breakdownOptions,
	chartState,
	deferredChartModel,
	prepareExportDataset,
	displayOptions,
	onChartReady,
	setBreakdownMode,
	setChartMode,
	setMetric,
	selectedSeries,
	setSelectedToken,
	setSelectedSeries,
	timestamp,
	title,
	iconUrl,
	tokenOptions,
	chartInstance
}: {
	availableSeries: Array<string>
	breakdownOptions: Array<{ key: BreakdownMode; name: string }>
	chartState: LiquidationsChartState
	deferredChartModel: {
		dataset: MultiSeriesChartDataset
		charts: NonNullable<IMultiSeriesChartProps['charts']>
		selectedCharts: Set<string>
		chartOptions: NonNullable<IMultiSeriesChartProps['chartOptions']>
		valueSymbol: string
	}
	prepareExportDataset: () => MultiSeriesChartDataset
	displayOptions: {
		hideTokenSelector: boolean
		shouldHideDataZoom: boolean
		showBreakdownLegend: boolean
		showBreakdownSelector: boolean
	}
	onChartReady: (instance: ECharts | null) => void
	setBreakdownMode: (mode: BreakdownMode) => void
	setChartMode: (mode: ChartMode) => void
	setMetric: (metric: LiquidationsMetric) => void
	selectedSeries: Array<string>
	setSelectedToken: (token: string) => void
	setSelectedSeries: React.Dispatch<React.SetStateAction<Array<string>>>
	timestamp: number
	title: string | undefined
	iconUrl: string | undefined
	tokenOptions: Array<{ key: string; name: string }>
	chartInstance: () => ECharts | null
}) {
	const exportFilename = slug(
		[title ?? 'liquidation-distribution', '100k', chartState.token, chartState.modeLabel, chartState.breakdownLabel]
			.filter(Boolean)
			.join('-')
	)
	const seriesLabel = chartState.breakdownMode === 'protocol' ? 'Protocol' : 'Chain'

	return (
		<ChartPanel>
			<ChartPanelToolbar>
				{displayOptions.hideTokenSelector ? (
					<div className="mr-auto" />
				) : (
					<div className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
						<SelectWithCombobox
							heading="Token"
							allValues={tokenOptions}
							selectedValues={chartState.token ? [chartState.token] : []}
							setSelectedValues={(values) => {
								const nextToken = values[0]
								if (nextToken) setSelectedToken(nextToken)
							}}
							label={`Token: ${chartState.tokenLabel}`}
							singleSelect
							labelType="none"
							variant="filter"
							size="md"
						/>
						{chartState.tokenTotalUsd != null ? (
							<span className="body-sm text-secondary">
								Collateral:{' '}
								<span className="font-medium text-primary">
									{formatUsd(chartState.tokenTotalUsd, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
							</span>
						) : null}
					</div>
				)}
				{displayOptions.showBreakdownSelector ? (
					<Select
						heading="Breakdown"
						allValues={breakdownOptions}
						selectedValues={chartState.breakdownMode}
						setSelectedValues={(value: string) => setBreakdownMode(value as BreakdownMode)}
						label={chartState.breakdownLabel}
						labelType="none"
						variant="filter"
						size="md"
					/>
				) : null}
				<SegmentedControl
					value={chartState.mode}
					onValueChange={setChartMode}
					options={[
						{ value: 'cumulative', label: 'Cumulative' },
						{ value: 'distribution', label: 'Distribution' }
					]}
					label="Chart mode"
					variant="default"
					size="md"
				/>
				{availableSeries.length > 1 && chartState.breakdownMode !== 'total' ? (
					<SelectWithCombobox
						allValues={availableSeries}
						selectedValues={selectedSeries}
						setSelectedValues={setSelectedSeries}
						label={seriesLabel}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<SegmentedControl
					value={chartState.metric}
					onValueChange={setMetric}
					options={[
						{ value: 'usd', label: 'USD' },
						{ value: 'amount', label: 'Amount' }
					]}
					label="Value type"
					variant="default"
					size="md"
				/>
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilename}
					title={[
						title ?? 'Liquidation Distribution',
						chartState.token,
						chartState.modeLabel,
						chartState.breakdownLabel
					]
						.filter(Boolean)
						.join(' - ')}
					iconUrl={iconUrl}
					csvSource={{ type: 'dataset', prepare: prepareExportDataset }}
					smol
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={deferredChartModel.dataset}
					charts={deferredChartModel.charts}
					selectedCharts={deferredChartModel.selectedCharts}
					chartOptions={deferredChartModel.chartOptions}
					containerClassName="min-h-[360px]"
					hideDataZoom={displayOptions.shouldHideDataZoom}
					hideDefaultLegend={!displayOptions.showBreakdownLegend}
					onReady={onChartReady}
					valueSymbol={deferredChartModel.valueSymbol}
				/>
			</React.Suspense>
			<LiquidationsDistributionChartFooter timestamp={timestamp} />
		</ChartPanel>
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function normalizeLiquidationsChartTokenKey(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
}

export function getLiquidationsChartMetric(metricQuery: string | undefined): LiquidationsMetric {
	return metricQuery === 'amount' ? 'amount' : 'usd'
}

export function getLiquidationsChartMetricQueryPatch(nextMetric: LiquidationsMetric) {
	return {
		[METRIC_QUERY_PARAM]: nextMetric === 'usd' ? undefined : nextMetric
	}
}

export function getLiquidationsChartMode(
	modeQuery: string | undefined,
	defaultChartMode: ChartMode = 'cumulative'
): ChartMode {
	return CHART_MODE_OPTIONS.some((option) => option.key === modeQuery) ? (modeQuery as ChartMode) : defaultChartMode
}

export function getLiquidationsChartModeQueryPatch(
	nextChartMode: ChartMode,
	defaultChartMode: ChartMode = 'cumulative'
) {
	return {
		[VIEW_QUERY_PARAM]: nextChartMode === defaultChartMode ? undefined : nextChartMode
	}
}

function getLiquidationsChartBreakdownOptions(allowedBreakdownModes: ReadonlyArray<BreakdownMode>) {
	return BREAKDOWN_OPTIONS.filter((option) => allowedBreakdownModes.includes(option.key))
}

export function getLiquidationsChartBreakdownMode(
	breakdownQuery: string | undefined,
	allowedBreakdownModes: ReadonlyArray<BreakdownMode> = DEFAULT_BREAKDOWN_MODES,
	defaultBreakdownMode: BreakdownMode = 'total'
): BreakdownMode {
	return allowedBreakdownModes.some((mode) => mode === breakdownQuery)
		? (breakdownQuery as BreakdownMode)
		: allowedBreakdownModes.includes(defaultBreakdownMode)
			? defaultBreakdownMode
			: (allowedBreakdownModes[0] ?? 'total')
}

export function getLiquidationsChartBreakdownQueryPatch(
	nextBreakdownMode: BreakdownMode,
	defaultBreakdownMode: BreakdownMode = 'total'
) {
	return {
		[BREAKDOWN_QUERY_PARAM]: nextBreakdownMode === defaultBreakdownMode ? undefined : nextBreakdownMode
	}
}

export function getLiquidationsChartTokenQueryPatch(nextToken: string, defaultToken: string | null) {
	return {
		[TOKEN_QUERY_PARAM]: nextToken === defaultToken ? undefined : nextToken
	}
}

export function resolveLiquidationsChartTokenKey(
	chart: LiquidationsDistributionChartData,
	tokenQuery: string | undefined
): string | null {
	if (chart.tokens.length === 0) return null
	if (!tokenQuery) return chart.tokens[0]?.key ?? null

	const normalizedTokenQuery = normalizeLiquidationsChartTokenKey(tokenQuery)
	const exactMatch = chart.tokens.find((entry) => entry.key === tokenQuery)
	if (exactMatch) return exactMatch.key

	const slugMatch = chart.tokens.find((entry) => normalizeLiquidationsChartTokenKey(entry.key) === normalizedTokenQuery)
	return slugMatch?.key ?? chart.tokens[0]?.key ?? null
}

export function getLiquidationsChartView(
	chart: LiquidationsDistributionChartData,
	tokenKey: string | null,
	breakdownMode: LiquidationsDistributionChartBreakdownKey
): LiquidationsDistributionChartView {
	if (!tokenKey) return { bins: [], series: [] }

	const selectedToken = chart.tokens.find((entry) => entry.key === tokenKey)
	if (!selectedToken) return { bins: [], series: [] }

	return trimLiquidationsChartView(selectedToken.breakdowns[breakdownMode])
}

function trimLiquidationsChartView(view: LiquidationsDistributionChartView): LiquidationsDistributionChartView {
	if (view.series.length === 0 || view.bins.length === 0) return view

	const hasValueAtIndex = (index: number) =>
		view.series.some((series) => series.usd[index]! > 0 || series.amount[index]! > 0)

	const firstNonZeroIndex = view.bins.findIndex((_, index) => hasValueAtIndex(index))
	if (firstNonZeroIndex === -1) return view

	let lastNonZeroIndex = firstNonZeroIndex
	for (let index = firstNonZeroIndex + 1; index < view.bins.length; index += 1) {
		if (hasValueAtIndex(index)) {
			lastNonZeroIndex = index
		}
	}

	return {
		bins: view.bins.slice(firstNonZeroIndex, lastNonZeroIndex + 1),
		series: view.series.map((series) => ({
			...series,
			usd: series.usd.slice(firstNonZeroIndex, lastNonZeroIndex + 1),
			amount: series.amount.slice(firstNonZeroIndex, lastNonZeroIndex + 1)
		}))
	}
}

export function buildCumulativeLiquidationsChartView(
	view: LiquidationsDistributionChartView
): LiquidationsDistributionChartView {
	if (view.series.length === 0 || view.bins.length === 0) return view

	return {
		bins: view.bins,
		series: view.series.map((series) => {
			const usd = [...series.usd]
			const amount = [...series.amount]

			for (let index = usd.length - 2; index >= 0; index -= 1) {
				usd[index]! += usd[index + 1]!
				amount[index]! += amount[index + 1]!
			}

			return {
				...series,
				usd,
				amount
			}
		})
	}
}

export function buildLiquidationsChartExportDataset(
	view: LiquidationsDistributionChartView,
	metric: LiquidationsMetric,
	selectedSeries: ReadonlySet<string>
): MultiSeriesChartDataset {
	const series: LiquidationsDistributionChartView['series'] = []
	const dimensions = ['liqPrice']
	for (const entry of view.series) {
		if (!selectedSeries.has(entry.label)) continue
		series.push(entry)
		dimensions.push(entry.key)
	}
	const source = new Array<Array<number>>(view.bins.length)

	for (let binIndex = 0; binIndex < view.bins.length; binIndex += 1) {
		const row = new Array<number>(dimensions.length)
		row[0] = view.bins[binIndex]!
		for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
			const entry = series[seriesIndex]!
			row[seriesIndex + 1] = metric === 'usd' ? entry.usd[binIndex]! : entry.amount[binIndex]!
		}
		source[binIndex] = row
	}

	return { dimensions, source }
}

export function LiquidationsDistributionChart({
	chart,
	scope,
	timestamp,
	title,
	allowedBreakdownModes = DEFAULT_BREAKDOWN_MODES,
	defaultBreakdownMode = 'total',
	hideTokenSelector = false,
	defaultChartMode = 'cumulative',
	tokenStateMode = 'query',
	iconUrl
}: {
	chart: LiquidationsDistributionChartData
	/** The page's entity, such as the protocol and chain; the series selection starts over for a new one. */
	scope: string
	timestamp: number
	title?: string
	iconUrl?: string
	allowedBreakdownModes?: ReadonlyArray<BreakdownMode>
	defaultBreakdownMode?: BreakdownMode
	hideTokenSelector?: boolean
	defaultChartMode?: ChartMode
	tokenStateMode?: 'query' | 'local'
}) {
	const router = useRouter()
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const tokenOptions = React.useMemo(
		() => chart.tokens.map((entry) => ({ key: entry.key, name: entry.label })),
		[chart.tokens]
	)
	const breakdownOptions = React.useMemo(
		() => getLiquidationsChartBreakdownOptions(allowedBreakdownModes),
		[allowedBreakdownModes]
	)
	const defaultToken = chart.tokens[0]?.key ?? null
	const [localToken, setLocalToken] = React.useReducer((_: string | null, next: string | null) => next, defaultToken)
	const chartState = React.useMemo(() => {
		const selectedLocalToken =
			localToken && chart.tokens.some((entry) => entry.key === localToken) ? localToken : defaultToken
		const token = hideTokenSelector
			? defaultToken
			: tokenStateMode === 'local'
				? selectedLocalToken
				: resolveLiquidationsChartTokenKey(chart, readSingleQueryValue(router.query[TOKEN_QUERY_PARAM]))
		const metric = getLiquidationsChartMetric(readSingleQueryValue(router.query[METRIC_QUERY_PARAM]))
		const mode = getLiquidationsChartMode(readSingleQueryValue(router.query[VIEW_QUERY_PARAM]), defaultChartMode)
		const breakdownMode = getLiquidationsChartBreakdownMode(
			readSingleQueryValue(router.query[BREAKDOWN_QUERY_PARAM]),
			allowedBreakdownModes,
			defaultBreakdownMode
		)
		const selectedTokenEntry = chart.tokens.find((entry) => entry.key === token)
		const tokenLabel = selectedTokenEntry?.label ?? 'Token'
		const tokenTotalUsd = selectedTokenEntry?.totalUsd ?? null
		const breakdownLabel = breakdownOptions.find((option) => option.key === breakdownMode)?.name ?? 'Total'
		const modeLabel = CHART_MODE_OPTIONS.find((option) => option.key === mode)?.name ?? 'Cumulative'

		return {
			token,
			tokenLabel,
			tokenTotalUsd,
			metric,
			mode,
			modeLabel,
			breakdownMode,
			breakdownLabel
		}
	}, [
		allowedBreakdownModes,
		breakdownOptions,
		chart,
		defaultChartMode,
		defaultBreakdownMode,
		defaultToken,
		hideTokenSelector,
		localToken,
		router.query,
		tokenStateMode
	])

	const setSelectedToken = React.useCallback(
		(nextToken: string) => {
			if (nextToken === chartState.token) return
			if (tokenStateMode === 'local') {
				setLocalToken(nextToken)
				return
			}
			void pushShallowQuery(router, getLiquidationsChartTokenQueryPatch(nextToken, defaultToken))
		},
		[chartState.token, defaultToken, router, tokenStateMode]
	)
	const setMetric = React.useCallback(
		(nextMetric: LiquidationsMetric) => {
			if (nextMetric === chartState.metric) return
			void pushShallowQuery(router, getLiquidationsChartMetricQueryPatch(nextMetric))
		},
		[chartState.metric, router]
	)
	const setChartMode = React.useCallback(
		(nextChartMode: ChartMode) => {
			if (nextChartMode === chartState.mode) return
			void pushShallowQuery(router, getLiquidationsChartModeQueryPatch(nextChartMode, defaultChartMode))
		},
		[chartState.mode, defaultChartMode, router]
	)
	const setBreakdownMode = React.useCallback(
		(nextBreakdownMode: BreakdownMode) => {
			if (nextBreakdownMode === chartState.breakdownMode) return
			void pushShallowQuery(router, getLiquidationsChartBreakdownQueryPatch(nextBreakdownMode, defaultBreakdownMode))
		},
		[chartState.breakdownMode, defaultBreakdownMode, router]
	)

	const selectedChartView = React.useMemo(() => {
		const baseView = getLiquidationsChartView(chart, chartState.token, chartState.breakdownMode)
		return chartState.mode === 'cumulative' ? buildCumulativeLiquidationsChartView(baseView) : baseView
	}, [chart, chartState.breakdownMode, chartState.mode, chartState.token])
	const availableSeries = React.useMemo(() => {
		const labels: Array<string> = []
		const seen = new Set<string>()
		for (const series of selectedChartView.series) {
			if (seen.has(series.label)) continue
			seen.add(series.label)
			labels.push(series.label)
		}
		return labels
	}, [selectedChartView.series])
	const {
		activeSeries: selectedSeries,
		selectedCharts,
		setSelectedSeries
	} = useLocalSelection({
		availableSeries,
		scope: `${scope}:${chartState.token ?? 'none'}:${chartState.breakdownMode}`
	})
	const visibleDataPointCount = React.useMemo(() => {
		let count = 0
		for (let index = 0; index < selectedChartView.bins.length; index += 1) {
			for (const series of selectedChartView.series) {
				if (series.usd[index]! <= 0 && series.amount[index]! <= 0) continue
				count += 1
				break
			}
		}
		return count
	}, [selectedChartView.bins, selectedChartView.series])
	const shouldHideDataZoom = visibleDataPointCount <= 2
	const showBreakdownLegend = chartState.breakdownMode !== 'total'
	const showBreakdownSelector = breakdownOptions.length > 1

	const chartModel = React.useMemo(() => {
		const dimensions = new Array<string>(selectedChartView.series.length + 1)
		dimensions[0] = 'liqPrice'
		const charts: NonNullable<IMultiSeriesChartProps['charts']> = new Array(selectedChartView.series.length)
		for (let index = 0; index < selectedChartView.series.length; index += 1) {
			const entry = selectedChartView.series[index]!
			dimensions[index + 1] = entry.key
			charts[index] = {
				type: 'bar',
				name: entry.label,
				encode: { x: 0, y: index + 1 },
				stack: 'liquidations',
				color: CHART_COLORS[index % CHART_COLORS.length]!,
				large: false
			}
		}

		const source = new Array<Array<number>>(selectedChartView.bins.length)
		for (let index = 0; index < selectedChartView.bins.length; index += 1) {
			const row = new Array<number>(dimensions.length)
			row[0] = selectedChartView.bins[index]!
			for (let seriesIndex = 0; seriesIndex < selectedChartView.series.length; seriesIndex++) {
				const entry = selectedChartView.series[seriesIndex]!
				const value = chartState.metric === 'usd' ? entry.usd[index]! : entry.amount[index]!
				row[seriesIndex + 1] = value
			}
			source[index] = row
		}

		return {
			dataset: { source, dimensions } satisfies MultiSeriesChartDataset,
			charts
		}
	}, [chartState.metric, selectedChartView.bins, selectedChartView.series])
	const prepareExportDataset = React.useCallback(
		() => buildLiquidationsChartExportDataset(selectedChartView, chartState.metric, selectedCharts),
		[chartState.metric, selectedChartView, selectedCharts]
	)

	const chartOptions = React.useMemo(() => {
		const options: MultiSeriesChartOptions = {
			grid: {
				top: showBreakdownLegend ? CHART_LEGEND_RESERVE : 24,
				left: CHART_INSET,
				right: CHART_INSET,
				bottom: shouldHideDataZoom ? CHART_INSET : CHART_ZOOM_RESERVE
			},
			xAxis: {
				type: 'category',
				axisLabel: {
					hideOverlap: true,
					formatter: (value: string) => formatLiquidationPrice(Number(value))
				},
				axisTick: { alignWithLabel: true }
			},
			yAxis: {
				type: 'value',
				position: 'right',
				axisLabel: {
					formatter: (value: number) => formatLiquidationMetricValue(value, chartState.metric, chartState.tokenLabel)
				}
			},
			dataZoom: {
				labelFormatter: (value: number) => formatLiquidationPrice(Number(value))
			},
			tooltip: {
				trigger: 'axis',
				confine: true,
				backgroundColor: 'transparent',
				borderWidth: 0,
				padding: 0,
				textStyle: {
					color: 'var(--text-primary)',
					fontSize: 12,
					fontFamily: 'inherit'
				},
				axisPointer: {
					type: 'cross',
					label: {
						backgroundColor: '#1f67d2',
						color: '#fff',
						borderColor: '#1f67d2',
						borderWidth: 1,
						borderRadius: 4,
						padding: [4, 8],
						formatter: (value: unknown) => {
							const raw = isRecord(value) && 'value' in value ? ((value as { value?: unknown }).value ?? value) : value
							const numeric = Number(raw)
							if (!Number.isFinite(numeric)) return String(raw)
							const axisDimension =
								isRecord(value) && 'axisDimension' in value
									? (value as { axisDimension?: unknown }).axisDimension
									: undefined
							if (axisDimension === 'x') {
								return formatLiquidationPrice(numeric)
							}
							return formatLiquidationMetricValue(numeric, chartState.metric, chartState.tokenLabel)
						}
					}
				},
				formatter: (params: unknown) => getLiquidationsTooltipHtml(params, chartState.metric, chartState.tokenLabel)
			}
		}

		return options
	}, [chartState.metric, chartState.tokenLabel, shouldHideDataZoom, showBreakdownLegend])

	const chartRenderModel = React.useMemo(
		() => ({ ...chartModel, selectedCharts, chartOptions, valueSymbol: chartState.metric === 'usd' ? '$' : '' }),
		[chartModel, chartOptions, chartState.metric, selectedCharts]
	)
	// Deferred together with the rows, so formatters, the value symbol and the visible series never pair with old rows.
	const deferredChartModel = React.useDeferredValue(chartRenderModel)

	if (chart.tokens.length === 0) {
		return (
			<Card padding="md">
				<h2 className="heading-xs">{title ?? 'Liquidation Distribution'}</h2>
				<p className="mt-3 body-sm text-tertiary">No liquidation chart data available for this view.</p>
			</Card>
		)
	}

	return (
		<LiquidationsDistributionChartCard
			availableSeries={availableSeries}
			breakdownOptions={breakdownOptions}
			chartState={chartState}
			deferredChartModel={deferredChartModel}
			prepareExportDataset={prepareExportDataset}
			displayOptions={{ hideTokenSelector, shouldHideDataZoom, showBreakdownLegend, showBreakdownSelector }}
			onChartReady={handleChartReady}
			setBreakdownMode={setBreakdownMode}
			setChartMode={setChartMode}
			setMetric={setMetric}
			selectedSeries={selectedSeries}
			setSelectedToken={setSelectedToken}
			setSelectedSeries={setSelectedSeries}
			timestamp={timestamp}
			title={title}
			iconUrl={iconUrl}
			tokenOptions={tokenOptions}
			chartInstance={chartInstance}
		/>
	)
}
