import type { NextApiRequest, NextApiResponse } from 'next'
import { DIMENSION_DATASET_SPECS } from '~/containers/AdapterMetrics/server/datasets'
import { fetchChainsDatasetRows } from '~/containers/ChainsByCategory/server/dataset'
import { getChartBuilderQueryKey, resolveChartBuilderFilterMode } from '~/containers/ProDashboard/chartBuilderQueryKey'
import { buildProDashboardChartSourcePlan } from '~/containers/ProDashboard/chartSourcePlan'
import { sanitizeRowHeaders } from '~/containers/ProDashboard/components/UnifiedTable/utils/rowHeaders'
import type { DashboardStreamChunk } from '~/containers/ProDashboard/dashboardStreamContract'
import {
	getProEquitiesFilingsQueryKey,
	getProEquitiesStatementsQueryKey
} from '~/containers/ProDashboard/equitiesTableQueryKeys'
import { buildProDashboardProtocolRelations } from '~/containers/ProDashboard/protocolCatalog'
import {
	extractYieldsItems,
	fetchAppMetadata,
	fetchDashboardConfig,
	fetchProtocolsAndChains,
	fetchSingleChartData,
	withTimeout
} from '~/containers/ProDashboard/queries.server'
import { getProRwaBreakdown, getProRwaBreakdownQueryKey } from '~/containers/ProDashboard/rwaBreakdown'
import { fetchProDimensionDataset } from '~/containers/ProDashboard/server/dimensionDataset'
import { buildProtocolTvlStreamSourcePlan } from '~/containers/ProDashboard/server/protocolTvlSourcePlan'
import {
	buildStablecoinsTableData,
	buildStablecoinsChartCacheValue,
	fetchStablecoinAssetChartCacheValue
} from '~/containers/ProDashboard/server/stablecoinFetchers'
import { partitionDashboardStreamItems } from '~/containers/ProDashboard/server/stream/stages'
import { fetchTableServerData } from '~/containers/ProDashboard/server/tableQueries'
import { fetchProtocolsTable } from '~/containers/ProDashboard/server/unifiedTable/protocols'
import { fetchProYieldsDataset } from '~/containers/ProDashboard/server/yieldsDataset'
import ProtocolChartBuilderData from '~/containers/ProDashboard/services/ProtocolChartBuilderData'
import { getProtocolTvlValueQueryKey } from '~/containers/ProDashboard/services/protocolTvl'
import {
	getProCexShareQueryKey,
	getProChainsDatasetQueryKey,
	getProDimensionDatasetQueryKey,
	getProStablecoinsTableQueryKey,
	getProYieldsDatasetQueryKey,
	PRO_CEX_SNAPSHOT_QUERY_KEY,
	PRO_CEX_TOTALS_QUERY_KEY
} from '~/containers/ProDashboard/tableQueryKeys'
import type {
	ChartBuilderConfig,
	IncomeStatementConfig,
	ProtocolsTableConfig,
	RWAAssetChartConfig,
	RWAOverviewChartConfig,
	StablecoinsChartConfig,
	StablecoinAssetChartConfig,
	UnifiedTableConfig
} from '~/containers/ProDashboard/types'
import { normalizeYieldChartType } from '~/containers/ProDashboard/types'
import { getUnifiedTableQueryIdentity } from '~/containers/ProDashboard/unifiedTableQuery'
import { STREAM_PROTOCOL_SERIES_SKIP_METRICS } from '~/containers/ProDashboard/utils/breakdownMetrics'
import { fetchProtocolTvlChart } from '~/containers/ProtocolOverview/api'
import { getProtocolIncomeStatement } from '~/containers/ProtocolOverview/queries'
import type { IFetchedRWAProject } from '~/containers/RWA/api.types'
import type { IRWABreakdownChartResponse } from '~/containers/RWA/api.types'
import {
	fetchStablecoinAssetsApi,
	fetchStablecoinChartApi,
	fetchStablecoinPricesApi,
	fetchStablecoinRatesApi
} from '~/containers/Stablecoins/api'
import { getProtocolEmissionsPieData, getProtocolEmissionsScheduleData } from '~/containers/Unlocks/queries'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from '~/containers/Yields/poolDetail/fetch'
import { slug } from '~/utils'
import type { ChartSeries } from '~/utils/breakdowns'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'

export const config = {
	api: { responseLimit: false }
}

