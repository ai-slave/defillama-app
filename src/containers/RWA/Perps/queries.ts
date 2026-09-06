import { findByRwaSlug, rwaSlug } from '~/containers/RWA/rwaSlug'
import { getPercentChange } from '~/utils'
import { buildRwaChartDatasetTotal, type RWAChartDataset } from '../chartDataset'
import {
	fetchRWAPerpsContractBreakdownChartData,
	fetchRWAPerpsCurrent,
	fetchRWAPerpsFundingHistory,
	fetchRWAPerpsList,
	fetchRWAPerpsMarketChart,
	fetchRWAPerpsMarketBreakdownChartData,
	fetchRWAPerpsMarketsByAsset,
	fetchRWAPerpsMarketsByAssetGroup,
	fetchRWAPerpsMarketsByContract,
	fetchRWAPerpsMarketsByVenue,
	fetchRWAPerpsOverviewBreakdownChartData,
	fetchRWAPerpsStats
} from './api'
import type {
	IRWAPerpsBreakdownChartResponse,
	IRWAPerpsFundingHistoryPoint,
	IRWAPerpsMarket,
	IRWAPerpsMarketChartPoint
} from './api.types'
import { toRWAPerpsBreakdownChartDataset } from './breakdownDataset'
import {
	getRWAPerpsAssetGroupBreakdownLabel,
	getRWAPerpsOverviewSnapshotBreakdownLabel,
	getRWAPerpsVenueSnapshotBreakdownLabel
} from './breakdownLabels'
import { getDefaultRWAPerpsChartBreakdown, getDefaultRWAPerpsChartView } from './chartState'
import type { RWAPerpsTimeSeriesBreakdown } from './chartState'
import { getRWAPerpsIncludedRows } from './dashboardData'
import type {
	IRWAPerpsAssetGroupPageData,
	IRWAPerpsAssetGroupsOverview,
	IRWAPerpsAssetGroupsOverviewRow,
	IRWAPerpsAssetPageData,
	IRWAPerpsAssetsOverview,
	IRWAPerpsAssetsOverviewRow,
	IRWAPerpsContractData,
	IRWAPerpsContractBreakdownRequest,
	IRWAPerpsContractFundingHistoryPoint,
	IRWAPerpsContractMarketChartPoint,
	IRWAPerpsNavLink,
	IRWAPerpsOverviewPageData,
	IRWAPerpsOverviewBreakdownRequest,
	IRWAPerpsVenuePageData,
	IRWAPerpsVenuesOverview,
	IRWAPerpsVenuesOverviewRow,
	RWAPerpsAssetGroupSnapshotBreakdown,
	RWAPerpsAssetSnapshotBreakdown,
	RWAPerpsChartMetricKey,
	RWAPerpsAllChartTarget,
	RWAPerpsAssetClassChartTarget,
	RWAPerpsBaseAssetChartTarget,
	RWAPerpsExcludeAssetClassChartTarget,
	RWAPerpsChartTarget,
	RWAPerpsChartView,
	RWAPerpsOverviewTimeSeriesBreakdown,
	RWAPerpsOverviewSnapshotBreakdown,
	RWAPerpsVenueSnapshotBreakdown
} from './types'

type SnapshotBreakdown =
	| RWAPerpsOverviewSnapshotBreakdown
	| RWAPerpsVenueSnapshotBreakdown
	| RWAPerpsAssetGroupSnapshotBreakdown
	| RWAPerpsAssetSnapshotBreakdown

type BreakdownLabelResolver<TRow, TBreakdown extends string> = (row: TRow, breakdown: TBreakdown) => string

type RWAPerpsOverviewBucket = {
	openInterest: number
	volume24h: number
	markets: number
}

const EMPTY_CHART_DATASET: RWAChartDataset = { source: [], dimensions: ['timestamp'] }

function shouldPreloadInitialChartDataset(activeView: RWAPerpsChartView) {
	return activeView === 'timeSeries'
}

function safeRatio(value: number, total: number): number {
	return total > 0 ? value / total : 0
}

function getPrimaryAssetClass(assetClass: Array<string> | null): string | null {
	return assetClass?.[0] ?? null
}

function normalizeMarketChart(
	points: Array<IRWAPerpsMarketChartPoint>
): Array<IRWAPerpsContractMarketChartPoint> | null {
	if (points.length === 0) return null

	return points.map((point) => ({
		...point,
		timestamp: point.timestamp * 1e3
	}))
}

