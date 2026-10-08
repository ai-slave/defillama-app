import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo } from 'react'
import { useGeckoId, usePriceChart } from '~/api/client'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { useGetProtocolEmissions } from '~/containers/Unlocks/queries.client'
import { useBreakpointWidth } from '~/hooks/useBreakpointWidth'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { TagGroup } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { InlineStatStrip, type InlineStatStripItem } from '~/ui/SummaryStats'
import { Switch } from '~/ui/Switch'
import { capitalizeFirstLetter, firstDayOfMonth, lastDayOfWeek, slug } from '~/utils'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd, formatCompactNumber, formatPercent, formatPercentChange, roundNumber } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { EmissionsChartRow } from './api.types'
import { processGroupedChartData, sortStacksByVolatility } from './emissionsChartData'
import { InsidersTable } from './InsidersTable'
import { Pagination } from './Pagination'
import type { ProtocolEmissionResult, ResolvedProtocolEmissionResult } from './types'
import { UpcomingEvent } from './UpcomingEvent'

const getExtendedColors = ({
	baseColors,
	isPriceActive,
	isMcapActive
}: {
	baseColors: Record<string, string>
	isPriceActive: boolean
	isMcapActive: boolean
}) => {
	const extended = { ...baseColors }
	if (isMcapActive) {
		extended['Market Cap'] = '#0c5dff'
	}
	if (isPriceActive) {
		extended['Price'] = '#ff4e21'
	}
	return extended
}

const EXCLUDED_CHART_CATEGORIES = new Set(['Market Cap', 'Price'])

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

type InitialTokenMarketData = {
	price?: number | null
	prevPrice?: number | null
	priceChangePercent?: number | null
	mcap?: number | null
	volume24h?: number | null
	circSupply?: number | null
	maxSupply?: number | null
	maxSupplyInfinite?: boolean | null
}

const MS_24H = 24 * 60 * 60 * 1000

function findPriceAtLeast24hAgo(prices: Array<[number, number]> | undefined): number | undefined {
	if (!prices || prices.length < 2) return undefined
	const latestTs = prices[prices.length - 1]![0]
	const target = latestTs - MS_24H
	for (let i = prices.length - 2; i >= 0; i--) {
		const price = prices[i]!
		if (price[0] <= target) {
			return price[1]
		}
	}
	return undefined
}

function resolveTokenMaxSupply(
	initial: InitialTokenMarketData | null | undefined,
	chartMarketData: { max_supply_infinite?: boolean; max_supply?: number | null } | undefined,
	metaMaxSupply: number | undefined
): number | undefined {
	if (initial?.maxSupplyInfinite === true) return Infinity
	if (initial?.maxSupply != null) return initial.maxSupply
	if (chartMarketData?.max_supply_infinite) return Infinity
	return chartMarketData?.max_supply ?? metaMaxSupply ?? undefined
}

export function EmissionsByProtocol({
	data,
	isEmissionsPage = false,
	initialTokenMarketData = null,
	generatedAtSec,
	disableClientTokenStatsFetch = false,
	hideTokenStats = false
}: {
	data: ResolvedProtocolEmissionResult
	isEmissionsPage?: boolean
	initialTokenMarketData?: InitialTokenMarketData | null
	/** The clock the server data was built with, so event ordering and countdowns hydrate cleanly. */
	generatedAtSec: number
	disableClientTokenStatsFetch?: boolean
	hideTokenStats?: boolean
}) {
	return (
		<div className="col-span-full flex flex-col gap-2 xl:col-span-1">
			{!isEmissionsPage ? <h3>Emissions</h3> : null}
			<ChartContainer
				data={data}
				isEmissionsPage={isEmissionsPage}
				initialTokenMarketData={initialTokenMarketData}
				generatedAtSec={generatedAtSec}
				disableClientTokenStatsFetch={disableClientTokenStatsFetch}
				hideTokenStats={hideTokenStats}
			/>
		</div>
	)
}

const standardGroupColors: Record<string, string> = {
	noncirculating: '#546fc6',
	insiders: '#90cc74',
	publicSale: '#fac759',
	privateSale: '#fd8353',
	farming: '#ed6666',
	airdrop: '#73c0de',
	liquidity: '#39a371'
}

const formatUnlockLabel = (label: string) =>
	label
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((word) => (word === word.toUpperCase() ? word : capitalizeFirstLetter(word.toLowerCase())))
		.join(' ')

const DATA_TYPES = ['documented', 'realtime'] as const
type DataType = (typeof DATA_TYPES)[number]

const TIME_GROUPINGS = ['D', 'W', 'M', 'Q', 'Y'] as const
type TimeGrouping = (typeof TIME_GROUPINGS)[number]

const CHART_GROUP_BY: Record<TimeGrouping, NonNullable<IMultiSeriesChartProps['groupBy']>> = {
	D: 'daily',
	W: 'weekly',
	M: 'monthly',
	Q: 'quarterly',
	Y: 'yearly'
}

function getQuarterStart(timestampMs: number): number {
	const date = new Date(timestampMs)
	const quarter = Math.floor(date.getUTCMonth() / 3)
	return Date.UTC(date.getUTCFullYear(), quarter * 3, 1)
}