function getAuthToken(req: NextApiRequest): string | null {
	const normalizeToken = (value: string | undefined): string | null => {
		const token = value?.trim().replace(/^Bearer\s+/i, '')
		if (!token || token === 'null' || token === 'undefined') return null
		return token
	}

	const authHeader = req.headers?.authorization
	const value = Array.isArray(authHeader) ? authHeader[0] : authHeader
	const normalizedAuthToken = normalizeToken(value)
	if (normalizedAuthToken) return normalizedAuthToken

	return normalizeToken(req.cookies['pb_auth_token'])
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.status(405).end()
		return
	}

	const dashboardId = req.query.dashboardId as string
	if (!dashboardId) {
		res.status(400).end()
		return
	}

	const authToken = getAuthToken(req)
	let streamEnded = false

	const writeLine = (chunk: DashboardStreamChunk) => {
		if (streamEnded || res.destroyed) return
		try {
			res.write(JSON.stringify(chunk) + '\n')
		} catch {}
	}
	const endStream = () => {
		if (streamEnded) return
		streamEnded = true
		res.end()
	}

	try {
		// The page may already have sanitized render config, but the stream still fetches the
		// trusted record to authorize the request and plan/cache its dashboard data sources.
		let dashboard: Awaited<ReturnType<typeof fetchDashboardConfig>> = null
		try {
			dashboard = await fetchDashboardConfig(dashboardId, authToken)
		} catch {
			dashboard = null
		}

		// Set streaming headers — only cache at edge for confirmed-public, unauthenticated reads
		const canCacheAtEdge = !authToken && dashboard?.visibility === 'public'
		res.setHeader('Content-Type', 'application/x-ndjson')
		res.setHeader('X-Accel-Buffering', 'no')
		res.setHeader('Vary', 'Cookie, Authorization')
		res.setHeader(
			'Cache-Control',
			canCacheAtEdge
				? 'public, s-maxage=300, stale-while-revalidate=3600'
				: 'private, no-cache, no-store, must-revalidate'
		)

		writeLine({ type: 'dashboard', data: dashboard })

		// Catalog and app metadata are independent. Only source planning waits for the catalog.
		const protocolsAndChainsPromise = fetchProtocolsAndChains()
			.then((d) => {
				writeLine({ type: 'protocolsAndChains', data: d })
				return d
			})
			.catch(() => null)
		let resolvedAppMetadata: Awaited<ReturnType<typeof fetchAppMetadata>> = null
		void fetchAppMetadata()
			.then((d) => {
				resolvedAppMetadata = d
				writeLine({ type: 'appMetadata', data: d })
			})
			.catch(() => {})

		const dashboardItems = dashboard?.data?.items
		if (!dashboardItems?.length) {
			await Promise.allSettled([protocolsAndChainsPromise])
			writeLine({ type: 'done' })
			endStream()
			return
		}

		let stablecoinAssetsPromise: ReturnType<typeof fetchStablecoinAssetsApi> | null = null
		const getStablecoinAssets = () => (stablecoinAssetsPromise ??= fetchStablecoinAssetsApi())
		let stablecoinTableBaselinePromise: Promise<{
			peggedData: Awaited<ReturnType<typeof fetchStablecoinAssetsApi>>
			priceData: Awaited<ReturnType<typeof fetchStablecoinPricesApi>>
			rateData: Awaited<ReturnType<typeof fetchStablecoinRatesApi>>
		}> | null = null
		const getStablecoinTableBaseline = () =>
			(stablecoinTableBaselinePromise ??= Promise.all([
				getStablecoinAssets(),
				fetchStablecoinPricesApi(),
				fetchStablecoinRatesApi()
			]).then(([peggedData, priceData, rateData]) => ({ peggedData, priceData, rateData })))
		let rwaAssetsTablePromise: Promise<IFetchedRWAProject[]> | null = null
		const getRwaAssetsTable = () =>
			(rwaAssetsTablePromise ??= import('~/containers/RWA/api').then(({ fetchRWAActiveTVLs }) =>
				withTimeout(fetchRWAActiveTVLs(), 10_000)
			))
		const claimedStreamSources = new Set<string>()
		const claimStreamSource = (kind: string, key: readonly unknown[]) => {
			const sourceKey = `${kind}:${JSON.stringify(key)}`
			if (claimedStreamSources.has(sourceKey)) return false
			claimedStreamSources.add(sourceKey)
			return true
		}

		for (const items of partitionDashboardStreamItems(dashboardItems)) {
			// Sources within a stage resolve independently. Later rows do not start until the initial
			// card window settles, and the client fallback gate stays closed until every stage finishes.
			const phase2Promises: Promise<unknown>[] = [protocolsAndChainsPromise]
			type DatasetType = NonNullable<ProtocolsTableConfig['datasetType']>
			const tableItemsByDataset = new Map<DatasetType, ProtocolsTableConfig[]>()
			for (const item of items) {
				if (item.kind !== 'table' || item.tableType !== 'dataset') continue
				// Old stablecoin tables were persisted before datasetType was introduced.
				const datasetType = item.datasetType ?? 'stablecoins'
				const datasetItems = tableItemsByDataset.get(datasetType)
				if (datasetItems) datasetItems.push(item)
				else tableItemsByDataset.set(datasetType, [item])
			}
			const getTableItems = (datasetType: DatasetType) => tableItemsByDataset.get(datasetType) ?? []
			// Chart and metric cards share the same raw source and observer-local presentation.
			phase2Promises.push(
				(async () => {
					const catalog = await protocolsAndChainsPromise
					const protocolRelations = buildProDashboardProtocolRelations(catalog)
					const chartSourcePromises = buildProDashboardChartSourcePlan(items, catalog, resolvedAppMetadata)
						.filter((source) => claimStreamSource('chart', source.queryKey))
						.map((source) =>
							(source.skipReason
								? Promise.resolve([])
								: withTimeout(fetchSingleChartData(source.request, 'all', null, protocolRelations), 10_000)
							)
								.then((data) => {
									writeLine({ type: 'chartData', queryKey: source.queryKey, data })
								})
								.catch(() => {})
						)
					await Promise.allSettled(chartSourcePromises)
				})()
			)

			// Table data — single chunk
			phase2Promises.push(
				fetchTableServerData(items, claimStreamSource)
					.then((data) => {
						if (data) writeLine({ type: 'tableData', data })
					})
					.catch(() => {})
			)

			// Yields — stream per pool
			const yieldsItems = extractYieldsItems(items)
			const needsByPool = new Map<string, { supply: boolean; borrow: boolean }>()
			for (const item of yieldsItems) {
				const needs = needsByPool.get(item.poolConfigId) ?? { supply: false, borrow: false }
				const chartType = normalizeYieldChartType(item.chartType)
				if (chartType === 'borrow-apy' || chartType === 'net-borrow-apy') needs.borrow = true
				else needs.supply = true
				needsByPool.set(item.poolConfigId, needs)
			}
			for (const [poolConfigId, needs] of needsByPool) {
				const fetchSupply = needs.supply && claimStreamSource('yields-chart-supply', [poolConfigId])
				const fetchBorrow = needs.borrow && claimStreamSource('yields-chart-borrow', [poolConfigId])
				if (!fetchSupply && !fetchBorrow) continue
				phase2Promises.push(
					(async () => {
						const [supplyResult, borrowResult] = await Promise.allSettled([
							fetchSupply ? withTimeout(fetchPoolDetailHistory(poolConfigId, 'max'), 10_000) : Promise.resolve(null),
							fetchBorrow
								? withTimeout(fetchBorrowMarketDetailHistory(poolConfigId, 'max'), 10_000)
								: Promise.resolve(null)
						])
						writeLine({
							type: 'yieldsChartData',
							id: poolConfigId,
							data: {
								...(fetchSupply && supplyResult.status === 'fulfilled' ? { supply: supplyResult.value } : null),
								...(fetchBorrow && borrowResult.status === 'fulfilled' ? { borrow: borrowResult.value } : null)
							}
						})
					})().catch(() => {})
				)
			}

			// Advanced TVL basic data — stream per protocol
			const advTvlProtocols = new Set<string>()
			for (const item of items) {
				if (item.kind === 'advanced-tvl' && item.chartType === 'tvl') {
					advTvlProtocols.add(item.protocol)
				}
			}
			for (const protocol of advTvlProtocols) {
				const queryKey = getProtocolTvlValueQueryKey(protocol)
				if (!claimStreamSource('advanced-tvl', queryKey)) continue
				phase2Promises.push(
					withTimeout(fetchProtocolTvlChart({ protocol }), 10_000)
						.then((data) => {
							writeLine({ type: 'protocolTvlChartData', queryKey, data: data ?? [] })
						})
						.catch(() => {})
				)
			}

			// Stream only the base V2 breakdown required by each active Advanced TVL or Borrowed view.
			// User-enabled extra TVL keys live in local storage and are fetched by the client after this stream completes.
			phase2Promises.push(
				(async () => {
					const catalog = await protocolsAndChainsPromise
					const sourcePromises = buildProtocolTvlStreamSourcePlan(items, catalog)
						.filter(({ queryKey }) => claimStreamSource('protocol-tvl', queryKey))
						.map(({ queryKey, request }) =>
							withTimeout(fetchProtocolTvlChart(request), 15_000)
								.then((data) => {
									writeLine({ type: 'protocolTvlChartData', queryKey, data: data ?? [] })
								})
								.catch(() => {})
						)
					await Promise.allSettled(sourcePromises)
				})()
			)

			// Unified table data — stream per config
			const unifiedTableItems = items.filter((item): item is UnifiedTableConfig => item.kind === 'unified-table')
			const seenUnifiedTableKeys = new Set<string>()
			for (const utConfig of unifiedTableItems) {
				const headers = sanitizeRowHeaders(utConfig.rowHeaders)
				const { queryKey } = getUnifiedTableQueryIdentity(utConfig, headers)
				const cacheKey = JSON.stringify(queryKey)
				if (seenUnifiedTableKeys.has(cacheKey) || !claimStreamSource('unified-table', [cacheKey])) continue
				seenUnifiedTableKeys.add(cacheKey)
				phase2Promises.push(
					(async () => {
						const data = await withTimeout(fetchProtocolsTable({ config: utConfig, rowHeaders: headers }), 15_000)
						if (data) writeLine({ type: 'unifiedTableData', key: cacheKey, data })
					})().catch(() => {})
				)
			}

			// Stablecoins chart data — shared baseline then per-chain
			const stablecoinsItems = items.filter((item): item is StablecoinsChartConfig => item.kind === 'stablecoins')
			if (stablecoinsItems.length > 0) {
				phase2Promises.push(
					(async () => {
						const FETCH_TIMEOUT = 10_000
						try {
							const peggedData = await withTimeout(getStablecoinAssets(), FETCH_TIMEOUT)

							const uniqueChains = new Set<string>()
							for (const item of stablecoinsItems) uniqueChains.add(item.chain)

							const chainPromises: Promise<void>[] = []
							for (const chain of uniqueChains) {
								if (!claimStreamSource('stablecoins-chart', [chain])) continue
								chainPromises.push(
									(async () => {
										const chainLabel = chain === 'All' ? 'all' : chain
										const chainData = await withTimeout(fetchStablecoinChartApi(chainLabel), FETCH_TIMEOUT)
										const data = buildStablecoinsChartCacheValue({
											peggedData,
											chainData,
											chain
										})

										writeLine({
											type: 'stablecoinsChartData',
											chain,
											data
										})
									})().catch(() => {})
								)
							}
							await Promise.allSettled(chainPromises)
						} catch {}
					})()
				)
			}

			// RWA overview chart data — stream per unique breakdown+metric+chain combo
			const rwaOverviewItems = items.filter((item): item is RWAOverviewChartConfig => item.kind === 'rwa-overview')
			const rwaAssetItems = items.filter((item): item is RWAAssetChartConfig => item.kind === 'rwa-asset')

			if (rwaOverviewItems.length > 0 || rwaAssetItems.length > 0) {
				const rwaApi = await import('~/containers/RWA/api')

				const seenOverviewKeys = new Set<string>()
				for (const item of rwaOverviewItems) {
					const { metric, chain } = item
					const breakdown = getProRwaBreakdown(item.breakdown)
					const resolvedChain = chain || 'All'
					const cacheKey = JSON.stringify(getProRwaBreakdownQueryKey(breakdown, metric, resolvedChain))
					if (seenOverviewKeys.has(cacheKey) || !claimStreamSource('rwa-overview', [cacheKey])) continue
					seenOverviewKeys.add(cacheKey)

					phase2Promises.push(
						(async () => {
							let data: IRWABreakdownChartResponse | null = null
							if (resolvedChain !== 'All') {
								data = await withTimeout(
									rwaApi.fetchRWAChartMetricDataByAsset({
										target: { kind: 'chain', slug: resolvedChain },
										metric,
										includeStablecoins: false,
										includeGovernance: false
									}),
									10_000
								)
							} else {
								const breakdownParams = {
									key: metric,
									includeStablecoin: false,
									includeGovernance: false
								}
								switch (breakdown) {
									case 'category':
										data = await withTimeout(rwaApi.fetchRWACategoryBreakdownChartData(breakdownParams), 10_000)
										break
									case 'platform':
										data = await withTimeout(rwaApi.fetchRWAPlatformBreakdownChartData(breakdownParams), 10_000)
										break
									case 'assetGroup':
										data = await withTimeout(rwaApi.fetchRWAAssetGroupBreakdownChartData(breakdownParams), 10_000)
										break
									default:
										data = await withTimeout(rwaApi.fetchRWAChainBreakdownChartData(breakdownParams), 10_000)
										break
								}
							}
							if (data) {
								const { toRwaPositionalChartDataset } = await import('~/containers/RWA/breakdownDataset')
								writeLine({
									type: 'rwaBreakdownData',
									breakdown,
									metric,
									chain: resolvedChain,
									data: toRwaPositionalChartDataset(data)
								})
							}
						})().catch(() => {})
					)
				}

				const seenAssetIds = new Set<string>()
				for (const item of rwaAssetItems) {
					const { assetId } = item
					if (!assetId || seenAssetIds.has(assetId) || !claimStreamSource('rwa-asset', [assetId])) continue
					seenAssetIds.add(assetId)

					phase2Promises.push(
						withTimeout(rwaApi.fetchRWAAssetChartData(assetId), 10_000)
							.then((data) => {
								if (data) writeLine({ type: 'rwaAssetChartData', id: assetId, data })
							})
							.catch(() => {})
					)
				}
			}

			// RWA table data — stream assets list and/or stats
			const rwaSelectedChainItems = getTableItems('rwa-selected-chain')
			const hasRwaAssetsTable = getTableItems('rwa').length > 0 || rwaSelectedChainItems.length > 0
			const hasRwaChainsTable = getTableItems('rwa-chains').length > 0

			if (hasRwaAssetsTable) {
				phase2Promises.push(
					(async () => {
						const data = await getRwaAssetsTable()
						if (data) {
							if (claimStreamSource('rwa-assets-table', [])) writeLine({ type: 'rwaAssetsTableData', data })
							const seenChains = new Set<string>()
							for (const item of rwaSelectedChainItems) {
								const chain = item.datasetChain || 'Ethereum'
								if (seenChains.has(chain) || !claimStreamSource('rwa-chain-assets-table', [chain])) continue
								seenChains.add(chain)
								writeLine({ type: 'rwaChainAssetsTableData', chain, data })
							}
						}
					})().catch(() => {})
				)
			}

			if (hasRwaChainsTable && claimStreamSource('rwa-chains-table', [])) {
				phase2Promises.push(
					(async () => {
						const { fetchRWAStats: fetchStats } = await import('~/containers/RWA/api')
						const data = await withTimeout(fetchStats(), 10_000)
						if (data) {
							writeLine({ type: 'rwaChainsTableData', data })
						}
					})().catch(() => {})
				)
			}

			// Equities table data — stream companies list, statements, and filings
			const hasEquitiesCompaniesTable = getTableItems('equities').length > 0
			const equitiesFinancialsItems = getTableItems('equities-financials')
			const equitiesFilingsItems = getTableItems('equities-filings')

			if (hasEquitiesCompaniesTable && claimStreamSource('equities-companies', [])) {
				phase2Promises.push(
					(async () => {
						const { fetchEquitiesCompanies } = await import('~/containers/Equities/api')
						const data = await withTimeout(fetchEquitiesCompanies(), 15_000)
						if (data) {
							writeLine({ type: 'equitiesCompaniesData', data })
						}
					})().catch(() => {})
				)
			}

			const seenEquitiesStatementsTickers = new Set<string>()
			for (const item of equitiesFinancialsItems) {
				const tickerParam = item.datasetChain
				const queryKey = getProEquitiesStatementsQueryKey(tickerParam || '')
				const queryTicker = queryKey?.[2]
				if (
					queryTicker &&
					!seenEquitiesStatementsTickers.has(queryTicker) &&
					claimStreamSource('equities-statements', [queryTicker])
				) {
					seenEquitiesStatementsTickers.add(queryTicker)
					phase2Promises.push(
						(async () => {
							const { fetchEquitiesStatements } = await import('~/containers/Equities/api')
							const { parseEquityTickerCountryParam, buildEquityTickerCountrySlug } =
								await import('~/containers/Equities/tickerCountry')
							const tickerCountry = parseEquityTickerCountryParam(queryTicker)
							if (!tickerCountry) return
							const data = await withTimeout(
								fetchEquitiesStatements(tickerCountry.ticker, tickerCountry.country),
								15_000
							)
							if (data) {
								writeLine({
									type: 'equitiesStatementsData',
									ticker: buildEquityTickerCountrySlug(tickerCountry.ticker, tickerCountry.country),
									data
								})
							}
						})().catch(() => {})
					)
				}
			}

			const seenEquitiesFilingsTickers = new Set<string>()
			for (const item of equitiesFilingsItems) {
				const tickerParam = item.datasetChain
				const queryKey = getProEquitiesFilingsQueryKey(tickerParam || '')
				const queryTicker = queryKey?.[2]
				if (
					queryTicker &&
					!seenEquitiesFilingsTickers.has(queryTicker) &&
					claimStreamSource('equities-filings', [queryTicker])
				) {
					seenEquitiesFilingsTickers.add(queryTicker)
					phase2Promises.push(
						(async () => {
							const { fetchEquitiesFilings } = await import('~/containers/Equities/api')
							const { parseEquityTickerCountryParam, buildEquityTickerCountrySlug } =
								await import('~/containers/Equities/tickerCountry')
							const tickerCountry = parseEquityTickerCountryParam(queryTicker)
							if (!tickerCountry) return
							const data = await withTimeout(fetchEquitiesFilings(tickerCountry.ticker, tickerCountry.country), 15_000)
							if (data) {
								writeLine({
									type: 'equitiesFilingsData',
									ticker: buildEquityTickerCountrySlug(tickerCountry.ticker, tickerCountry.country),
									data
								})
							}
						})().catch(() => {})
					)
				}
			}

			// Emission data — stream per task
			const emissionTasks: Array<{
				key: string
				fn: () => Promise<unknown>
			}> = []
			const seenPieKeys = new Set<string>()
			const seenScheduleKeys = new Set<string>()
			for (const item of items) {
				if (item.kind === 'unlocks-pie') {
					const cacheKey = JSON.stringify(['pro-dashboard', 'unlocks-pie', item.protocol])
					if (!seenPieKeys.has(cacheKey) && claimStreamSource('emissions-pie', [cacheKey])) {
						seenPieKeys.add(cacheKey)
						emissionTasks.push({
							key: cacheKey,
							fn: () => withTimeout(getProtocolEmissionsPieData(slug(item.protocol)), 10_000)
						})
					}
				} else if (item.kind === 'unlocks-schedule') {
					const resolvedDataType = item.dataType === 'realtime' ? 'documented' : item.dataType
					const cacheKey = JSON.stringify(['pro-dashboard', 'unlocks-schedule', item.protocol, resolvedDataType])
					if (!seenScheduleKeys.has(cacheKey) && claimStreamSource('emissions-schedule', [cacheKey])) {
						seenScheduleKeys.add(cacheKey)
						emissionTasks.push({
							key: cacheKey,
							fn: () => withTimeout(getProtocolEmissionsScheduleData(slug(item.protocol)), 10_000)
						})
					}
				}
			}
			for (const task of emissionTasks) {
				phase2Promises.push(
					task
						.fn()
						.then((data) => {
							if (data) writeLine({ type: 'emissionData', key: task.key, data })
						})
						.catch(() => {})
				)
			}

			// Dimension dataset tables — seed under the per-card hook keys
			const seenDimensionDatasetKeys = new Set<string>()
			for (const spec of DIMENSION_DATASET_SPECS) {
				const matchingItems = getTableItems(spec.datasetType)
				for (const item of matchingItems) {
					const itemChains = item.chains
					const cacheKey = JSON.stringify(getProDimensionDatasetQueryKey(spec.datasetType, itemChains))
					if (seenDimensionDatasetKeys.has(cacheKey) || !claimStreamSource('dimension-dataset', [cacheKey])) continue
					seenDimensionDatasetKeys.add(cacheKey)
					phase2Promises.push(
						withTimeout(fetchProDimensionDataset(spec, itemChains), 15_000)
							.then((data) => {
								if (data) writeLine({ type: 'dimensionDatasetData', key: cacheKey, data })
							})
							.catch(() => {})
					)
				}
			}

			// CEX analytics dataset tables — seed under the per-view hook keys
			const cexAnalyticsItems = [...getTableItems('cex'), ...getTableItems('cex-analytics')]
			if (cexAnalyticsItems.length > 0) {
				let needsSnapshot = false
				let needsTotals = false
				const shareSpecs = new Map<string, { metric: 'spot' | 'derivatives'; topNData: number }>()
				for (const item of cexAnalyticsItems) {
					// `efficiency` is a legacy persisted view migrated to comparison by the editor and renderer.
					const rawView =
						item.datasetType === 'cex'
							? 'comparison'
							: (item.cexAnalyticsView as typeof item.cexAnalyticsView | 'efficiency')
					const view = rawView === 'efficiency' ? 'comparison' : rawView || 'comparison'
					if (view === 'summary' || view === 'comparison') {
						if (!needsSnapshot) needsSnapshot = claimStreamSource('cex-snapshot', [])
					} else if (view === 'spot-vs-derivatives') {
						if (!needsTotals) needsTotals = claimStreamSource('cex-totals', [])
					} else if (view === 'market-share') {
						const metric = item.cexAnalyticsMetric === 'spot' ? 'spot' : 'derivatives'
						const topNRaw = item.cexAnalyticsTopN ?? 8
						const topNData = Math.min(Math.max(topNRaw, 1), 12)
						const shareKey = JSON.stringify(getProCexShareQueryKey(metric, topNRaw))
						if (!shareSpecs.has(shareKey) && claimStreamSource('cex-share', [shareKey])) {
							shareSpecs.set(shareKey, { metric, topNData })
						}
					}
				}
				if (needsSnapshot || needsTotals || shareSpecs.size > 0) {
					phase2Promises.push(
						(async () => {
							const { getCexAnalyticsMarketShare, getCexAnalyticsSnapshot, getCexAnalyticsTotals } =
								await import('~/containers/Cexs/server/analytics')
							const tasks: Promise<void>[] = []
							if (needsSnapshot) {
								tasks.push(
									withTimeout(getCexAnalyticsSnapshot(), 15_000)
										.then((data) => {
											if (data)
												writeLine({
													type: 'cexAnalyticsData',
													key: JSON.stringify(PRO_CEX_SNAPSHOT_QUERY_KEY),
													data
												})
										})
										.catch(() => {})
								)
							}
							if (needsTotals) {
								tasks.push(
									withTimeout(getCexAnalyticsTotals(), 15_000)
										.then((data) => {
											if (data)
												writeLine({
													type: 'cexAnalyticsData',
													key: JSON.stringify(PRO_CEX_TOTALS_QUERY_KEY),
													data
												})
										})
										.catch(() => {})
								)
							}
							for (const [shareKey, { metric, topNData }] of shareSpecs) {
								tasks.push(
									withTimeout(getCexAnalyticsMarketShare(metric, topNData), 15_000)
										.then((data) => {
											if (data) writeLine({ type: 'cexAnalyticsData', key: shareKey, data })
										})
										.catch(() => {})
								)
							}
							await Promise.allSettled(tasks)
						})().catch(() => {})
					)
				}
			}

			// Chains dataset tables
			const seenChainsKeys = new Set<string>()
			for (const item of getTableItems('chains')) {
				const category = item.datasetChain
				const cacheKey = JSON.stringify(getProChainsDatasetQueryKey(category))
				if (seenChainsKeys.has(cacheKey) || !claimStreamSource('chains-dataset', [cacheKey])) continue
				seenChainsKeys.add(cacheKey)
				phase2Promises.push(
					withTimeout(fetchChainsDatasetRows({ category }), 15_000)
						.then((data) => {
							if (data) writeLine({ type: 'chainsDatasetData', key: cacheKey, data })
						})
						.catch(() => {})
				)
			}

			// Yields dataset tables
			const seenYieldsTableKeys = new Set<string>()
			const yieldsTables = getTableItems('yields').filter((item) =>
				claimStreamSource('yields-dataset', [JSON.stringify(getProYieldsDatasetQueryKey(item.chains))])
			)
			if (yieldsTables.length > 0) {
				const yieldsSnapshot = await import('~/containers/Yields/server/dataset.server').then(
					({ acquireYieldsSnapshot }) => acquireYieldsSnapshot('background')
				)
				for (const item of yieldsTables) {
					const itemChains = item.chains
					const cacheKey = JSON.stringify(getProYieldsDatasetQueryKey(itemChains))
					if (seenYieldsTableKeys.has(cacheKey)) continue
					seenYieldsTableKeys.add(cacheKey)
					phase2Promises.push(
						withTimeout(fetchProYieldsDataset(yieldsSnapshot, itemChains), 15_000)
							.then((data) => {
								if (data) writeLine({ type: 'yieldsDatasetData', key: cacheKey, data })
							})
							.catch(() => {})
					)
				}
			}

			// Stablecoins dataset tables
			const seenStablecoinsTableKeys = new Set<string>()
			for (const item of getTableItems('stablecoins')) {
				const chain = item.datasetChain || 'All'
				const cacheKey = JSON.stringify(getProStablecoinsTableQueryKey(chain))
				if (seenStablecoinsTableKeys.has(cacheKey) || !claimStreamSource('stablecoins-table', [cacheKey])) continue
				seenStablecoinsTableKeys.add(cacheKey)
				phase2Promises.push(
					(async () => {
						const [baseline, chainData] = await Promise.all([
							withTimeout(getStablecoinTableBaseline(), 15_000),
							withTimeout(fetchStablecoinChartApi(chain === 'All' ? 'all-llama-app' : chain), 15_000)
						])
						const data = buildStablecoinsTableData({ baseline, chainData, chain })
						writeLine({ type: 'stablecoinsTableData', key: cacheKey, data })
					})().catch(() => {})
				)
			}

			// Stablecoin asset chart items
			const seenStablecoinAssetSlugs = new Set<string>()
			const stablecoinAssetItems = items.filter(
				(item): item is StablecoinAssetChartConfig => item.kind === 'stablecoin-asset'
			)
			for (const item of stablecoinAssetItems) {
				const slugId = item.stablecoinId
				if (!slugId || seenStablecoinAssetSlugs.has(slugId) || !claimStreamSource('stablecoin-asset', [slugId]))
					continue
				seenStablecoinAssetSlugs.add(slugId)
				const cacheKey = JSON.stringify(['pro-dashboard', 'stablecoin-asset-chart-data', slugId])
				phase2Promises.push(
					withTimeout(fetchStablecoinAssetChartCacheValue(slugId), 15_000)
						.then((data) => {
							if (data) writeLine({ type: 'stablecoinAssetData', key: cacheKey, data })
						})
						.catch(() => {})
				)
			}

			// Income statement items
			const incomeStatementItems = items.filter(
				(item): item is IncomeStatementConfig => item.kind === 'income-statement'
			)
			const seenIncomeProtocols = new Set<string>()
			if (incomeStatementItems.length > 0) {
				const metadataModule = await import('~/utils/metadata')
				const { protocolMetadata } = metadataModule.default
				const metadataByDisplayNameSlug = new Map<string, IProtocolMetadata>()
				for (const key in protocolMetadata) {
					const record = protocolMetadata[key]
					metadataByDisplayNameSlug.set(slug(record.displayName), record)
				}
				for (const incomeItem of incomeStatementItems) {
					const protocol = incomeItem.protocol
					if (!protocol || seenIncomeProtocols.has(protocol) || !claimStreamSource('income-statement', [protocol]))
						continue
					seenIncomeProtocols.add(protocol)
					const metadata = metadataByDisplayNameSlug.get(slug(protocol))
					if (!metadata) continue
					const cacheKey = JSON.stringify(['pro-dashboard', 'income-statement', protocol])
					phase2Promises.push(
						withTimeout(getProtocolIncomeStatement({ metadata }), 15_000)
							.then((data) => {
								if (data) writeLine({ type: 'incomeStatementData', key: cacheKey, data })
							})
							.catch(() => {})
					)
				}
			}

			// Chart builder items
			const chartBuilderItems = items.filter((item): item is ChartBuilderConfig => item.kind === 'builder')
			const seenChartBuilderKeys = new Set<string>()
			for (const builderItem of chartBuilderItems) {
				const cfg = builderItem.config
				const filterMode = cfg.filterMode
				const chainFilterMode = resolveChartBuilderFilterMode(cfg.chainFilterMode, filterMode)
				const categoryFilterMode = resolveChartBuilderFilterMode(cfg.categoryFilterMode, filterMode)
				const chainCategoryFilterMode = resolveChartBuilderFilterMode(cfg.chainCategoryFilterMode, filterMode)
				const protocolCategoryFilterMode = resolveChartBuilderFilterMode(cfg.protocolCategoryFilterMode, filterMode)
				const cacheKey = JSON.stringify(getChartBuilderQueryKey(cfg))
				if (seenChartBuilderKeys.has(cacheKey) || !claimStreamSource('chart-builder', [cacheKey])) continue
				seenChartBuilderKeys.add(cacheKey)
				phase2Promises.push(
					(async () => {
						try {
							let result: { series: ChartSeries[] } = { series: [] }
							if (cfg.mode === 'protocol') {
								const data = await withTimeout(
									ProtocolChartBuilderData.getProtocolChainData(
										cfg.protocol,
										cfg.metric,
										cfg.chains.length > 0 ? cfg.chains : undefined,
										cfg.limit,
										chainFilterMode,
										cfg.chainCategories?.length > 0 ? cfg.chainCategories : undefined,
										cfg.protocolCategories?.length > 0 ? cfg.protocolCategories : undefined,
										chainCategoryFilterMode,
										protocolCategoryFilterMode
									),
									15_000
								)
								let series = data?.series ?? []
								if (cfg.hideOthers || cfg.chainCategories?.length > 0 || cfg.protocolCategories?.length > 0) {
									series = series.filter((entry) => !entry.name.startsWith('Others'))
								}
								result = { series }
							} else if (!STREAM_PROTOCOL_SERIES_SKIP_METRICS.has(cfg.metric)) {
								const data = await withTimeout(
									ProtocolChartBuilderData.getProtocolBreakdownData(
										cfg.metric as Exclude<
											ChartBuilderConfig['config']['metric'],
											'stablecoins' | 'chain-fees' | 'chain-revenue'
										>,
										cfg.chains,
										cfg.limit,
										cfg.categories,
										cfg.groupByParent,
										chainFilterMode,
										categoryFilterMode
									),
									15_000
								)
								let series = data?.series ?? []
								if (cfg.hideOthers || cfg.chainCategories?.length > 0) {
									series = series.filter((entry) => !entry.name.startsWith('Others'))
								}
								result = { series }
							}
							writeLine({ type: 'chartBuilderData', key: cacheKey, data: result })
						} catch {}
					})()
				)
			}

			await Promise.allSettled(phase2Promises)
		}

		writeLine({ type: 'done' })
		endStream()
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		if (!res.destroyed) {
			writeLine({ type: 'done' })
			endStream()
		}
	}
}

export default withApiRouteTelemetry('/api/dynamic/pro-dashboard/[dashboardId]/stream', handler)