function normalizeFundingHistory(
	points: Array<IRWAPerpsFundingHistoryPoint>
): Array<IRWAPerpsContractFundingHistoryPoint> | null {
	if (points.length === 0) return null

	return points
}

function resolveContractMarket(markets: Array<IRWAPerpsMarket>, contract: string): IRWAPerpsMarket | null {
	let match: IRWAPerpsMarket | null = null
	for (const market of markets) {
		if (market.contract !== contract) continue
		if (match) return null
		match = market
	}
	return match
}

function buildSnapshotBreakdownTotals<TBreakdown extends SnapshotBreakdown>({
	rows,
	breakdown,
	key,
	getBreakdownLabel
}: {
	rows: Array<IRWAPerpsMarket>
	breakdown: TBreakdown
	key: RWAPerpsChartMetricKey
	getBreakdownLabel: BreakdownLabelResolver<IRWAPerpsMarket, TBreakdown>
}): Array<{ name: string; value: number }> {
	const totalsByLabel = new Map<string, number>()

	for (const row of rows) {
		const label = getBreakdownLabel(row, breakdown)
		if (!label) continue

		const value = key === 'markets' ? 1 : row[key]
		if (value < 0) continue

		totalsByLabel.set(label, (totalsByLabel.get(label) ?? 0) + value)
	}

	return [...totalsByLabel.entries()]
		.map(([name, value]) => ({ name, value }))
		.filter((item) => item.value > 0)
		.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

export function hasEnoughTimeSeriesHistory(dataset: RWAChartDataset) {
	const firstTimestampBySeries = new Map<string, number>()
	for (const row of dataset.source) {
		for (const series in row) {
			if (series === 'timestamp' || row[series] == null) continue
			const firstTimestamp = firstTimestampBySeries.get(series)
			if (firstTimestamp === undefined) {
				firstTimestampBySeries.set(series, row.timestamp)
			} else if (firstTimestamp !== row.timestamp) {
				return true
			}
		}
	}
	return false
}

export function groupRWAPerpsTimeSeriesDataset(dataset: RWAChartDataset): RWAChartDataset {
	return buildRwaChartDatasetTotal({ dataset, onlyTotal: true })
}

export function appendRWAPerpsTimeSeriesDatasetTotal(dataset: RWAChartDataset): RWAChartDataset {
	return buildRwaChartDatasetTotal({ dataset })
}

function toVenueDetailLink(venue: string) {
	return `/rwa/perps/venue/${rwaSlug(venue)}`
}

export function sumProtocolFees24h(markets: Array<IRWAPerpsMarket>) {
	return sumMarketMetric(markets, 'estimatedProtocolFees24h')
}

export function sumMarketMetric(
	markets: Array<IRWAPerpsMarket>,
	key: 'openInterest' | 'volume24h' | 'estimatedProtocolFees24h'
) {
	let total = 0
	for (const market of markets) {
		total += market[key]
	}
	return total
}

function sortMarketsByOpenInterest(markets: Array<IRWAPerpsMarket>) {
	return markets.toSorted((a, b) => b.openInterest - a.openInterest)
}

function derivePreviousValueFromPercentChange(currentValue: number, percentChange: number | null): number | null {
	if (percentChange == null) return null

	const denominator = 1 + percentChange / 100
	if (denominator <= 0) return null

	return currentValue / denominator
}

function getAggregateMarketChange24h(
	markets: Array<IRWAPerpsMarket>,
	config: {
		valueKey: 'openInterest' | 'volume24h'
		changeKey: 'openInterestChange24h' | 'volume24hChange24h'
		minCoverage?: number
	}
): number | null {
	const minCoverage = config.minCoverage ?? 0.95
	let totalCurrent = 0
	let comparableCurrent = 0
	let comparablePrevious = 0
	let hasComparableMarket = false

	for (const market of markets) {
		const currentValue = market[config.valueKey]
		totalCurrent += currentValue

		if (currentValue <= 0 && market[config.changeKey] == null) continue

		const previousValue = derivePreviousValueFromPercentChange(currentValue, market[config.changeKey])
		if (previousValue == null) continue

		comparableCurrent += currentValue
		comparablePrevious += previousValue
		hasComparableMarket = true
	}

	if (!hasComparableMarket || comparablePrevious <= 0) return null
	if (totalCurrent > 0 && comparableCurrent / totalCurrent < minCoverage) return null

	return getPercentChange(comparableCurrent, comparablePrevious)
}

export function getAggregateOpenInterestChange24h(markets: Array<IRWAPerpsMarket>): number | null {
	return getAggregateMarketChange24h(markets, {
		valueKey: 'openInterest',
		changeKey: 'openInterestChange24h'
	})
}

export function getAggregateVolume24hChange24h(markets: Array<IRWAPerpsMarket>): number | null {
	return getAggregateMarketChange24h(markets, {
		valueKey: 'volume24h',
		changeKey: 'volume24hChange24h'
	})
}

export async function getRWAPerpsContractData({
	contract
}: {
	contract: string
}): Promise<IRWAPerpsContractData | null> {
	try {
		const markets = await fetchRWAPerpsMarketsByContract(contract)
		if (markets.length === 0) {
			return null
		}

		const market = resolveContractMarket(markets, contract)
		if (!market) {
			return null
		}

		const [marketChart, fundingHistory] = await Promise.all([
			fetchRWAPerpsMarketChart(market.id)
				.then(normalizeMarketChart)
				.catch(() => null),
			fetchRWAPerpsFundingHistory(market.id)
				.then(normalizeFundingHistory)
				.catch(() => null)
		])

		const displayName = market.referenceAsset ?? market.contract.split(':')[1] ?? market.contract

		return {
			contract: {
				contract,
				displayName,
				venue: market.venue,
				baseAsset: market.referenceAsset,
				baseAssetGroup: market.referenceAssetGroup,
				assetClass: getPrimaryAssetClass(market.assetClass),
				rwaClassification: market.rwaClassification,
				accessModel: market.accessModel,
				parentPlatform: market.parentPlatform,
				issuer: market.issuer,
				website: market.website?.[0] ?? null,
				link: market.link ?? null,
				oracleProvider: market.oracleProvider,
				description: market.description,
				categories: market.category ?? []
			},
			market,
			marketChart,
			fundingHistory
		}
	} catch (error) {
		console.error(`[rwa-perps] getRWAPerpsContractData failed for ${contract}:`, error)
		return null
	}
}

export function buildRWAPerpsOverviewSnapshotBreakdownTotals({
	rows,
	breakdown,
	key
}: {
	rows: Array<IRWAPerpsMarket>
	breakdown: RWAPerpsOverviewSnapshotBreakdown
	key: RWAPerpsChartMetricKey
}) {
	return buildSnapshotBreakdownTotals({
		rows,
		breakdown,
		key,
		getBreakdownLabel: getRWAPerpsOverviewSnapshotBreakdownLabel
	})
}

export function buildRWAPerpsVenueSnapshotBreakdownTotals({
	rows,
	breakdown,
	key
}: {
	rows: Array<IRWAPerpsMarket>
	breakdown: RWAPerpsVenueSnapshotBreakdown
	key: RWAPerpsChartMetricKey
}) {
	return buildSnapshotBreakdownTotals({
		rows,
		breakdown,
		key,
		getBreakdownLabel: getRWAPerpsVenueSnapshotBreakdownLabel
	})
}

export function buildRWAPerpsAssetGroupSnapshotBreakdownTotals({
	rows,
	breakdown,
	key
}: {
	rows: Array<IRWAPerpsMarket>
	breakdown: RWAPerpsAssetGroupSnapshotBreakdown
	key: RWAPerpsChartMetricKey
}) {
	return buildSnapshotBreakdownTotals({
		rows,
		breakdown,
		key,
		getBreakdownLabel: getRWAPerpsOverviewSnapshotBreakdownLabel
	})
}

export function buildRWAPerpsAssetSnapshotBreakdownTotals({
	rows,
	breakdown,
	key
}: {
	rows: Array<IRWAPerpsMarket>
	breakdown: RWAPerpsAssetSnapshotBreakdown
	key: RWAPerpsChartMetricKey
}) {
	return buildSnapshotBreakdownTotals({
		rows,
		breakdown,
		key,
		getBreakdownLabel: getRWAPerpsOverviewSnapshotBreakdownLabel
	})
}

function toAssetGroupDetailLink(assetGroup: string) {
	return `/rwa/perps/asset-group/${rwaSlug(assetGroup)}`
}

async function getRequiredOverviewBreakdownRows(
	request: IRWAPerpsOverviewBreakdownRequest
): Promise<IRWAPerpsBreakdownChartResponse> {
	const rows = await fetchRWAPerpsOverviewBreakdownChartData(request)
	if (!rows) throw new Error('Failed to get RWA perps breakdown chart data')
	return rows
}

async function getRequiredContractBreakdownRows(
	request: IRWAPerpsContractBreakdownRequest
): Promise<IRWAPerpsBreakdownChartResponse> {
	const rows = await fetchRWAPerpsContractBreakdownChartData(request)
	if (!rows) throw new Error('Failed to get RWA perps contract breakdown chart data')
	return rows
}

export async function getRWAPerpsBreakdownChartDataset(
	request: IRWAPerpsOverviewBreakdownRequest
): Promise<RWAChartDataset> {
	const rows = await getRequiredOverviewBreakdownRows(request)
	return toRWAPerpsBreakdownChartDataset(rows)
}

export async function getRWAPerpsContractBreakdownChartDataset(
	request: IRWAPerpsContractBreakdownRequest
): Promise<RWAChartDataset> {
	const rows = await getRequiredContractBreakdownRows(request)
	return toRWAPerpsBreakdownChartDataset(rows)
}

export async function getRWAPerpsMarketBreakdownChartDataset(
	request: Parameters<typeof fetchRWAPerpsMarketBreakdownChartData>[0]
): Promise<RWAChartDataset> {
	const rows = await fetchRWAPerpsMarketBreakdownChartData(request)
	if (!rows) throw new Error('Failed to get RWA perps market breakdown chart data')
	return toRWAPerpsBreakdownChartDataset(rows)
}

type InitialTimeSeriesDatasetRequest =
	| {
			mode: 'asset'
			target: RWAPerpsBaseAssetChartTarget
			includeCex?: boolean
	  }
	| {
			mode: 'overview' | 'venue' | 'assetGroup'
			target: RWAPerpsChartTarget
			defaultTimeSeriesBreakdown?: RWAPerpsTimeSeriesBreakdown
			includeCex?: boolean
	  }

async function getInitialTimeSeriesDataset(request: InitialTimeSeriesDatasetRequest): Promise<RWAChartDataset> {
	const includeCex = request.includeCex ?? false
	if (request.mode === 'asset') {
		return getRWAPerpsMarketBreakdownChartDataset({ key: 'openInterest', target: request.target, includeCex })
	}

	const chartDefaults = request.defaultTimeSeriesBreakdown
		? { timeSeriesBreakdown: request.defaultTimeSeriesBreakdown }
		: undefined
	const defaultBreakdown = getDefaultRWAPerpsChartBreakdown(request.mode, 'timeSeries', chartDefaults)
	if (defaultBreakdown === 'contract') {
		return getRWAPerpsContractBreakdownChartDataset({
			key: 'openInterest',
			target: request.target,
			includeCex
		})
	}

	return getRWAPerpsBreakdownChartDataset({
		breakdown: defaultBreakdown,
		key: 'openInterest',
		target: request.target,
		includeCex
	})
}

export async function getRWAPerpsOverview({
	activeView = getDefaultRWAPerpsChartView('overview'),
	target = { kind: 'all' },
	defaultTimeSeriesBreakdown
}: {
	activeView?: RWAPerpsChartView
	target?: RWAPerpsAllChartTarget | RWAPerpsAssetClassChartTarget | RWAPerpsExcludeAssetClassChartTarget
	defaultTimeSeriesBreakdown?: RWAPerpsOverviewTimeSeriesBreakdown
} = {}): Promise<IRWAPerpsOverviewPageData> {
	const [stats, current] = await Promise.all([fetchRWAPerpsStats(true), fetchRWAPerpsCurrent(true)])

	const initialChartDataset = shouldPreloadInitialChartDataset(activeView)
		? await getInitialTimeSeriesDataset({
				mode: 'overview',
				target,
				...(defaultTimeSeriesBreakdown ? { defaultTimeSeriesBreakdown } : {})
			})
		: EMPTY_CHART_DATASET
	const totalOpenInterest = sumMarketMetric(current, 'openInterest')
	const totalVolume24h = sumMarketMetric(current, 'volume24h')

	return {
		markets: sortMarketsByOpenInterest(current),
		initialChartDataset,
		totals: {
			openInterest: totalOpenInterest,
			openInterestChange24h: getAggregateOpenInterestChange24h(current),
			volume24h: totalVolume24h,
			volume24hChange24h: getAggregateVolume24hChange24h(current),
			markets: stats.totalMarkets,
			protocolFees24h: sumProtocolFees24h(current),
			cumulativeFunding: stats.totalCumulativeFunding
		}
	}
}

export async function getRWAPerpsVenuePage({
	venue,
	activeView = getDefaultRWAPerpsChartView('venue')
}: {
	venue: string
	activeView?: RWAPerpsChartView
}): Promise<IRWAPerpsVenuePageData | null> {
	const [list, stats] = await Promise.all([fetchRWAPerpsList(true), fetchRWAPerpsStats(true)])

	const resolvedVenue = findByRwaSlug(venue, list.venues)
	if (!resolvedVenue) return null

	const venueResponse = await fetchRWAPerpsMarketsByVenue(resolvedVenue).catch(() => null)
	if (!venueResponse) return null

	const markets = venueResponse
	if (markets.length === 0) return null

	const initialChartDataset = shouldPreloadInitialChartDataset(activeView)
		? await getInitialTimeSeriesDataset({ mode: 'venue', target: { kind: 'venue', slug: resolvedVenue } })
		: EMPTY_CHART_DATASET

	const statsBucket = stats.byVenue?.[resolvedVenue]
	const totalOpenInterest = sumMarketMetric(markets, 'openInterest')
	const totalVolume24h = sumMarketMetric(markets, 'volume24h')

	return {
		venue: resolvedVenue,
		markets: sortMarketsByOpenInterest(markets),
		initialChartDataset,
		venueLinks: [
			{ label: 'All', to: '/rwa/perps/venues' },
			...list.venues.map((item) => ({ label: item, to: toVenueDetailLink(item) }))
		],
		totals: {
			openInterest: totalOpenInterest,
			openInterestChange24h: getAggregateOpenInterestChange24h(markets),
			volume24h: totalVolume24h,
			volume24hChange24h: getAggregateVolume24hChange24h(markets),
			markets: statsBucket?.markets ?? markets.length,
			protocolFees24h: sumProtocolFees24h(markets)
		}
	}
}

export async function getRWAPerpsVenuesOverview(): Promise<IRWAPerpsVenuesOverview> {
	const [markets, initialChartDataset] = await Promise.all([
		fetchRWAPerpsCurrent(true),
		getRWAPerpsBreakdownChartDataset({
			breakdown: 'venue',
			key: 'openInterest',
			target: { kind: 'all' },
			includeCex: false
		})
	])
	const dexMarkets = markets.filter((market) => market.venueType !== 'CEX')

	return {
		rows: buildRWAPerpsVenuesOverviewRows(markets),
		dexRows: buildRWAPerpsVenuesOverviewRows(dexMarkets),
		initialChartDataset
	}
}

export function buildRWAPerpsVenuesOverviewRows(markets: Array<IRWAPerpsMarket>): Array<IRWAPerpsVenuesOverviewRow> {
	const eligibleMarkets = getRWAPerpsIncludedRows(markets, 'overview')
	const totalOpenInterest = sumMarketMetric(eligibleMarkets, 'openInterest')
	const totalVolume24h = sumMarketMetric(eligibleMarkets, 'volume24h')
	const totalsByVenue = new Map<string, RWAPerpsOverviewBucket>()

	for (const market of markets) {
		const bucket = totalsByVenue.get(market.venue)
		if (bucket) {
			bucket.openInterest += market.openInterest
			bucket.volume24h += market.volume24h
			bucket.markets++
		} else {
			totalsByVenue.set(market.venue, {
				openInterest: market.openInterest,
				volume24h: market.volume24h,
				markets: 1
			})
		}
	}

	const rows: Array<IRWAPerpsVenuesOverviewRow> = []
	for (const [venue, bucket] of totalsByVenue) {
		rows.push({
			venue,
			openInterest: bucket.openInterest,
			openInterestShare: safeRatio(bucket.openInterest, totalOpenInterest),
			volume24h: bucket.volume24h,
			volume24hShare: safeRatio(bucket.volume24h, totalVolume24h),
			markets: bucket.markets
		})
	}

	return rows.sort((a, b) => b.openInterest - a.openInterest)
}

export async function getRWAPerpsAssetGroupPage({
	assetGroup,
	activeView = getDefaultRWAPerpsChartView('assetGroup')
}: {
	assetGroup: string
	activeView?: RWAPerpsChartView
}): Promise<IRWAPerpsAssetGroupPageData | null> {
	const [list, stats] = await Promise.all([fetchRWAPerpsList(true), fetchRWAPerpsStats(true)])

	const resolvedAssetGroup = findByRwaSlug(assetGroup, list.assetGroups)
	if (!resolvedAssetGroup) return null

	const markets = await fetchRWAPerpsMarketsByAssetGroup(resolvedAssetGroup, true).catch(() => null)
	if (!markets?.length) return null

	const initialChartDataset = shouldPreloadInitialChartDataset(activeView)
		? await getInitialTimeSeriesDataset({
				mode: 'assetGroup',
				target: { kind: 'assetGroup', slug: resolvedAssetGroup }
			})
		: EMPTY_CHART_DATASET

	const statsBucket = stats.byAssetGroup?.[resolvedAssetGroup]
	const totalOpenInterest = sumMarketMetric(markets, 'openInterest')
	const totalVolume24h = sumMarketMetric(markets, 'volume24h')

	return {
		assetGroup: resolvedAssetGroup,
		markets: sortMarketsByOpenInterest(markets),
		initialChartDataset,
		assetGroupLinks: [
			{ label: 'All', to: '/rwa/perps/asset-groups' },
			...list.assetGroups.map((item) => ({ label: item, to: toAssetGroupDetailLink(item) }))
		],
		totals: {
			openInterest: totalOpenInterest,
			openInterestChange24h: getAggregateOpenInterestChange24h(markets),
			volume24h: totalVolume24h,
			volume24hChange24h: getAggregateVolume24hChange24h(markets),
			markets: statsBucket?.markets ?? markets.length,
			protocolFees24h: sumProtocolFees24h(markets)
		}
	}
}

export async function getRWAPerpsAssetGroupsOverview(): Promise<IRWAPerpsAssetGroupsOverview> {
	const [markets, initialChartDataset] = await Promise.all([
		fetchRWAPerpsCurrent(true),
		getRWAPerpsBreakdownChartDataset({
			breakdown: 'assetGroup',
			key: 'openInterest',
			target: { kind: 'all' },
			includeCex: false
		})
	])
	const dexMarkets = markets.filter((market) => market.venueType !== 'CEX')

	return {
		rows: buildRWAPerpsAssetGroupsOverviewRows(markets),
		dexRows: buildRWAPerpsAssetGroupsOverviewRows(dexMarkets),
		initialChartDataset
	}
}

export function buildRWAPerpsAssetGroupsOverviewRows(
	markets: Array<IRWAPerpsMarket>
): Array<IRWAPerpsAssetGroupsOverviewRow> {
	const eligibleMarkets = getRWAPerpsIncludedRows(markets, 'assetGroup')
	const totalOpenInterest = sumMarketMetric(eligibleMarkets, 'openInterest')
	const totalVolume24h = sumMarketMetric(eligibleMarkets, 'volume24h')
	const totalsByAssetGroup = new Map<string, RWAPerpsOverviewBucket>()

	for (const market of eligibleMarkets) {
		const assetGroup = getRWAPerpsAssetGroupBreakdownLabel(market)
		const bucket = totalsByAssetGroup.get(assetGroup)
		if (bucket) {
			bucket.openInterest += market.openInterest
			bucket.volume24h += market.volume24h
			bucket.markets++
		} else {
			totalsByAssetGroup.set(assetGroup, {
				openInterest: market.openInterest,
				volume24h: market.volume24h,
				markets: 1
			})
		}
	}

	const rows: Array<IRWAPerpsAssetGroupsOverviewRow> = []
	for (const [assetGroup, bucket] of totalsByAssetGroup) {
		rows.push({
			assetGroup,
			openInterest: bucket.openInterest,
			openInterestShare: safeRatio(bucket.openInterest, totalOpenInterest),
			volume24h: bucket.volume24h,
			volume24hShare: safeRatio(bucket.volume24h, totalVolume24h),
			markets: bucket.markets
		})
	}

	return rows.sort((a, b) => b.openInterest - a.openInterest)
}

type RWAPerpsAssetOverviewBucket = {
	assetGroups: Set<string>
	openInterest: number
	volume24h: number
	markets: number
	venues: Set<string>
	dexVenues: Set<string>
	cexVenues: Set<string>
	fundingRateMin: number
	fundingRateMax: number
}

export function buildRWAPerpsAssetsOverviewRows(markets: Array<IRWAPerpsMarket>): Array<IRWAPerpsAssetsOverviewRow> {
	const totalsByAsset = new Map<string, RWAPerpsAssetOverviewBucket>()

	for (const market of getRWAPerpsIncludedRows(markets, 'asset')) {
		if (!market.referenceAsset) continue

		const bucket = totalsByAsset.get(market.referenceAsset)
		if (bucket) {
			bucket.assetGroups.add(getRWAPerpsAssetGroupBreakdownLabel(market))
			bucket.openInterest += market.openInterest
			bucket.volume24h += market.volume24h
			bucket.markets++
			bucket.venues.add(market.venue)
			bucket[market.venueType === 'CEX' ? 'cexVenues' : 'dexVenues'].add(market.venue)
			bucket.fundingRateMin = Math.min(bucket.fundingRateMin, market.fundingRate)
			bucket.fundingRateMax = Math.max(bucket.fundingRateMax, market.fundingRate)
			continue
		}

		const venueTypeSet = new Set([market.venue])
		totalsByAsset.set(market.referenceAsset, {
			assetGroups: new Set([getRWAPerpsAssetGroupBreakdownLabel(market)]),
			openInterest: market.openInterest,
			volume24h: market.volume24h,
			markets: 1,
			venues: new Set([market.venue]),
			dexVenues: market.venueType === 'DEX' ? venueTypeSet : new Set(),
			cexVenues: market.venueType === 'CEX' ? venueTypeSet : new Set(),
			fundingRateMin: market.fundingRate,
			fundingRateMax: market.fundingRate
		})
	}

	const rows: Array<IRWAPerpsAssetsOverviewRow> = []
	for (const [asset, bucket] of totalsByAsset) {
		rows.push({
			asset,
			assetGroups: [...bucket.assetGroups].sort((a, b) => a.localeCompare(b)),
			openInterest: bucket.openInterest,
			volume24h: bucket.volume24h,
			markets: bucket.markets,
			venues: bucket.venues.size,
			dexVenues: bucket.dexVenues.size,
			cexVenues: bucket.cexVenues.size,
			fundingRateMin: bucket.fundingRateMin,
			fundingRateMax: bucket.fundingRateMax
		})
	}

	return rows.sort((a, b) => b.openInterest - a.openInterest || a.asset.localeCompare(b.asset))
}

export async function getRWAPerpsAssetsOverview(): Promise<IRWAPerpsAssetsOverview> {
	const markets = await fetchRWAPerpsCurrent(true)
	const dexMarkets = markets.filter((market) => market.venueType !== 'CEX')

	return {
		rows: buildRWAPerpsAssetsOverviewRows(markets),
		dexRows: buildRWAPerpsAssetsOverviewRows(dexMarkets),
		initialChartDataset: null
	}
}

export async function getRWAPerpsAssetPage({
	asset,
	assetLinks,
	activeView = getDefaultRWAPerpsChartView('asset')
}: {
	asset: string
	assetLinks: Array<IRWAPerpsNavLink>
	activeView?: RWAPerpsChartView
}): Promise<IRWAPerpsAssetPageData> {
	const markets = await fetchRWAPerpsMarketsByAsset(asset, true)

	const includeCexByDefault = markets.every((market) => market.venueType === 'CEX')
	const initialChartDataset = shouldPreloadInitialChartDataset(activeView)
		? await getInitialTimeSeriesDataset({
				mode: 'asset',
				target: { kind: 'baseAsset', slug: asset },
				includeCex: includeCexByDefault
			})
		: EMPTY_CHART_DATASET
	const totalOpenInterest = sumMarketMetric(markets, 'openInterest')
	const totalVolume24h = sumMarketMetric(markets, 'volume24h')

	return {
		asset,
		markets: sortMarketsByOpenInterest(markets),
		initialChartDataset,
		assetLinks,
		totals: {
			openInterest: totalOpenInterest,
			openInterestChange24h: getAggregateOpenInterestChange24h(markets),
			volume24h: totalVolume24h,
			volume24hChange24h: getAggregateVolume24hChange24h(markets),
			markets: markets.length,
			protocolFees24h: sumProtocolFees24h(markets)
		}
	}
}