function getYearStart(timestampMs: number): number {
	const date = new Date(timestampMs)
	return Date.UTC(date.getUTCFullYear(), 0, 1)
}

function groupChartDataByTime(
	chartData: Array<{ timestamp: number } & Record<string, number | null>>,
	groupBy: TimeGrouping
): Array<{ timestamp: number } & Record<string, number | null>> {
	if (groupBy === 'D') return chartData

	const grouped: Record<number, Record<string, number>> = {}

	for (const entry of chartData) {
		const ts = entry.timestamp
		let groupKey: number

		switch (groupBy) {
			case 'W':
				groupKey = lastDayOfWeek(ts / 1000) * 1e3
				break
			case 'M':
				groupKey = firstDayOfMonth(ts / 1000) * 1e3
				break
			case 'Q':
				groupKey = getQuarterStart(ts)
				break
			case 'Y':
				groupKey = getYearStart(ts)
				break
			default:
				groupKey = ts
		}

		const group = grouped[groupKey] ?? (grouped[groupKey] = {})

		for (const key in entry) {
			if (key === 'timestamp') continue
			const value = entry[key]
			if (value == null) continue
			group[key] = value
		}
	}

	const result: Array<{ timestamp: number } & Record<string, number | null>> = []
	for (const groupKey in grouped) {
		result.push({ timestamp: +groupKey, ...grouped[groupKey]! })
	}
	return result.sort((a, b) => a.timestamp - b.timestamp)
}

const unlockedPieChartRadius: [string, string] = ['50%', '70%']
const allocationPieChartRadius: [string, string] = ['0%', '82%']
const allocationPieChartLegendToRight = 260

const unlockedPieChartStackColors = {
	Unlocked: '#0c5dff',
	Locked: '#ff4e21'
}

const sortPieChartDataDesc = <T extends { name: string; value: number }>(items: Array<T>) =>
	items.toSorted((a, b) => b.value - a.value || a.name.localeCompare(b.name))

const getDesktopPieLegendPosition = (itemsCount: number) =>
	itemsCount <= 8
		? { right: 12, top: 'middle' as const, orient: 'vertical' as const }
		: { right: 12, top: 12, bottom: 12, orient: 'vertical' as const }

const groupByKey = <T, K>(items: Array<T>, getKey: (item: T) => K): Map<K, Array<T>> => {
	const grouped = new Map<K, Array<T>>()
	for (const item of items) {
		const key = getKey(item)
		const existing = grouped.get(key)
		if (existing) {
			existing.push(item)
		} else {
			grouped.set(key, [item])
		}
	}
	return grouped
}

const sumChartValues = (data: EmissionsChartRow) => {
	let total = 0
	for (const key in data) {
		if (key === 'timestamp') continue
		const value = data[key]
		if (value != null) total += value
	}
	return total
}

