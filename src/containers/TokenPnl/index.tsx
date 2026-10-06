import * as Ariakit from '@ariakit/react'
import { useQueries, useQuery } from '@tanstack/react-query'
import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { formatTooltipChartDate, formatTooltipValue } from '~/components/ECharts/shared/formatters'
import { getTooltipAxisValue, getTooltipRawYValue, normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { TokenLogo } from '~/components/TokenLogo'
import {
	getGeckoIdFromSearchId,
	getTokenSearchFallback,
	hydrateTokenSearchOptionsByIds
} from '~/containers/TokenSearch/search'
import { TokenSearchDialog, toTokenSearchOption } from '~/containers/TokenSearch/TokenSearchDialog'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import { useDateRangeValidation } from '~/hooks/useDateRangeValidation'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { PanelLoadingStatus } from '~/ui/Status'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { ComparisonPanel } from './ComparisonPanel'
import { DailyPnLGrid } from './DailyPnLGrid'
import { DateInput } from './DateInput'
import { formatDateLabel, formatPnlPercent } from './format'
import { buildComparisonEntry, computeTokenPnl } from './queries'
import type { TokenPnlResult } from './queries'
import { StatsCard } from './StatsCard'
import type { ComparisonEntry } from './types'

const EMPTY_SELECTED_COINS: Record<string, TokenSearchResult> = {}
const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

export const DEFAULT_TOKEN_PNL_TOKEN_IDS = ['bitcoin', 'ethereum', 'solana'] as const
const TOKEN_PNL_MAX_DATE_BUFFER_SECONDS = 60

function buildTokenOptionMap(tokens: Array<TokenSearchResult>): Record<string, TokenSearchResult> {
	const map: Record<string, TokenSearchResult> = {}
	for (const token of tokens) {
		map[token.id] = token
	}
	return map
}

const unixToDateString = (unixTimestamp?: number): string => {
	if (unixTimestamp == null) return ''
	const date = new Date(unixTimestamp * 1000)
	return date.toISOString().split('T')[0] ?? ''
}

const dateStringToUnix = (dateString: string | null | undefined): number | null => {
	if (!dateString) return null
	const timestamp = new Date(dateString).getTime()
	if (Number.isNaN(timestamp)) return null
	return Math.floor(timestamp / 1000)
}

const isValidDate = (dateString: string | Array<string> | undefined): boolean => {
	if (!dateString || typeof dateString !== 'string') return false
	const date = new Date(+dateString * 1000)
	return !Number.isNaN(date.getTime())
}

type TokenPnlContentProps = {
	routerReady: boolean
	isLoading: boolean
	isFetching: boolean
	isError: boolean
	error: unknown
	onRetry: () => void | Promise<unknown>
	pnlData: TokenPnlResult | null | undefined
	quantity: number
	start: number
	end: number
	chartOptions: MultiSeriesChartOptions | undefined
	exportChartInstance: () => echarts.ECharts | null
	handleChartReady: (instance: echarts.ECharts | null) => void
	comparisonData: Array<ComparisonEntry>
	selectedCoinId: string
	selectedCoinInfo: TokenSearchResult | null
}

function TokenPnlContent({
	routerReady,
	isLoading,
	isFetching,
	isError,
	error,
	onRetry,
	pnlData,
	quantity,
	start,
	end,
	chartOptions,
	exportChartInstance,
	handleChartReady,
	comparisonData,
	selectedCoinId,
	selectedCoinInfo
}: TokenPnlContentProps) {
	if (!routerReady || isLoading || isFetching) {
		return <PanelLoadingStatus />
	}

	if (isError) {
		return (
			<Panel padding="sm" className="flex-1 items-center justify-center gap-2 text-center">
				<p className="heading-xs text-data-down" role="alert">
					Failed to load data
				</p>
				<p className="body-sm text-data-down">
					{error instanceof Error ? error.message : 'Something went wrong fetching price data.'}
				</p>
				<Button
					type="button"
					onClick={() => {
						void onRetry()
					}}
					size="md"
				>
					Retry
				</Button>
			</Panel>
		)
	}

	if (!pnlData || pnlData.priceSeries.length === 0) {
		return (
			<Panel padding="sm" className="flex-1 items-center justify-center gap-2 text-center">
				<p className="heading-xs text-primary">No historical data available for this range.</p>
				<p className="body-sm text-tertiary">Try a different date range or another token.</p>
			</Panel>
		)
	}

	const { metrics, timeline, currentPrice, chartData } = pnlData
	const tokenExportName = selectedCoinInfo?.name ?? selectedCoinId
	const { percentChange, isProfit, holdingPeriodDays, annualizedReturn, absoluteChange } = metrics
	const quantityValue = quantity !== 0 ? absoluteChange * quantity : absoluteChange
	const formattedQuantityValue = formatCompactNumber(Math.abs(quantityValue), {
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})
	const formattedAbsoluteChange = formatCompactNumber(Math.abs(absoluteChange), {
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})
	const quantityLabel =
		quantity !== 0
			? `${formatCompactNumber(quantity, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} tokens → ${quantityValue >= 0 ? '+$' : '-$'}${formattedQuantityValue}`
			: `${absoluteChange >= 0 ? '+$' : '-$'}${formattedAbsoluteChange} per token`

	return (
		<div className="flex flex-1 flex-col gap-2">
			<section className="grid gap-2 sm:grid-cols-3" aria-label="Performance summary">
				<Card padding="md" as="dl" className="flex flex-col gap-1.5">
					<dt className="label-xs text-secondary uppercase">Return</dt>
					<dd className={`mono-xl ${isProfit ? 'text-data-up' : 'text-data-down'}`}>
						{formatPnlPercent(percentChange)}
					</dd>
					<dd className="body-sm text-secondary">{quantityLabel}</dd>
				</Card>
				<Card padding="md" as="dl" className="flex flex-col gap-1.5">
					<dt className="label-xs text-secondary uppercase">Holding Period</dt>
					<dd className="mono-xl text-primary">
						{holdingPeriodDays} <span className="label-lg text-secondary">days</span>
					</dd>
					<dd className="body-sm text-secondary">
						<time dateTime={unixToDateString(start)}>{formatDateLabel(start)}</time> →{' '}
						<time dateTime={unixToDateString(end)}>{formatDateLabel(end)}</time>
					</dd>
				</Card>
				<Card padding="md" as="dl" className="flex flex-col gap-1.5">
					<dt className="label-xs text-secondary uppercase">Annualised Return</dt>
					<dd className={`mono-xl ${annualizedReturn >= 0 ? 'text-data-up' : 'text-data-down'}`}>
						{formatPnlPercent(annualizedReturn)}
					</dd>
					<dd className="body-sm text-secondary">
						{annualizedReturn >= 0 ? '↑' : '↓'} Based on {holdingPeriodDays}d period
					</dd>
				</Card>
			</section>

			<Panel padding="none">
				<PanelHeader>
					<PanelTitle as="h3" className="mr-0">
						Price Over Time
					</PanelTitle>
					<p className="mr-auto flex items-center gap-1 body-sm text-nowrap text-secondary">
						<span>{formatDateLabel(start)}</span>
						<Icon name="arrow-right" width={14} height={14} />
						<span>{formatDateLabel(end)}</span>
					</p>
					<ChartExportButtons
						chartInstance={exportChartInstance}
						filename="token-pnl-price"
						title={`${tokenExportName} Price Over Time`}
						csvSource={{ type: 'dataset', prepare: () => chartData.dataset }}
					/>
				</PanelHeader>
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={chartData.dataset}
						charts={chartData.charts}
						hideDataZoom
						chartOptions={chartOptions}
						onReady={handleChartReady}
					/>
				</Suspense>
			</Panel>

			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				<StatsCard
					label="Current Price"
					value={formatUsd(currentPrice, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
					subtle={selectedCoinInfo?.symbol?.toUpperCase()}
				/>
				<StatsCard
					label="Start Price"
					value={formatUsd(metrics.startPrice, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
				<StatsCard
					label="End Price"
					value={formatUsd(metrics.endPrice, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				/>
				<StatsCard label="Max Drawdown" value={formatPnlPercent(-Math.abs(metrics.maxDrawdown))} />
				<StatsCard label="Volatility (Ann.)" value={formatPnlPercent(metrics.volatility)} />
			</div>

			<DailyPnLGrid timeline={timeline} />

			<ComparisonPanel entries={comparisonData} activeId={selectedCoinId} />
		</div>
	)
}

export function TokenPnl({ initialTokenOptions }: { initialTokenOptions: Array<TokenSearchResult> }) {
	const router = useRouter()
	const nowSeconds = useNowSeconds()
	const maxSelectableDateUnix = Math.max(0, nowSeconds - TOKEN_PNL_MAX_DATE_BUFFER_SECONDS)
	const coinParam = router.query?.coin

	const [tokenOptionsById, setTokenOptionsById] = useState<Record<string, TokenSearchResult>>(() =>
		buildTokenOptionMap(initialTokenOptions)
	)
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	// The URL holds the picked dates; the defaults fill whatever it lacks and follow the clock. A static page's query
	// is empty until hydration, so the server and hydration renders show the defaults.
	const startParam = router.query.start
	const endParam = router.query.end
	const startDate =
		router.isReady && isValidDate(startParam)
			? unixToDateString(Number(startParam))
			: unixToDateString(maxSelectableDateUnix - 7 * 24 * 60 * 60)
	const endDate =
		router.isReady && isValidDate(endParam)
			? unixToDateString(Number(endParam))
			: unixToDateString(maxSelectableDateUnix)
	const { dateError, validateDateRange } = useDateRangeValidation()

	const [quantityInput, setQuantityInput] = useState('')

	const queryCoins = coinParam ?? ['bitcoin']
	const selectedCoinId = getGeckoIdFromSearchId(Array.isArray(queryCoins) ? queryCoins[0] : queryCoins)
	const missingTokenIds = useMemo(() => {
		const missingIds = new Set<string>()
		if (selectedCoinId && !tokenOptionsById[selectedCoinId]) missingIds.add(selectedCoinId)
		for (const tokenId of DEFAULT_TOKEN_PNL_TOKEN_IDS) {
			if (!tokenOptionsById[tokenId]) missingIds.add(tokenId)
		}
		return Array.from(missingIds)
	}, [selectedCoinId, tokenOptionsById])
	const hydratedTokenOptions = useQuery({
		queryKey: ['token-search-options-by-ids', missingTokenIds],
		queryFn: () => hydrateTokenSearchOptionsByIds(missingTokenIds),
		enabled: router.isReady && missingTokenIds.length > 0,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})
	const resolvedTokenOptionsById = useMemo(() => {
		const tokens = hydratedTokenOptions.data
		if (!tokens?.length) return tokenOptionsById

		const next = { ...tokenOptionsById }
		for (const token of tokens) {
			next[token.id] = token
		}
		return next
	}, [hydratedTokenOptions.data, tokenOptionsById])

	const selectedCoinInfo = selectedCoinId
		? (resolvedTokenOptionsById[selectedCoinId] ?? getTokenSearchFallback(selectedCoinId))
		: null
	const coinInfoMap = useMemo(() => {
		const map = new Map(Object.entries(resolvedTokenOptionsById))
		if (selectedCoinId && !map.has(selectedCoinId)) map.set(selectedCoinId, getTokenSearchFallback(selectedCoinId))
		for (const tokenId of DEFAULT_TOKEN_PNL_TOKEN_IDS) {
			if (!map.has(tokenId)) map.set(tokenId, getTokenSearchFallback(tokenId))
		}
		return map
	}, [selectedCoinId, resolvedTokenOptionsById])

	const start = dateStringToUnix(startDate)
	const end = dateStringToUnix(endDate)

	const {
		data: pnlData,
		isLoading,
		isError,
		error,
		refetch,
		isFetching
	} = useQuery({
		queryKey: ['token-pnl', selectedCoinId, start, end],
		queryFn: () => computeTokenPnl({ id: selectedCoinId, start, end }),
		enabled: !!(router.isReady && selectedCoinId && start != null && end != null && end > start),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	const comparisonQueries = useQueries({
		queries: DEFAULT_TOKEN_PNL_TOKEN_IDS.map((tokenId) => ({
			queryKey: ['token-pnl-comparison-item', tokenId, start, end],
			queryFn: () => buildComparisonEntry({ tokenId, start, end }),
			enabled: !!(router.isReady && start != null && end != null && end > start),
			staleTime: 60 * 60 * 1000,
			refetchOnWindowFocus: false,
			retry: 0
		}))
	})

	const comparisonData = useMemo(
		() =>
			comparisonQueries.flatMap((q): Array<ComparisonEntry> => {
				const d = q.data
				if (d == null) return []
				const coin = coinInfoMap.get(d.id)
				return [
					{
						...d,
						name: coin?.name ?? d.id,
						symbol: coin?.symbol ?? d.id,
						image: coin?.logo
					}
				]
			}),
		[comparisonQueries, coinInfoMap]
	)

	const parsedQuantity = parseFloat(quantityInput)
	const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0

	const chartOptions = useMemo<MultiSeriesChartOptions | undefined>(() => {
		if (!pnlData || start == null || end == null) return undefined

		const { metrics, yAxisConfig: yAxis } = pnlData
		const startPrice = metrics.startPrice

		return {
			xAxis: {
				type: 'time',
				min: start * 1000,
				max: end * 1000,
				axisLabel: {
					formatter: (value: number) => formatDateLabel(value / 1000),
					showMinLabel: true,
					showMaxLabel: true,
					hideOverlap: true
				},
				boundaryGap: [0, 0]
			},
			yAxis: {
				min: yAxis.min,
				max: yAxis.max,
				interval: yAxis.interval
			},
			legend: {
				show: false
			},
			tooltip: {
				backgroundColor: 'transparent',
				borderWidth: 0,
				padding: 0,
				axisPointer: {
					type: 'line',
					lineStyle: { color: 'rgba(148,163,184,0.5)', width: 1.5, type: 'solid' },
					z: 0
				},
				formatter: (params: unknown) => {
					const itemsArray = normalizeTooltipItems(params)
					if (itemsArray.length === 0) return ''

					const point = itemsArray[0]
					const timestamp = getTooltipAxisValue(point)
					const seriesValue = getTooltipRawYValue(point, point.seriesName ?? '')
					const price = typeof seriesValue === 'number' ? seriesValue : Number(seriesValue ?? 0)
					const changeFromStart = startPrice !== 0 ? ((price - startPrice) / startPrice) * 100 : 0
					const changeColor = changeFromStart >= 0 ? 'var(--text-data-up)' : 'var(--text-data-down)'
					const changeSign = changeFromStart >= 0 ? '+' : ''

					const chartdate = Number.isFinite(timestamp) ? formatTooltipChartDate(timestamp, 'daily') : ''

					return `<div style="background: var(--bg-surface); border: 1px solid var(--border-medium); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16); color: var(--text-primary); border-radius: 8px; padding: 8px 10px; font-size: 11px; line-height: 1.35; white-space: nowrap;">
						<div style="color: var(--text-secondary); margin-bottom: 2px;">${chartdate}</div>
						<div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">${formatTooltipValue(price, '$')}</div>
						<div style="font-size: 11px; color: ${changeColor}; font-weight: 500;">${changeSign}${formatTooltipValue(changeFromStart, '%')} from start</div>
					</div>`
				}
			}
		}
	}, [pnlData, start, end])

	const dialogStore = Ariakit.useDialogStore()

	const handleDateChange = (value: string, isStart: boolean) => {
		if (!value) return
		const nextStart = isStart ? value : startDate
		const nextEnd = isStart ? endDate : value
		if (!nextStart || !nextEnd) return
		if (!validateDateRange(nextStart, nextEnd)) return
		const unixValue = dateStringToUnix(value)
		const bound = isStart ? 'start' : 'end'
		void pushShallowQuery(router, { [bound]: unixValue ?? undefined })
	}

	const updateCoin = (coinId: string) => {
		void pushShallowQuery(router, { coin: [coinId] })
		dialogStore.toggle()
	}

	return (
		<>
			<Card padding="strip">
				<h1 className="heading-sm">Token Holder Profit and Loss</h1>
			</Card>
			<div className="grid flex-1 gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
				<Card padding="sm" className="flex flex-col gap-3">
					<div className="flex flex-col gap-2">
						<DateInput
							label="Start Date"
							value={startDate}
							error={dateError}
							onChange={(value) => handleDateChange(value, true)}
							min={unixToDateString(0)}
							max={unixToDateString(maxSelectableDateUnix)}
						/>
						<DateInput
							label="End Date"
							value={endDate}
							error={dateError}
							onChange={(value) => handleDateChange(value, false)}
							min={startDate}
							max={unixToDateString(maxSelectableDateUnix)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<span className="body-sm text-secondary">Token</span>
						<button
							type="button"
							onClick={() => dialogStore.toggle()}
							aria-label={`Token: ${selectedCoinInfo?.name ?? 'none'}`}
							className={`${inputStyles} flex w-full cursor-pointer items-center justify-start gap-2 overflow-hidden text-left dark:scheme-dark`}
						>
							{selectedCoinInfo != null ? (
								<>
									<TokenLogo src={selectedCoinInfo.logo} alt={selectedCoinInfo.name} size={20} />
									<span className="min-w-0 truncate">{selectedCoinInfo.name}</span>
								</>
							) : (
								<>
									<Icon name="search" width={16} height={16} className="shrink-0 text-tertiary" />
									<span className="text-tertiary">Select token</span>
								</>
							)}
						</button>
						<TokenSearchDialog
							initialTokens={initialTokenOptions}
							dialogStore={dialogStore}
							selectedTokens={EMPTY_SELECTED_COINS}
							selectToken={(coin) => {
								const token = toTokenSearchOption(coin)
								setTokenOptionsById((prev) => (prev[token.id] ? prev : { ...prev, [token.id]: token }))
								updateCoin(token.id)
							}}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label className="flex flex-col gap-1">
							<span className="body-sm text-secondary">Quantity (optional)</span>
							<Input
								type="number"
								min="0"
								step="any"
								placeholder="Tokens held"
								value={quantityInput}
								onChange={(event) => setQuantityInput(event.target.value)}
								className="w-full dark:scheme-dark"
							/>
						</label>
					</div>
				</Card>
				<TokenPnlContent
					routerReady={router.isReady}
					isLoading={isLoading}
					isFetching={isFetching}
					isError={isError}
					error={error}
					onRetry={() => refetch()}
					pnlData={pnlData}
					quantity={quantity}
					start={start ?? 0}
					end={end ?? 0}
					chartOptions={chartOptions}
					exportChartInstance={exportChartInstance}
					handleChartReady={handleChartReady}
					comparisonData={comparisonData}
					selectedCoinId={selectedCoinId}
					selectedCoinInfo={selectedCoinInfo}
				/>
			</div>
		</>
	)
}