function TokenHeader({
	name,
	tokenPrice,
	percentChange,
	geckoId
}: {
	name: string
	tokenPrice: number | undefined
	percentChange: number | null
	geckoId: string | null
}) {
	return (
		<div className="flex w-full items-center gap-3 rounded-lg border border-subtle bg-surface p-3">
			<TokenLogo
				name={name}
				kind="token"
				fallbackSrc={geckoId ? geckoTokenIconUrl(geckoId) : null}
				alt={`Logo of ${name}`}
			/>
			<h1 className="heading-sm">{name}</h1>

			{tokenPrice != null ? (
				<>
					<span className="mx-1 h-5 w-px bg-border-medium" />
					<span className="mono-md-bold">
						{formatUsd(tokenPrice, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					</span>
					{percentChange !== null ? (
						<span className={`mono-md ${percentChange > 0 ? 'text-data-up' : 'text-data-down'}`}>
							{formatPercentChange(percentChange)}
						</span>
					) : null}
				</>
			) : null}
		</div>
	)
}

function TokenStats({
	tokenCircSupply,
	tokenMaxSupply,
	tokenMcap,
	tokenVolume,
	symbol
}: {
	tokenCircSupply: number | undefined
	tokenMaxSupply: number | undefined
	tokenMcap: number | undefined
	tokenVolume: number | undefined
	symbol: string | null | undefined
}) {
	const withSymbol = (amount: string) => (symbol ? `${amount} ${symbol}` : amount)
	const items: Array<InlineStatStripItem> = []
	if (tokenCircSupply != null) {
		items.push({
			label: 'Circ. Supply',
			value: withSymbol(
				formatCompactNumber(tokenCircSupply, {
					minimumCompactValue: 1_000_000,
					compactSuffix: 'lowercase'
				})
			)
		})
	}
	if (tokenMaxSupply != null) {
		items.push({
			label: 'Max Supply',
			value: withSymbol(
				tokenMaxSupply !== Infinity
					? formatCompactNumber(tokenMaxSupply, {
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})
					: '∞'
			)
		})
	}
	if (tokenMcap != null) {
		items.push({
			label: 'MCap',
			value: formatUsd(tokenMcap, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		})
	}
	if (tokenVolume != null) {
		items.push({
			label: 'Vol 24h',
			value: formatUsd(tokenVolume, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		})
	}
	if (items.length === 0) return null
	return <InlineStatStrip items={items} />
}

function TokenAllocationBars({
	tokenAllocation,
	stackColors
}: {
	tokenAllocation: {
		current: Record<string, number>
		final: Record<string, number>
	}
	stackColors: Record<string, string>
}) {
	return (
		<Panel padding="none" className="overflow-hidden">
			<PanelHeader>
				<PanelTitle as="h3">Token Allocation</PanelTitle>
			</PanelHeader>
			<div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
				{(['current', 'final'] as const).map((phase) => {
					const entries = phase === 'current' ? tokenAllocation.current : tokenAllocation.final
					const sorted = Object.entries(entries).sort(([, a], [, b]) => b - a)
					return (
						<div key={phase} className="flex flex-col gap-1.5">
							<span className="label-md text-primary">{capitalizeFirstLetter(phase)}</span>
							{sorted.map(([cat, perc]) => (
								<div key={cat} className="flex flex-col gap-1">
									<div className="flex items-center justify-between gap-2">
										<span className="body-md text-primary">{capitalizeFirstLetter(cat)}</span>
										<span className="mono-md text-secondary">{formatPercent(perc, { input: 'percent' })}</span>
									</div>
									<div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated-2">
										<div
											className="h-full rounded-full"
											style={{
												width: `${Math.min(perc, 100)}%`,
												backgroundColor: stackColors[cat] ?? stackColors[capitalizeFirstLetter(cat)] ?? '#6b7280'
											}}
										/>
									</div>
								</div>
							))}
						</div>
					)
				})}
			</div>
		</Panel>
	)
}

function SourcesNotesSection({ notes, futures }: { notes: Array<string>; futures: ProtocolEmissionResult['futures'] }) {
	if (notes.length === 0 && futures.openInterest == null && futures.fundingRate == null) return null
	return (
		<div className="flex flex-wrap gap-2 *:flex-1">
			{notes.length > 0 ? (
				<Card as="section" padding="sm" className="flex flex-col gap-3">
					<h3 className="heading-xs">Notes</h3>
					<ul className="flex list-disc flex-col gap-2 pl-5 body-md text-primary">
						{notes.map((note) => (
							<li key={note}>{note}</li>
						))}
					</ul>
				</Card>
			) : null}
			{futures.openInterest != null || futures.fundingRate != null ? (
				<Card as="section" padding="sm" className="flex flex-col gap-3">
					<h3 className="heading-xs">Futures</h3>
					<div className="flex flex-col gap-1 body-md text-primary">
						{futures.openInterest != null ? (
							<p>{`Open Interest: ${formatUsd(futures.openInterest, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</p>
						) : null}
						{futures.fundingRate != null ? (
							<p>{`Funding Rate: ${formatPercent(futures.fundingRate, { input: 'percent' })}`}</p>
						) : null}
					</div>
				</Card>
			) : null}
		</div>
	)
}

function ChartContainer({
	data,
	isEmissionsPage,
	initialTokenMarketData,
	generatedAtSec,
	disableClientTokenStatsFetch,
	hideTokenStats
}: {
	data: ResolvedProtocolEmissionResult
	isEmissionsPage: boolean
	initialTokenMarketData: InitialTokenMarketData | null
	generatedAtSec: number
	disableClientTokenStatsFetch: boolean
	hideTokenStats: boolean
}) {
	const width = useBreakpointWidth()
	const router = useRouter()

	const dataTypeParam = readSingleQueryValue(router.query.dataType)
	const dataType: DataType =
		dataTypeParam && (DATA_TYPES as ReadonlyArray<string>).includes(dataTypeParam)
			? (dataTypeParam as DataType)
			: 'documented'

	const chartType: 'bar' | 'line' = readSingleQueryValue(router.query.chartType) === 'bar' ? 'bar' : 'line'
	const allocationMode: 'current' | 'standard' =
		readSingleQueryValue(router.query.groupAllocation) === 'true' ? 'standard' : 'current'
	const legacyPriceMcapParam = readSingleQueryValue(router.query.priceMcap) === 'true'
	const priceParam = readSingleQueryValue(router.query.price)
	const isPriceRequested = legacyPriceMcapParam || priceParam !== 'false'
	const isMcapRequested = legacyPriceMcapParam || readSingleQueryValue(router.query.mcap) === 'true'

	const timeGroupingParam = readSingleQueryValue(router.query.groupBy)
	const timeGrouping: TimeGrouping =
		timeGroupingParam && (TIME_GROUPINGS as ReadonlyArray<string>).includes(timeGroupingParam)
			? (timeGroupingParam as TimeGrouping)
			: 'D'

	const setQueryParam = (key: string, value: string | undefined) => pushShallowQuery(router, { [key]: value })

	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const categoriesFromData = data.categories[dataType]
	const stackColors = data.stackColors[dataType]
	const tbdSections = data.tbdSections
	const forecastSections = data.forecastSections
	const tokenAllocation = data.tokenAllocation[dataType]
	const rawChartData = data.chartData[dataType]
	const pieChartDataRaw = data.pieChartData[dataType]
	const hallmarks = data.hallmarks[dataType]

	const { data: geckoId } = useGeckoId(data.geckoId ? null : data.token)

	const shouldPrefetchTokenStats = !(disableClientTokenStatsFetch ?? false) && !(hideTokenStats ?? false)
	const resolvedGeckoId = data.geckoId ?? geckoId
	const shouldFetchPriceChart = shouldPrefetchTokenStats || isPriceRequested || isMcapRequested
	const priceChart = usePriceChart(shouldFetchPriceChart ? (resolvedGeckoId ?? undefined) : undefined)

	const isPriceChartReady = Boolean(priceChart.data?.data?.prices?.length)
	const isMcapChartReady = Boolean(priceChart.data?.data?.mcaps?.length)
	const isPriceActive = isPriceRequested && isPriceChartReady
	const isMcapActive = isMcapRequested && isMcapChartReady
	const isPriceOverlayLoading = isPriceRequested && !isPriceActive && (priceChart.isLoading || priceChart.isFetching)
	const isMcapOverlayLoading = isMcapRequested && !isMcapActive && (priceChart.isLoading || priceChart.isFetching)
	const isPriceOrMcapLoading = isPriceOverlayLoading || isMcapOverlayLoading

	const chartMarketData = priceChart.data?.data?.coinData?.market_data
	const chartPrices = priceChart.data?.data?.prices
	const chartMcaps = priceChart.data?.data?.mcaps
	const chartVolumes = priceChart.data?.data?.volumes

	const tokenPrice =
		initialTokenMarketData?.price ?? chartPrices?.[chartPrices.length - 1]?.[1] ?? data.tokenPrice.price ?? undefined
	const tokenMcap =
		initialTokenMarketData?.mcap ?? chartMcaps?.[chartMcaps.length - 1]?.[1] ?? data.meta?.mcap ?? undefined
	const tokenVolume = initialTokenMarketData?.volume24h ?? chartVolumes?.[chartVolumes.length - 1]?.[1] ?? undefined
	const tokenCircSupply =
		initialTokenMarketData?.circSupply ?? chartMarketData?.circulating_supply ?? data.meta?.circSupply ?? undefined
	const tokenMaxSupply = resolveTokenMaxSupply(initialTokenMarketData, chartMarketData, data.meta?.maxSupply)

	const ystdPrice = findPriceAtLeast24hAgo(chartPrices)
	const percentChangeFromChart =
		tokenPrice != null && ystdPrice != null ? roundNumber(((tokenPrice - ystdPrice) / ystdPrice) * 100, 2) : null
	const percentChange = initialTokenMarketData?.priceChangePercent ?? percentChangeFromChart ?? null

	const priceChartForOverlay = isPriceActive || isMcapActive ? priceChart.data?.data : null
	const normalizedPriceChart = useMemo(() => {
		if (!priceChartForOverlay) return null
		const prices: Record<number, number> = {}
		for (const [date, price] of priceChartForOverlay.prices ?? []) {
			prices[Math.floor(date / 1e3)] = price
		}
		const mcaps: Record<number, number> = {}
		for (const [date, mcap] of priceChartForOverlay.mcaps ?? []) {
			mcaps[Math.floor(date / 1e3)] = mcap
		}
		return { prices, mcaps }
	}, [priceChartForOverlay])

	const groupedEvents = useMemo(() => groupByKey(data.events, (event) => event.timestamp), [data.events])

	const nowSec = useNowSeconds(generatedAtSec)
	const currentMinuteSec = Math.floor(nowSec / 60) * 60
	const sortedEvents = useMemo(() => {
		const entries = Array.from(groupedEvents.entries())

		const upcomingEvents = entries.filter(([ts]) => ts > currentMinuteSec).sort(([a], [b]) => a - b) // near to far

		const pastEvents =
			upcomingEvents.length > 0
				? entries.filter(([ts]) => ts <= currentMinuteSec).sort(([a], [b]) => a - b) // oldest to newest
				: entries.filter(([ts]) => ts <= currentMinuteSec).sort(([a], [b]) => b - a) // newest to oldest

		return upcomingEvents.length > 0 ? [...pastEvents, ...upcomingEvents] : pastEvents
	}, [groupedEvents, currentMinuteSec])

	const upcomingEventIndex = useMemo(() => {
		const index = sortedEvents.findIndex((events) => {
			const event = events[1][0]
			return event ? event.timestamp > currentMinuteSec : false
		})
		return index === -1 ? 0 : index
	}, [sortedEvents, currentMinuteSec])

	const paginationItems = useMemo(() => {
		return sortedEvents.map(([ts, events]) => (
			<UpcomingEvent
				key={ts}
				{...{
					event: events,
					timestamp: ts,
					price: tokenPrice,
					symbol: data.tokenPrice.symbol,
					mcap: tokenMcap,
					maxSupply: data.meta?.maxSupply,
					name: data.name,
					geckoId: data.geckoId,
					isProtocolPage: true,
					initialNowSec: nowSec
				}}
			/>
		))
	}, [
		sortedEvents,
		tokenPrice,
		tokenMcap,
		data.meta?.maxSupply,
		data.name,
		data.geckoId,
		data.tokenPrice.symbol,
		nowSec
	])

	const chartData = useMemo(() => {
		// Keep chart data independent from the price query unless an overlay is enabled.
		// This prevents the schedule chart from re-rendering when price data finishes loading.
		const filtered: Array<EmissionsChartRow> = []
		for (const chartItem of rawChartData) {
			let nextItem = chartItem
			if (isPriceActive || isMcapActive) {
				const dateSec = Math.floor(chartItem.timestamp / 1e3)
				nextItem = { ...chartItem }

				const mcap = normalizedPriceChart?.mcaps[dateSec]
				const price = normalizedPriceChart?.prices[dateSec]

				if (isMcapActive && mcap) nextItem['Market Cap'] = mcap
				if (isPriceActive && price) nextItem['Price'] = price
			}

			if (sumChartValues(nextItem) > 0) filtered.push(nextItem)
		}

		// Append a flat extension past the last datapoint so the final datapoints aren't squashed against the chart edge
		// with a minimum of 10 days
		if (filtered.length === 0) return filtered
		const dayMs = 24 * 60 * 60 * 1000
		const last = filtered[filtered.length - 1]!
		const spanStart = rawChartData[0]!.timestamp
		const spanEnd = rawChartData[rawChartData.length - 1]!.timestamp
		const extensionDays = Math.max(Math.round(((spanEnd - spanStart) * 0.05) / dayMs), 10)
		const totalExtensionMs = extensionDays * dayMs
		const stepMs =
			filtered.length >= 2 ? Math.max(last.timestamp - filtered[filtered.length - 2]!.timestamp, dayMs) : dayMs
		const numSteps = Math.max(Math.round(totalExtensionMs / stepMs), 1)
		const padding: typeof filtered = []
		const { Price: _Price, 'Market Cap': _mcap, ...lastWithoutOverlays } = last
		for (let i = 1; i <= numSteps; i++) {
			padding.push({
				...lastWithoutOverlays,
				timestamp: last.timestamp + i * stepMs
			})
		}
		return [...filtered, ...padding]
	}, [rawChartData, isPriceActive, isMcapActive, normalizedPriceChart])

	const availableCategories = useMemo(
		() =>
			allocationMode === 'standard'
				? Object.keys(data.categoriesBreakdown ?? {})
				: categoriesFromData.filter((cat) => !EXCLUDED_CHART_CATEGORIES.has(cat)),
		[allocationMode, categoriesFromData, data.categoriesBreakdown]
	)
	// Category names such as "All" and "TBD" are shared by multiple protocols.
	// Scope selection intent to the protocol so client-side route changes cannot
	// carry a coincidentally matching subset into the next authored schedule.
	const protocolSelectionScope = readSingleQueryValue(router.query.protocol) ?? data.name
	const categorySelectionKey = `${protocolSelectionScope}:${dataType}:${allocationMode}`
	const { activeSeries: selectedCategories, setSelectedSeries: setSelectedCategories } = useLocalSelection({
		availableSeries: availableCategories,
		scope: categorySelectionKey
	})

	const displayData = useMemo(() => {
		let result = chartData
		if (allocationMode === 'standard' && data.categoriesBreakdown) {
			result = processGroupedChartData(chartData, data.categoriesBreakdown)
		}
		return groupChartDataByTime(result, timeGrouping)
	}, [allocationMode, chartData, data.categoriesBreakdown, timeGrouping])

	const groupAllocation = useMemo(() => {
		const finalAllocation = tokenAllocation.final
		let hasFinalAllocation = false
		for (const _ in finalAllocation) {
			hasFinalAllocation = true
			break
		}
		if (!hasFinalAllocation) {
			return []
		}
		const result: Array<{ name: string; value: number }> = []
		for (const name in finalAllocation) {
			const value = finalAllocation[name]!
			if (value > 0) {
				result.push({ name, value })
			}
		}
		return sortPieChartDataDesc(result)
	}, [tokenAllocation])

	const pieChartDataAllocation = useMemo(() => {
		const selectedCategoriesSet = new Set(selectedCategories)
		const filtered: Array<{ name: string; value: number }> = []
		for (const item of pieChartDataRaw) {
			if (!selectedCategoriesSet.has(item.name)) continue
			filtered.push({ name: item.name, value: item.value })
		}
		return sortPieChartDataDesc(filtered)
	}, [pieChartDataRaw, selectedCategories])

	const pieChartDataAllocationMode = allocationMode === 'current' ? pieChartDataAllocation : groupAllocation

	const formattedPieChartDataAllocationMode = pieChartDataAllocationMode.map((item) => ({
		...item,
		name: formatUnlockLabel(item.name)
	}))

	const allocationPieStackColors = allocationMode === 'standard' ? standardGroupColors : stackColors
	const standardChartColors = useMemo(() => {
		const colors = { ...standardGroupColors }
		for (const group in data.categoriesBreakdown ?? {}) {
			const baseGroup = group.endsWith(' (forecast)')
				? group.slice(0, -' (forecast)'.length)
				: group.endsWith(' (TBD)')
					? group.slice(0, -' (TBD)'.length)
					: group
			const baseColor = standardGroupColors[baseGroup]
			if (baseColor) colors[group] = baseColor
		}
		return colors
	}, [data.categoriesBreakdown])

	const formattedAllocationPieStackColors = Object.fromEntries(
		Object.entries(allocationPieStackColors).map(([label, color]) => [formatUnlockLabel(label), color])
	)

	const formattedAvailableCategories = availableCategories.map((category) => ({
		key: category,
		name: formatUnlockLabel(category)
	}))

	const chartConfig = useMemo(() => {
		let stacks = selectedCategories
		if (stacks.length === 0 && displayData.length > 0) {
			const first = displayData[0]!
			stacks = []
			for (const k in first) {
				if (k !== 'timestamp' && k !== 'Price' && k !== 'Market Cap') {
					stacks.push(k)
				}
			}
		}
		const finalStacks = chartType === 'bar' ? sortStacksByVolatility(stacks, displayData) : stacks
		const overlayStacks = [...(isMcapActive ? ['Market Cap'] : []), ...(isPriceActive ? ['Price'] : [])]
		return {
			stacks: [...finalStacks, ...overlayStacks].filter(Boolean),
			customYAxis: overlayStacks,
			colors:
				allocationMode === 'standard'
					? isPriceActive || isMcapActive
						? getExtendedColors({
								baseColors: standardChartColors,
								isPriceActive,
								isMcapActive
							})
						: standardChartColors
					: isPriceActive || isMcapActive
						? getExtendedColors({
								baseColors: stackColors,
								isPriceActive,
								isMcapActive
							})
						: stackColors
		}
	}, [
		isPriceActive,
		isMcapActive,
		selectedCategories,
		stackColors,
		standardChartColors,
		allocationMode,
		displayData,
		chartType
	])

	const dataset = useMemo<MultiSeriesChartDataset>(() => {
		const stacks = chartConfig.stacks
		const dimensions = ['timestamp', ...stacks]
		const overlaySet = new Set(chartConfig.customYAxis)
		const source = new Array<MultiSeriesChartDataset['source'][number]>(displayData.length)
		for (let i = 0; i < displayData.length; i++) {
			const entry = displayData[i]!
			const row = new Array<number | null | undefined>(dimensions.length)
			row[0] = entry.timestamp
			let sum = 0
			if (chartType === 'bar') {
				// Price and market cap use separate axes and are not part of the percentage total.
				for (const stack of stacks) {
					const value = entry[stack]
					if (!overlaySet.has(stack) && value != null) sum += value
				}
			}
			for (let stackIndex = 0; stackIndex < stacks.length; stackIndex++) {
				const stack = stacks[stackIndex]!
				const value = entry[stack]
				if (chartType !== 'bar') {
					row[stackIndex + 1] = value
				} else if (overlaySet.has(stack)) {
					row[stackIndex + 1] = value ?? null
				} else {
					const raw = value ?? 0
					row[stackIndex + 1] = sum > 0 ? (raw / sum) * 100 : 0
				}
			}
			source[i] = row
		}
		return { source, dimensions }
	}, [displayData, chartConfig.stacks, chartConfig.customYAxis, chartType])

	const charts = useMemo<NonNullable<IMultiSeriesChartProps['charts']>>(() => {
		const stacks = chartConfig.stacks
		const colors = chartConfig.colors
		const customYAxis = chartConfig.customYAxis
		return stacks.map((name, index) => {
			const yIdx = customYAxis?.indexOf(name) ?? -1
			const isOverlay = yIdx !== -1
			const isTBD = tbdSections.includes(name)
			const isForecast = forecastSections.includes(name)
			return {
				type: isOverlay ? 'line' : chartType,
				name: formatUnlockLabel(name),
				encode: { x: 0, y: index + 1 },
				...(colors[name] === undefined ? {} : { color: colors[name] }),
				...(!isOverlay ? { stack: 'A' } : {}),
				...(isOverlay ? { yAxisIndex: yIdx + 1, valueSymbol: '$', hideAreaStyle: true } : {}),
				...(isTBD ? { isTBD: true } : {}),
				...(isForecast ? { isForecast: true } : {})
			}
		})
	}, [chartConfig.stacks, chartConfig.colors, chartConfig.customYAxis, chartType, tbdSections, forecastSections])

	const unlockedPercent =
		data.meta?.totalLocked != null && data.meta.maxSupply > 0
			? Math.min(100, Math.max(0, 100 - (data.meta.totalLocked / data.meta.maxSupply) * 100))
			: null

	const unlockedPieChartData = useMemo(
		() =>
			unlockedPercent === null
				? []
				: sortPieChartDataDesc([
						{ name: 'Unlocked', value: unlockedPercent },
						{ name: 'Locked', value: 100 - unlockedPercent }
					]),
		[unlockedPercent]
	)
	// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
	const scheduleChartData = useMemo(
		() => ({
			dataset,
			charts,
			groupBy: CHART_GROUP_BY[timeGrouping],
			hallmarks,
			expandTo100Percent: chartType === 'bar'
		}),
		[dataset, charts, timeGrouping, hallmarks, chartType]
	)
	const deferredScheduleChartData = useDeferredValue(scheduleChartData)
	// The pie's colors follow its slices, so they are deferred with them.
	const allocationPie = useMemo(
		() => ({ chartData: formattedPieChartDataAllocationMode, stackColors: formattedAllocationPieStackColors }),
		[formattedPieChartDataAllocationMode, formattedAllocationPieStackColors]
	)
	const deferredAllocationPie = useDeferredValue(allocationPie)
	const deferredUnlockedPieChartData = useDeferredValue(unlockedPieChartData)

	const pieChartLegendTextStyle = useMemo(() => ({ fontSize: width < 640 ? 12 : 14 }), [width])

	const allocationPieChartLegendPosition = useMemo(() => {
		return width < 640
			? { left: 'center', bottom: 0, orient: 'horizontal' as const }
			: getDesktopPieLegendPosition(pieChartDataAllocationMode.length)
	}, [width, pieChartDataAllocationMode.length])

	const unlockedPieChartLegendPosition = useMemo(() => {
		return width < 640
			? { left: 'center', bottom: 0, orient: 'horizontal' as const }
			: getDesktopPieLegendPosition(unlockedPieChartData.length)
	}, [width, unlockedPieChartData.length])

	const allocationExportButtons = useMemo(
		() => ({
			png: true,
			csv: true,
			filename: `${data.name}-allocation`,
			pngTitle: `${data.name} Allocation`
		}),
		[data.name]
	)

	const unlockedExportButtons = useMemo(
		() =>
			unlockedPercent === null
				? null
				: {
						png: true,
						csv: true,
						filename: `${data.name}-unlocked`,
						pngTitle: `${data.name} Unlocked ${formatPercent(unlockedPercent, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
					},
		[data.name, unlockedPercent]
	)

	const hasGroupAllocationData = data.categoriesBreakdown != null && Object.keys(data.categoriesBreakdown).length > 0
	return (
		<>
			{isEmissionsPage && data.name ? (
				<TokenHeader name={data.name} tokenPrice={tokenPrice} percentChange={percentChange} geckoId={data.geckoId} />
			) : null}

			{hideTokenStats ? null : (
				<TokenStats
					tokenCircSupply={tokenCircSupply}
					tokenMaxSupply={tokenMaxSupply}
					tokenMcap={tokenMcap}
					tokenVolume={tokenVolume}
					symbol={data.tokenPrice.symbol}
				/>
			)}

			{data.chartData.realtime.length > 0 ? (
				<TagGroup
					variant="default"
					size="md"
					selectedValue={dataType}
					setValue={(period) => {
						void setQueryParam('dataType', period === 'documented' ? undefined : period)
					}}
					values={DATA_TYPES}
					className="ml-auto"
				/>
			) : null}

			<div className="flex flex-col gap-2">
				{categoriesFromData.length > 0 && rawChartData.length > 0 ? (
					<ChartPanel>
						<ChartPanelToolbar>
							<h3 className="mr-auto heading-xs">Schedule</h3>
							{hasGroupAllocationData ? (
								<Switch
									label="Group Allocation"
									value="group-allocation"
									onChange={() => {
										void setQueryParam('groupAllocation', allocationMode === 'current' ? 'true' : undefined)
									}}
									help="Group token allocations into standardized categories."
									checked={allocationMode === 'standard'}
								/>
							) : null}
							<Switch
								label="Bar Chart"
								value="bar-chart"
								onChange={() => {
									void setQueryParam('chartType', chartType === 'line' ? 'bar' : undefined)
								}}
								checked={chartType === 'bar'}
							/>
							{resolvedGeckoId ? (
								<>
									<Switch
										label="Price"
										value="show=price"
										onChange={() => {
											void pushShallowQuery(router, {
												price: isPriceRequested ? 'false' : undefined,
												mcap: isMcapRequested ? 'true' : undefined,
												priceMcap: undefined
											})
										}}
										checked={isPriceRequested}
										isLoading={isPriceOverlayLoading}
									/>
									<Switch
										label="MCap"
										value="show=mcap"
										onChange={() => {
											void pushShallowQuery(router, {
												mcap: isMcapRequested ? undefined : 'true',
												priceMcap: undefined
											})
										}}
										checked={isMcapRequested}
										isLoading={isMcapOverlayLoading}
									/>
								</>
							) : null}
							<TagGroup
								variant="default"
								size="md"
								selectedValue={timeGrouping}
								setValue={(v) => {
									void setQueryParam('groupBy', v === 'D' ? undefined : v)
								}}
								values={TIME_GROUPINGS}
								className="min-h-8"
							/>
							{availableCategories.length > 1 ? (
								<SelectWithCombobox
									allValues={formattedAvailableCategories}
									selectedValues={selectedCategories}
									setSelectedValues={setSelectedCategories}
									label="Categories"
									labelType="smol"
									variant="filter"
									size="md"
								/>
							) : null}
							<ChartExportButtons
								chartInstance={exportChartInstance}
								filename={`${data.name}-unlock-schedule`}
								title={`${data.name} Unlock Schedule`}
								csvSource={{
									type: 'dataset',
									prepare: () => ({ ...deferredScheduleChartData.dataset, groupBy: deferredScheduleChartData.groupBy })
								}}
							/>
						</ChartPanelToolbar>
						{isPriceOrMcapLoading ? (
							<ChartPanelBodyFallback role="status" aria-live="polite">
								<LoadingIndicator />
							</ChartPanelBodyFallback>
						) : (
							<Suspense fallback={<ChartPanelBodyFallback />}>
								<MultiSeriesChart
									dataset={deferredScheduleChartData.dataset}
									charts={deferredScheduleChartData.charts}
									hallmarks={deferredScheduleChartData.hallmarks}
									hallmarkStyle="mark-line"
									expandTo100Percent={deferredScheduleChartData.expandTo100Percent}
									solidChartAreaStyle
									valueSymbol={data.tokenPrice.symbol ?? ''}
									groupBy={deferredScheduleChartData.groupBy}
									showTotalInTooltip
									onReady={handleChartReady}
									hideDefaultLegend={false}
								/>
							</Suspense>
						)}
					</ChartPanel>
				) : null}

				<div className="grid grid-cols-2 gap-2">
					{data.pieChartData[dataType].length > 0 ? (
						<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
							<Suspense fallback={<ChartPanelExportShellFallback />}>
								<PieChart
									showLegend
									title="Allocation"
									chartData={deferredAllocationPie.chartData}
									stackColors={deferredAllocationPie.stackColors}
									valueSymbol={data.tokenPrice.symbol ?? ''}
									legendPosition={allocationPieChartLegendPosition}
									legendTextStyle={pieChartLegendTextStyle}
									// Give the allocation chart a wider legend column so labels
									// can render without ellipsis, and the pie can sit further left.
									toRight={allocationPieChartLegendToRight}
									// Slightly larger pie to better utilize available canvas.
									radius={allocationPieChartRadius}
									exportButtons={allocationExportButtons}
								/>
							</Suspense>
						</ChartPanel>
					) : null}

					{unlockedPercent !== null && unlockedExportButtons !== null ? (
						<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
							<Suspense fallback={<ChartPanelExportShellFallback />}>
								<PieChart
									showLegend
									title={`Unlocked ${formatPercent(unlockedPercent, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`}
									legendPosition={unlockedPieChartLegendPosition}
									legendTextStyle={pieChartLegendTextStyle}
									radius={unlockedPieChartRadius}
									chartData={deferredUnlockedPieChartData}
									stackColors={unlockedPieChartStackColors}
									valueSymbol="%"
									exportButtons={unlockedExportButtons}
								/>
							</Suspense>
						</ChartPanel>
					) : null}
				</div>
			</div>

			{data.insiders.addresses.length > 0 ? (
				<InsidersTable insiders={data.insiders.addresses} methodology={data.insiders.methodology} token={data.token} />
			) : null}

			{data.token &&
			Object.keys(tokenAllocation.current).length > 0 &&
			Object.keys(tokenAllocation.final).length > 0 ? (
				<TokenAllocationBars tokenAllocation={tokenAllocation} stackColors={stackColors} />
			) : null}

			{data.events.length > 0 ? (
				<Panel padding="none" className="w-full overflow-hidden">
					<PanelHeader>
						<PanelTitle as="h3">Unlock Events</PanelTitle>
					</PanelHeader>
					<div className="p-3">
						<Pagination startIndex={upcomingEventIndex} items={paginationItems} />
					</div>
				</Panel>
			) : null}

			<SourcesNotesSection notes={data.notes} futures={data.futures} />
		</>
	)
}

export function UnlocksCharts({
	protocolName,
	initialData,
	initialTokenMarketData = null,
	generatedAtSec,
	disableClientTokenStatsFetch = false,
	isEmissionsPage = false,
	hideTokenStats = false
}: {
	protocolName: string
	initialData?: ProtocolEmissionResult | null
	initialTokenMarketData?: InitialTokenMarketData | null
	/** The clock `initialData` was built with; data fetched in the browser renders after mount anyway. */
	generatedAtSec: number
	disableClientTokenStatsFetch?: boolean
	isEmissionsPage?: boolean
	hideTokenStats?: boolean
}) {
	const shouldFetch = !initialData
	const { data = null, isLoading, error } = useGetProtocolEmissions(shouldFetch ? slug(protocolName) : null)

	if (shouldFetch && isLoading) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center">
				<LoadingIndicator />
			</div>
		)
	}

	const resolvedData: ProtocolEmissionResult | null = initialData ?? data
	if (!resolvedData || resolvedData.name === null) {
		return (
			<div role="alert" className="flex flex-1 flex-col items-center justify-center">
				<p className="p-2 body-sm text-error">{error instanceof Error ? error.message : 'Failed to fetch'}</p>
			</div>
		)
	}

	return (
		<ChartContainer
			data={resolvedData}
			isEmissionsPage={isEmissionsPage}
			initialTokenMarketData={initialTokenMarketData}
			generatedAtSec={generatedAtSec}
			disableClientTokenStatsFetch={disableClientTokenStatsFetch}
			hideTokenStats={hideTokenStats}
		/>
	)
}
