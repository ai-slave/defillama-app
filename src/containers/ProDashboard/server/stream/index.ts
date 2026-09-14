import type { NextApiRequest, NextApiResponse } from 'next'
import { createDimensionDatasetRequestScope } from '~/containers/AdapterMetrics/server/datasets'
import { fetchChainsDatasetRows } from '~/containers/ChainsByCategory/server/dataset'
import { fetchOracleMetrics } from '~/containers/Oracles/api'
import { getChartBuilderQueryKey } from '~/containers/ProDashboard/chartBuilderQueryKey'
import {
	buildProDashboardChartSourcePlan,
	type ProDashboardChartSourcePlanEntry
} from '~/containers/ProDashboard/chartSourcePlan'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import { streamPrefetchItemIds } from '~/containers/ProDashboard/dashboardLayout/buildDashboardLayout'
import {
	dashboardItemHasStreamSources,
	dashboardStreamNeedsProtocolCatalog
} from '~/containers/ProDashboard/dashboardStreamCapabilities'
import {
	INITIAL_DASHBOARD_STREAM_ITEM_COUNT,
	type DashboardStreamChunk
} from '~/containers/ProDashboard/dashboardStreamContract'
import {
	createVariableCatalog,
	dashboardHasBindings,
	readVariableOverridesFromQuery,
	resolveDashboardItems
} from '~/containers/ProDashboard/dashboardVariables/resolve'
import { getEquitiesTableQueryKey } from '~/containers/ProDashboard/equitiesTableQueryKeys'
import { toPublicDashboardResponse } from '~/containers/ProDashboard/initialDashboard'
import { buildProDashboardProtocolRelations } from '~/containers/ProDashboard/protocolCatalog'
import {
	fetchAppMetadata,
	fetchDashboardConfig,
	fetchProtocolsAndChains,
	fetchSingleChartData,
	withTimeout
} from '~/containers/ProDashboard/queries.server'
import { getProRwaBreakdownQueryKey } from '~/containers/ProDashboard/rwaBreakdown'
import { fetchChartBuilderServerData } from '~/containers/ProDashboard/server/chartBuilder/data'
import {
	buildProtocolTvlStreamSourcePlan,
	type ProtocolTvlStreamSource
} from '~/containers/ProDashboard/server/protocolTvlSourcePlan'
import {
	chartPlanSourceKey,
	createStreamItemReadiness,
	createStreamSourceRegistry
} from '~/containers/ProDashboard/server/stream/itemReadiness'
import { createBoundedTaskScheduler } from '~/containers/ProDashboard/server/stream/taskScheduler'
import { streamProTokenUsageData } from '~/containers/ProDashboard/server/tableQueries'
import { fetchProtocolsTable } from '~/containers/ProDashboard/server/unifiedTable/protocols'
import { fetchProYieldsDataset } from '~/containers/ProDashboard/server/yieldsDataset'
import {
	buildStablecoinsChartCacheValue,
	buildStablecoinsTableData,
	fetchStablecoinAssetChartCacheValue
} from '~/containers/ProDashboard/stablecoinData'
import {
	getProCexShareQueryKey,
	getProChainsDatasetQueryKey,
	getProStablecoinsTableQueryKey,
	getProYieldsDatasetQueryKey,
	PRO_CEX_SNAPSHOT_QUERY_KEY,
	PRO_CEX_TOTALS_QUERY_KEY
} from '~/containers/ProDashboard/tableQueryKeys'
import type {
	ChartBuilderConfig,
	DatasetTableConfig,
	IncomeStatementConfig,
	RWAAssetChartConfig,
	RWAOverviewChartConfig,
	StablecoinAssetChartConfig,
	StablecoinsChartConfig
} from '~/containers/ProDashboard/types'
import { MAX_MULTI_CHART_SERIES, normalizeYieldChartType } from '~/containers/ProDashboard/types'
import { createProtocolsUnifiedTableResponse } from '~/containers/ProDashboard/unifiedTable/contracts'
import { buildUnifiedTableStreamSourcePlan } from '~/containers/ProDashboard/unifiedTableSourcePlan'
import { STREAM_PROTOCOL_SERIES_SKIP_METRICS } from '~/containers/ProDashboard/utils/breakdownMetrics'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { fetchProtocolTvlChart } from '~/containers/ProtocolOverview/api'
import { getProtocolIncomeStatement } from '~/containers/ProtocolOverview/queries'
import { buildProtocolValueChartQueryKey } from '~/containers/ProtocolOverview/valueChartSources'
import type { IFetchedRWAProject, IRWABreakdownChartResponse } from '~/containers/RWA/api.types'
import {
	fetchStablecoinAssetsApi,
	fetchStablecoinChartApi,
	fetchStablecoinPeggedConfigApi,
	fetchStablecoinPricesApi,
	fetchStablecoinRatesApi
} from '~/containers/Stablecoins/api'
import { getProtocolEmissionsPieData, getProtocolEmissionsScheduleData } from '~/containers/Unlocks/queries'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from '~/containers/Yields/poolDetail/fetch'
import { resolveSubscription } from '~/containers/Yields/server/requestSubscription'
import { slug } from '~/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { recordRouteRuntimeError, recordRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'

export const config = {
	api: { responseLimit: false }
}

export const DASHBOARD_STREAM_SOURCE_CONCURRENCY = 8
export const DASHBOARD_STREAM_CLASSIC_SOURCE_LIMIT = MAX_MULTI_CHART_SERIES
export const DASHBOARD_CONFIG_STREAM_TIMEOUT_MS = 8000
const CHART_BUILDER_STREAM_TIMEOUT_MS = 25_000

const normalizeToken = (value: string | undefined): string | null => {
	const token = value?.trim().replace(/^Bearer\s+/i, '')
	if (!token || token === 'null' || token === 'undefined') return null
	return token
}

function getAuthToken(req: NextApiRequest): string | null {
	const authHeader = req.headers?.authorization
	const value = Array.isArray(authHeader) ? authHeader[0] : authHeader
	const normalizedAuthToken = normalizeToken(value)
	if (normalizedAuthToken) return normalizedAuthToken

	return normalizeToken(req.cookies['pb_auth_token'])
}

function readQueryParam(req: NextApiRequest, name: string): string | undefined {
	const value = req.query[name]
	return Array.isArray(value) ? value[0] : value
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.status(405).end()
		return
	}

	const dashboardId = readQueryParam(req, 'dashboardId')
	if (!dashboardId) {
		res.status(400).end()
		return
	}

	const authToken = getAuthToken(req)
	// Measured history is a subscriber product: never fetched for, or cached on behalf of, anyone else.
	const subscribed = (await resolveSubscription(authToken)) === true
	let streamEnded = false
	let writeQueue = Promise.resolve()
	const isStreamStopped = () => streamEnded || res.destroyed
	const recordStreamSourceFailure = (sourceKind: string) => (error: unknown) => {
		if (isStreamStopped()) return
		recordRuntimeError(error, 'outboundFetch', { stream_source: sourceKind, dashboard_id: dashboardId })
	}

	const sourceScheduler = createBoundedTaskScheduler(DASHBOARD_STREAM_SOURCE_CONCURRENCY, isStreamStopped)
	const stopStream = () => {
		if (streamEnded) return
		streamEnded = true
		sourceScheduler.cancelPending()
	}
	const removeDisconnectListener = () => {
		req.off('aborted', stopStream)
		res.off('close', stopStream)
		res.off('error', stopStream)
	}
	req.once('aborted', stopStream)
	res.once('close', stopStream)
	res.once('error', stopStream)

	const waitForDrain = () =>
		new Promise<void>((resolve) => {
			const cleanup = () => {
				res.off('drain', drained)
				res.off('close', closed)
				res.off('error', closed)
			}
			const drained = () => {
				cleanup()
				resolve()
			}
			const closed = () => {
				stopStream()
				drained()
			}
			res.once('drain', drained)
			res.once('close', closed)
			res.once('error', closed)
			if (isStreamStopped()) closed()
		})
	const writeLine = (chunk: DashboardStreamChunk): Promise<void> => {
		writeQueue = writeQueue.then(async () => {
			if (streamEnded || res.destroyed) return
			try {
				if (!res.write(`${JSON.stringify(chunk)}\n`) && !res.destroyed) await waitForDrain()
			} catch {
				stopStream()
			}
		})
		return writeQueue
	}
	const endStream = async () => {
		await writeQueue
		removeDisconnectListener()
		if (isStreamStopped()) return
		streamEnded = true
		sourceScheduler.cancelPending()
		if (!res.destroyed) res.end()
	}
	try {
		// The page may already have sanitized render config, but the stream still fetches the
		// trusted record to authorize the request and plan/cache its dashboard data sources.
		let dashboard: Awaited<ReturnType<typeof fetchDashboardConfig>> = null
		try {
			dashboard = await withTimeout(fetchDashboardConfig(dashboardId, authToken), DASHBOARD_CONFIG_STREAM_TIMEOUT_MS)
		} catch {
			dashboard = null
		}
		if (isStreamStopped()) {
			await endStream()
			return
		}

		// Set streaming headers — only cache at edge for confirmed-public, unauthenticated reads
		const canCacheAtEdge = !authToken && dashboard?.visibility === 'public'
		res.setHeader('Content-Type', 'application/x-ndjson')
		res.setHeader('X-Accel-Buffering', 'no')
		if (!canCacheAtEdge) res.setHeader('Vary', 'Cookie, Authorization')
		res.setHeader(
			'Cache-Control',
			canCacheAtEdge
				? 'public, s-maxage=300, stale-while-revalidate=60'
				: 'private, no-cache, no-store, must-revalidate'
		)

		await writeLine({
			type: 'dashboard',
			data: canCacheAtEdge && dashboard ? toPublicDashboardResponse(dashboard) : dashboard
		})
		if (isStreamStopped()) {
			await endStream()
			return
		}

		const allDashboardItems = dashboard?.data?.items ?? []
		const requestedItemId = readQueryParam(req, 'item')
		const requestedItem =
			requestedItemId === undefined ? undefined : allDashboardItems.find((item) => item.id === requestedItemId)
		const dashboardItems = requestedItem ? [requestedItem] : allDashboardItems
		const windowItemIds = new Set(
			requestedItem ? [requestedItem.id] : streamPrefetchItemIds(dashboardItems, INITIAL_DASHBOARD_STREAM_ITEM_COUNT)
		)
		const rawItems = dashboardItems.filter((item) => windowItemIds.has(item.id))
		const readiness = createStreamItemReadiness(
			dashboardItems.filter((item) => !dashboardItemHasStreamSources(item) || windowItemIds.has(item.id))
		)
		const emitItemsReady = (itemIds: Array<string>) =>
			itemIds.length > 0 ? writeLine({ type: 'itemReady', itemIds }) : Promise.resolve()
		const sources = createStreamSourceRegistry(readiness, sourceScheduler.schedule, emitItemsReady)

		const dashboardVariables = dashboard?.data?.variables ?? []
		const variableOverrides = readVariableOverridesFromQuery(req.query)
		const needsVariableResolution = dashboardVariables.length > 0 && dashboardHasBindings(rawItems)
		let needsAppMetadata = false
		for (const item of rawItems) {
			if (item.kind === 'chart' || (item.kind === 'multi' && item.items.length > 0) || item.kind === 'metric') {
				needsAppMetadata = true
				break
			}
		}

		let oracleMetricsPromise: ReturnType<typeof fetchOracleMetrics> | null = null
		const getOracleMetrics = () => (oracleMetricsPromise ??= fetchOracleMetrics())
		const needsProtocolCatalog = needsVariableResolution || dashboardStreamNeedsProtocolCatalog(rawItems)
		let protocolsAndChainsPromise: Promise<Awaited<ReturnType<typeof fetchProtocolsAndChains>> | null> | null = null
		const getProtocolsAndChains = () =>
			(protocolsAndChainsPromise ??= needsProtocolCatalog
				? fetchProtocolsAndChains(undefined, fetchProtocols())
						.then(async (d) => {
							await writeLine({ type: 'protocolsAndChains', data: d })
							return d
						})
						.catch((error) => {
							recordStreamSourceFailure('protocols-and-chains')(error)
							return null
						})
				: Promise.resolve(null))
		let appMetadataPromise: Promise<Awaited<ReturnType<typeof fetchAppMetadata>> | null> | null = null
		const getAppMetadata = () =>
			(appMetadataPromise ??= needsAppMetadata
				? fetchAppMetadata()
						.then(async (d) => {
							await writeLine({ type: 'appMetadata', data: d })
							return d
						})
						.catch((error) => {
							recordStreamSourceFailure('app-metadata')(error)
							return null
						})
				: Promise.resolve(null))

		if (rawItems.length === 0) {
			await emitItemsReady(readiness.markReady(readiness.unregistered()))
			if (!isStreamStopped()) await writeLine({ type: 'done' })
			await endStream()
			return
		}

		let stablecoinAssetsPromise: ReturnType<typeof fetchStablecoinAssetsApi> | null = null
		const getStablecoinAssets = () => (stablecoinAssetsPromise ??= fetchStablecoinAssetsApi())
		let stablecoinTableBaselinePromise: Promise<{
			peggedData: Awaited<ReturnType<typeof fetchStablecoinAssetsApi>>
			priceData: Awaited<ReturnType<typeof fetchStablecoinPricesApi>>
			rateData: Awaited<ReturnType<typeof fetchStablecoinRatesApi>>
			peggedConfig: Awaited<ReturnType<typeof fetchStablecoinPeggedConfigApi>>
		}> | null = null
		const getStablecoinTableBaseline = () =>
			(stablecoinTableBaselinePromise ??= Promise.all([
				getStablecoinAssets(),
				fetchStablecoinPricesApi(),
				fetchStablecoinRatesApi(),
				fetchStablecoinPeggedConfigApi()
			]).then(([peggedData, priceData, rateData, peggedConfig]) => ({
				peggedData,
				priceData,
				rateData,
				peggedConfig
			})))
		let rwaAssetsTablePromise: Promise<Array<IFetchedRWAProject>> | null = null
		const getRwaAssetsTable = () =>
			(rwaAssetsTablePromise ??= import('~/containers/RWA/api').then(({ fetchRWAActiveTVLs }) =>
				withTimeout(fetchRWAActiveTVLs(), 10_000)
			))
		let rwaApiPromise: Promise<typeof import('~/containers/RWA/api')> | null = null
		const getRwaApi = () => (rwaApiPromise ??= import('~/containers/RWA/api'))
		let incomeMetadataPromise: Promise<Map<string, IProtocolMetadata>> | null = null
		const getIncomeMetadata = () =>
			(incomeMetadataPromise ??= import('~/utils/metadata').then((metadataModule) => {
				const metadataByDisplayNameSlug = new Map<string, IProtocolMetadata>()
				for (const key in metadataModule.default.protocolMetadata) {
					const record = metadataModule.default.protocolMetadata[key]
					if (record === undefined) throw new Error(`Missing protocol metadata for ${key}`)
					metadataByDisplayNameSlug.set(slug(record.displayName), record)
				}
				return metadataByDisplayNameSlug
			}))
		let yieldsSnapshotPromise: Promise<YieldsSnapshot> | null = null
		const getYieldsSnapshot = () =>
			(yieldsSnapshotPromise ??= import('~/containers/Yields/server/dataset.server').then(({ acquireYieldsSnapshot }) =>
				acquireYieldsSnapshot('background')
			))
		let cexAnalyticsPromise: Promise<typeof import('~/containers/Cexs/server/analytics')> | null = null
		const getCexAnalytics = () => (cexAnalyticsPromise ??= import('~/containers/Cexs/server/analytics'))
		const dimensionDatasetRequestScope = createDimensionDatasetRequestScope()

		const streamPromises: Array<Promise<unknown>> = [
			...(needsProtocolCatalog ? [sourceScheduler.schedule(async () => void (await getProtocolsAndChains()))] : []),
			...(needsAppMetadata ? [sourceScheduler.schedule(async () => void (await getAppMetadata()))] : [])
		]
		const resolveWindowItems = async () => {
			const catalog = await getProtocolsAndChains()
			return resolveDashboardItems(rawItems, dashboardVariables, variableOverrides, createVariableCatalog(catalog))
				.items
		}
		const items = needsVariableResolution ? await resolveWindowItems() : rawItems
		if (!isStreamStopped()) {
			const phase2Promises: Array<Promise<unknown>> = []
			type DatasetType = DatasetTableConfig['datasetType']
			type DatasetConfigFor<T extends DatasetType> = DatasetTableConfig extends infer Config
				? Config extends DatasetTableConfig
					? T extends Config['datasetType']
						? Config
						: never
					: never
				: never
			const tableItems: Array<DatasetTableConfig> = []
			const classicChartItems: Array<DashboardItemConfig> = []
			for (const item of items) {
				if (item.kind === 'dataset-table') tableItems.push(item)
				else if (item.kind === 'chart' || (item.kind === 'multi' && item.items.length > 0) || item.kind === 'metric') {
					classicChartItems.push(item)
				}
			}
			const getTableItems = <T extends DatasetType>(datasetType: T) =>
				tableItems.filter((item): item is DatasetConfigFor<T> => item.datasetType === datasetType)
			// Chart and metric cards share the same raw source and observer-local presentation.
			if (classicChartItems.length > 0) {
				for (const item of classicChartItems) sources.register(item.id, chartPlanSourceKey(item.id))
				const settleChartPlans = () =>
					emitItemsReady(classicChartItems.flatMap((item) => readiness.settle(chartPlanSourceKey(item.id))))
				const chartSourcePromises: Array<Promise<void>> = []
				const planChartSources = sourceScheduler
					.schedule(async () => {
						const [catalog, appMetadata] = await Promise.all([getProtocolsAndChains(), getAppMetadata()])
						if (isStreamStopped()) return
						const protocolRelations = buildProDashboardProtocolRelations(catalog)
						const plansByItem = classicChartItems.map((item) => ({
							itemId: item.id,
							entries: buildProDashboardChartSourcePlan([item], catalog, appMetadata)
						}))
						const planBySourceKey = new Map<string, ProDashboardChartSourcePlanEntry>()
						for (const { entries } of plansByItem) {
							for (const entry of entries) {
								const sourceKey = sources.sourceKey('chart', entry.queryKey)
								if (!planBySourceKey.has(sourceKey)) planBySourceKey.set(sourceKey, entry)
							}
						}
						const streamedSources = Array.from(planBySourceKey).slice(0, DASHBOARD_STREAM_CLASSIC_SOURCE_LIMIT)
						const fetchedSourceKeys = new Set<string>()
						for (const [sourceKey, entry] of streamedSources) {
							if (!entry.skipReason) fetchedSourceKeys.add(sourceKey)
						}
						for (const { itemId, entries } of plansByItem) {
							for (const entry of entries) {
								const sourceKey = sources.sourceKey('chart', entry.queryKey)
								if (fetchedSourceKeys.has(sourceKey)) sources.register(itemId, sourceKey)
							}
						}
						for (const [sourceKey, source] of streamedSources) {
							if (!sources.claim(sourceKey)) continue
							chartSourcePromises.push(
								sources
									.schedule(sourceKey, async () => {
										const data = source.skipReason
											? []
											: await withTimeout(fetchSingleChartData(source.request, 'all', null, protocolRelations), 10_000)
										await writeLine({ type: 'chartData', queryKey: source.queryKey, data })
									})
									.catch(recordStreamSourceFailure('chart'))
							)
						}
					})
					.finally(settleChartPlans)
					.catch(recordStreamSourceFailure('chart-plan'))
				phase2Promises.push(
					planChartSources.then(async () => {
						await Promise.allSettled(chartSourcePromises)
					})
				)
			}

			// Table sources stream independently so optional metrics cannot delay the base table.
			phase2Promises.push(
				streamProTokenUsageData(items, sources, (data) => writeLine({ type: 'tokenUsageData', ...data })).catch(
					recordStreamSourceFailure('token-usage')
				)
			)

			// Yields — stream per pool
			const needsByPool = new Map<string, { supply: boolean; borrow: boolean }>()
			for (const item of items) {
				if (item.kind !== 'yields') continue
				sources.register(item.id, sources.sourceKey('yields-chart', [item.poolConfigId]))
				const needs = needsByPool.get(item.poolConfigId) ?? {
					supply: false,
					borrow: false
				}
				const chartType = normalizeYieldChartType(item.chartType)
				if (chartType === 'borrow-apy' || chartType === 'net-borrow-apy') needs.borrow = true
				else needs.supply = true
				needsByPool.set(item.poolConfigId, needs)
			}
			for (const [poolConfigId, needs] of needsByPool) {
				const sourceKey = sources.sourceKey('yields-chart', [poolConfigId])
				if (!sources.claim(sourceKey)) continue
				phase2Promises.push(
					sources
						.schedule(sourceKey, async () => {
							const [supplyResult, borrowResult] = await Promise.allSettled([
								needs.supply
									? withTimeout(fetchPoolDetailHistory(poolConfigId, 'max', { includeVerified: subscribed }), 10_000)
									: Promise.resolve(null),
								needs.borrow
									? withTimeout(fetchBorrowMarketDetailHistory(poolConfigId, 'max'), 10_000)
									: Promise.resolve(null)
							])
							await writeLine({
								type: 'yieldsChartData',
								id: poolConfigId,
								data: {
									...(needs.supply && supplyResult.status === 'fulfilled' ? { supply: supplyResult.value } : null),
									...(needs.borrow && borrowResult.status === 'fulfilled' ? { borrow: borrowResult.value } : null)
								}
							})
						})
						.catch(recordStreamSourceFailure('yields-chart'))
				)
			}

			// Advanced TVL basic data — stream per protocol
			for (const item of items) {
				if (item.kind !== 'advanced-tvl' || item.chartType !== 'tvl') continue
				const protocol = item.protocol
				const queryKey = buildProtocolValueChartQueryKey({
					source: 'tvl',
					protocol
				})
				const sourceKey = sources.sourceKey('advanced-tvl', queryKey)
				sources.register(item.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				phase2Promises.push(
					sources
						.schedule(sourceKey, () =>
							withTimeout(fetchProtocolTvlChart({ protocol }), 10_000).then((data) => {
								return writeLine({
									type: 'protocolTvlChartData',
									queryKey,
									data: data ?? []
								})
							})
						)
						.catch(recordStreamSourceFailure('advanced-tvl'))
				)
			}

			// Stream only the base V2 breakdown required by each active Advanced TVL or Borrowed view.
			// User-enabled extra TVL keys live in local storage and are fetched by the client after this stream completes.
			const protocolTvlItems = items.filter(
				(item) => item.kind === 'advanced-borrowed' || (item.kind === 'advanced-tvl' && item.chartType !== 'tvl')
			)
			if (protocolTvlItems.length > 0) {
				const protocolTvlPlanSourceKey = (itemId: string) => sources.sourceKey('protocol-tvl-plan', [itemId])
				for (const item of protocolTvlItems) sources.register(item.id, protocolTvlPlanSourceKey(item.id))
				const settleProtocolTvlPlans = () =>
					emitItemsReady(protocolTvlItems.flatMap((item) => readiness.settle(protocolTvlPlanSourceKey(item.id))))
				const protocolTvlSourcePromises: Array<Promise<void>> = []
				const planProtocolTvlSources = sourceScheduler
					.schedule(async () => {
						const catalog = await getProtocolsAndChains()
						if (isStreamStopped()) return
						const planBySourceKey = new Map<string, ProtocolTvlStreamSource>()
						for (const item of protocolTvlItems) {
							for (const source of buildProtocolTvlStreamSourcePlan([item], catalog)) {
								const sourceKey = sources.sourceKey('protocol-tvl', source.queryKey)
								sources.register(item.id, sourceKey)
								if (!planBySourceKey.has(sourceKey)) planBySourceKey.set(sourceKey, source)
							}
						}
						for (const [sourceKey, { queryKey, request }] of planBySourceKey) {
							if (!sources.claim(sourceKey)) continue
							protocolTvlSourcePromises.push(
								sources
									.schedule(sourceKey, async () => {
										const data = await withTimeout(fetchProtocolTvlChart(request), 15_000)
										await writeLine({ type: 'protocolTvlChartData', queryKey, data: data ?? [] })
									})
									.catch(recordStreamSourceFailure('protocol-tvl'))
							)
						}
					})
					.finally(settleProtocolTvlPlans)
					.catch(recordStreamSourceFailure('protocol-tvl-plan'))
				phase2Promises.push(
					planProtocolTvlSources.then(async () => {
						await Promise.allSettled(protocolTvlSourcePromises)
					})
				)
			}

			// Exact table requests stream independently so a broader or slower table does not
			// delay an otherwise-ready card or widen its failure boundary.
			for (const item of items) {
				if (item.kind !== 'unified-table') continue
				for (const source of buildUnifiedTableStreamSourcePlan([item])) {
					const sourceKey = `unified:${source.cacheKey}`
					sources.register(item.id, sourceKey)
					if (!sources.claim(sourceKey)) continue
					phase2Promises.push(
						sources
							.schedule(sourceKey, async () => {
								const data = await withTimeout(
									fetchProtocolsTable(
										{
											config: source.config,
											rowHeaders: source.rowHeaders,
											baseMetricFamilies: source.baseMetricFamilies,
											pointMetrics: source.pointMetrics,
											supplementalMetrics: source.supplementalMetrics,
											needsOracleMembership: source.needsOracleMembership,
											rowMembership: source.rowMembership
										},
										{
											...(source.needsOracleMembership ? { oracleMetricsPromise: getOracleMetrics() } : {}),
											dimensionDatasetRequestScope
										}
									),
									15_000
								)
								const response = createProtocolsUnifiedTableResponse(data)
								await writeLine({ type: 'unifiedTableData', key: source.cacheKey, data: response })
							})
							.catch(recordStreamSourceFailure('unified-table'))
					)
				}
			}

			// Stablecoins chart data — shared baseline then per-chain
			const stablecoinsItems = items.filter((item): item is StablecoinsChartConfig => item.kind === 'stablecoins')
			for (const item of stablecoinsItems) {
				const chain = item.chain
				const sourceKey = sources.sourceKey('stablecoins-chart', [chain])
				sources.register(item.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				phase2Promises.push(
					sources
						.schedule(sourceKey, async () => {
							const FETCH_TIMEOUT = 10_000
							const [peggedData, chainData] = await Promise.all([
								withTimeout(getStablecoinAssets(), FETCH_TIMEOUT),
								withTimeout(fetchStablecoinChartApi(chain === 'All' ? 'all' : chain), FETCH_TIMEOUT)
							])
							const data = buildStablecoinsChartCacheValue({ peggedData, chainData, chain })
							await writeLine({ type: 'stablecoinsChartData', chain, data })
						})
						.catch(recordStreamSourceFailure('stablecoins-chart'))
				)
			}

			// RWA overview chart data — stream per unique breakdown+metric+chain combo
			const rwaOverviewItems = items.filter((item): item is RWAOverviewChartConfig => item.kind === 'rwa-overview')
			const rwaAssetItems = items.filter((item): item is RWAAssetChartConfig => item.kind === 'rwa-asset')

			if (rwaOverviewItems.length > 0 || rwaAssetItems.length > 0) {
				for (const item of rwaOverviewItems) {
					const { metric, chain } = item
					const breakdown = item.breakdown
					const resolvedChain = chain || 'All'
					const cacheKey = JSON.stringify(getProRwaBreakdownQueryKey(breakdown, metric, resolvedChain))
					const sourceKey = sources.sourceKey('rwa-overview', [cacheKey])
					sources.register(item.id, sourceKey)
					if (!sources.claim(sourceKey)) continue

					phase2Promises.push(
						sources
							.schedule(sourceKey, async () => {
								const rwaApi = await getRwaApi()
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
									await writeLine({
										type: 'rwaBreakdownData',
										breakdown,
										metric,
										chain: resolvedChain,
										data: toRwaPositionalChartDataset(data)
									})
								}
							})
							.catch(recordStreamSourceFailure('rwa-overview'))
					)
				}

				for (const item of rwaAssetItems) {
					const { assetId } = item
					if (!assetId) continue
					const sourceKey = sources.sourceKey('rwa-asset', [assetId])
					sources.register(item.id, sourceKey)
					if (!sources.claim(sourceKey)) continue

					phase2Promises.push(
						sources
							.schedule(sourceKey, async () => {
								const rwaApi = await getRwaApi()
								await withTimeout(rwaApi.fetchRWAAssetChartData(assetId), 10_000).then(async (data) => {
									if (data)
										await writeLine({
											type: 'rwaAssetChartData',
											id: assetId,
											data
										})
								})
							})
							.catch(recordStreamSourceFailure('rwa-asset'))
					)
				}
			}

			// RWA table data — stream assets list and/or stats
			const rwaAssetsTableItems = [...getTableItems('rwa'), ...getTableItems('rwa-selected-chain')]
			const rwaChainsTableItems = getTableItems('rwa-chains')

			if (rwaAssetsTableItems.length > 0) {
				const sourceKey = sources.sourceKey('rwa-assets-table', [])
				for (const item of rwaAssetsTableItems) sources.register(item.id, sourceKey)
				if (sources.claim(sourceKey)) {
					phase2Promises.push(
						sources
							.schedule(sourceKey, async () => {
								const data = await getRwaAssetsTable()
								if (data) await writeLine({ type: 'rwaAssetsTableData', data })
							})
							.catch(recordStreamSourceFailure('rwa-assets-table'))
					)
				}
			}

			if (rwaChainsTableItems.length > 0) {
				const sourceKey = sources.sourceKey('rwa-chains-table', [])
				for (const item of rwaChainsTableItems) sources.register(item.id, sourceKey)
				if (sources.claim(sourceKey)) {
					phase2Promises.push(
						sources
							.schedule(sourceKey, async () => {
								const { fetchRWAStats: fetchStats } = await import('~/containers/RWA/api')
								const data = await withTimeout(fetchStats(), 10_000)
								if (data) await writeLine({ type: 'rwaChainsTableData', data })
							})
							.catch(recordStreamSourceFailure('rwa-chains-table'))
					)
				}
			}

			// Equities table data — stream companies list, statements, and filings
			const equitiesCompaniesItems = getTableItems('equities')
			const equitiesFinancialsItems = getTableItems('equities-financials')
			const equitiesFilingsItems = getTableItems('equities-filings')

			if (equitiesCompaniesItems.length > 0) {
				const sourceKey = sources.sourceKey('equities-companies', [])
				for (const item of equitiesCompaniesItems) sources.register(item.id, sourceKey)
				if (sources.claim(sourceKey)) {
					phase2Promises.push(
						sources
							.schedule(sourceKey, async () => {
								const { fetchEquitiesCompanies } = await import('~/containers/Equities/api')
								const data = await withTimeout(fetchEquitiesCompanies(), 15_000)
								if (data) await writeLine({ type: 'equitiesCompaniesData', data })
							})
							.catch(recordStreamSourceFailure('equities-companies'))
					)
				}
			}

			for (const item of equitiesFinancialsItems) {
				const tickerParam = item.ticker
				const queryKey = getEquitiesTableQueryKey('statements', tickerParam || '')
				const queryTicker = queryKey?.[2]
				if (!queryTicker) continue
				const sourceKey = sources.sourceKey('equities-statements', [queryTicker])
				sources.register(item.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				phase2Promises.push(
					sources
						.schedule(sourceKey, async () => {
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
								await writeLine({
									type: 'equitiesStatementsData',
									ticker: buildEquityTickerCountrySlug(tickerCountry.ticker, tickerCountry.country),
									data
								})
							}
						})
						.catch(recordStreamSourceFailure('equities-statements'))
				)
			}

			for (const item of equitiesFilingsItems) {
				const tickerParam = item.ticker
				const queryKey = getEquitiesTableQueryKey('filings', tickerParam || '')
				const queryTicker = queryKey?.[2]
				if (!queryTicker) continue
				const sourceKey = sources.sourceKey('equities-filings', [queryTicker])
				sources.register(item.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				phase2Promises.push(
					sources
						.schedule(sourceKey, async () => {
							const { fetchEquitiesFilings } = await import('~/containers/Equities/api')
							const { parseEquityTickerCountryParam, buildEquityTickerCountrySlug } =
								await import('~/containers/Equities/tickerCountry')
							const tickerCountry = parseEquityTickerCountryParam(queryTicker)
							if (!tickerCountry) return
							const data = await withTimeout(fetchEquitiesFilings(tickerCountry.ticker, tickerCountry.country), 15_000)
							if (data) {
								await writeLine({
									type: 'equitiesFilingsData',
									ticker: buildEquityTickerCountrySlug(tickerCountry.ticker, tickerCountry.country),
									data
								})
							}
						})
						.catch(recordStreamSourceFailure('equities-filings'))
				)
			}

			// Emission data — stream per source
			for (const item of items) {
				if (item.kind === 'unlocks-pie') {
					const includeSupplyMeta = item.chartType === 'locked-unlocked'
					const cacheKey = JSON.stringify(['pro-dashboard', 'unlocks-pie', item.protocol, includeSupplyMeta])
					const sourceKey = sources.sourceKey('emissions-pie', [cacheKey])
					sources.register(item.id, sourceKey)
					if (!sources.claim(sourceKey)) continue
					phase2Promises.push(
						sources
							.schedule(sourceKey, async () => {
								const data = await withTimeout(
									getProtocolEmissionsPieData(slug(item.protocol), includeSupplyMeta),
									10_000
								)
								await writeLine({ type: 'emissionData', view: 'pie', key: cacheKey, data })
							})
							.catch(recordStreamSourceFailure('emissions-pie'))
					)
				} else if (item.kind === 'unlocks-schedule') {
					const resolvedDataType = item.dataType === 'realtime' ? 'documented' : item.dataType
					const cacheKey = JSON.stringify(['pro-dashboard', 'unlocks-schedule', item.protocol, resolvedDataType])
					const sourceKey = sources.sourceKey('emissions-schedule', [cacheKey])
					sources.register(item.id, sourceKey)
					if (!sources.claim(sourceKey)) continue
					phase2Promises.push(
						sources
							.schedule(sourceKey, () =>
								withTimeout(getProtocolEmissionsScheduleData(slug(item.protocol)), 10_000).then(async (data) => {
									if (data)
										await writeLine({
											type: 'emissionData',
											view: 'schedule',
											key: cacheKey,
											data
										})
								})
							)
							.catch(recordStreamSourceFailure('emissions-schedule'))
					)
				}
			}

			// CEX analytics dataset tables — seed under the per-view hook keys
			const cexAnalyticsItems = getTableItems('cex-analytics')
			if (cexAnalyticsItems.length > 0) {
				const snapshotSourceKey = sources.sourceKey('cex-snapshot', [])
				const totalsSourceKey = sources.sourceKey('cex-totals', [])
				let needsSnapshot = false
				let needsTotals = false
				const shareSpecs = new Map<string, { metric: 'spot' | 'derivatives'; topNData: number }>()
				for (const item of cexAnalyticsItems) {
					const view = item.cexAnalyticsView
					if (view === 'summary' || view === 'comparison') {
						sources.register(item.id, snapshotSourceKey)
						needsSnapshot = true
					} else if (view === 'spot-vs-derivatives') {
						sources.register(item.id, totalsSourceKey)
						needsTotals = true
					} else if (view === 'market-share') {
						const metric = item.cexAnalyticsMetric
						const topNRaw = item.cexAnalyticsTopN
						const topNData = Math.min(Math.max(topNRaw, 1), 12)
						const shareKey = JSON.stringify(getProCexShareQueryKey(metric, topNRaw))
						sources.register(item.id, sources.sourceKey('cex-share', [shareKey]))
						if (!shareSpecs.has(shareKey)) shareSpecs.set(shareKey, { metric, topNData })
					}
				}
				if (needsSnapshot && sources.claim(snapshotSourceKey)) {
					phase2Promises.push(
						sources
							.schedule(snapshotSourceKey, async () => {
								const { getCexAnalyticsSnapshot } = await getCexAnalytics()
								const data = await withTimeout(getCexAnalyticsSnapshot(), 15_000)
								if (data)
									await writeLine({
										type: 'cexAnalyticsData',
										view: 'snapshot',
										key: JSON.stringify(PRO_CEX_SNAPSHOT_QUERY_KEY),
										data
									})
							})
							.catch(recordStreamSourceFailure('cex-snapshot'))
					)
				}
				if (needsTotals && sources.claim(totalsSourceKey)) {
					phase2Promises.push(
						sources
							.schedule(totalsSourceKey, async () => {
								const { getCexAnalyticsTotals } = await getCexAnalytics()
								const data = await withTimeout(getCexAnalyticsTotals(), 15_000)
								if (data)
									await writeLine({
										type: 'cexAnalyticsData',
										view: 'totals',
										key: JSON.stringify(PRO_CEX_TOTALS_QUERY_KEY),
										data
									})
							})
							.catch(recordStreamSourceFailure('cex-totals'))
					)
				}
				for (const [shareKey, { metric, topNData }] of shareSpecs) {
					const sourceKey = sources.sourceKey('cex-share', [shareKey])
					if (!sources.claim(sourceKey)) continue
					phase2Promises.push(
						sources
							.schedule(sourceKey, async () => {
								const { getCexAnalyticsMarketShare } = await getCexAnalytics()
								const data = await withTimeout(getCexAnalyticsMarketShare(metric, topNData), 15_000)
								if (data)
									await writeLine({
										type: 'cexAnalyticsData',
										view: 'market-share',
										key: shareKey,
										data
									})
							})
							.catch(recordStreamSourceFailure('cex-share'))
					)
				}
			}

			// Chains dataset tables
			for (const item of getTableItems('chains')) {
				const category = item.category
				const cacheKey = JSON.stringify(getProChainsDatasetQueryKey(category))
				const sourceKey = sources.sourceKey('chains-dataset', [cacheKey])
				sources.register(item.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				phase2Promises.push(
					sources
						.schedule(sourceKey, () =>
							withTimeout(fetchChainsDatasetRows(category ? { category } : {}), 15_000).then(async (data) => {
								if (data)
									await writeLine({
										type: 'chainsDatasetData',
										key: cacheKey,
										data
									})
							})
						)
						.catch(recordStreamSourceFailure('chains-dataset'))
				)
			}

			// Yields dataset tables
			for (const item of getTableItems('yields')) {
				const cacheKey = JSON.stringify(getProYieldsDatasetQueryKey(item.chains))
				const sourceKey = sources.sourceKey('yields-dataset', [cacheKey])
				sources.register(item.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				const chains = item.chains
				phase2Promises.push(
					sources
						.schedule(sourceKey, async () => {
							const yieldsSnapshot = await getYieldsSnapshot()
							const data = await withTimeout(fetchProYieldsDataset(yieldsSnapshot, chains), 15_000)
							if (data)
								await writeLine({
									type: 'yieldsDatasetData',
									key: cacheKey,
									data
								})
						})
						.catch(recordStreamSourceFailure('yields-dataset'))
				)
			}

			// Stablecoins dataset tables
			for (const item of getTableItems('stablecoins')) {
				const chain = item.chain
				const cacheKey = JSON.stringify(getProStablecoinsTableQueryKey(chain))
				const sourceKey = sources.sourceKey('stablecoins-table', [cacheKey])
				sources.register(item.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				phase2Promises.push(
					sources
						.schedule(sourceKey, async () => {
							const [baseline, chainData] = await Promise.all([
								withTimeout(getStablecoinTableBaseline(), 15_000),
								withTimeout(fetchStablecoinChartApi(chain === 'All' ? 'all' : chain), 15_000)
							])
							const data = buildStablecoinsTableData({
								baseline,
								chainData,
								chain
							})
							await writeLine({
								type: 'stablecoinsTableData',
								key: cacheKey,
								data
							})
						})
						.catch(recordStreamSourceFailure('stablecoins-table'))
				)
			}

			// Stablecoin asset chart items
			const stablecoinAssetItems = items.filter(
				(item): item is StablecoinAssetChartConfig => item.kind === 'stablecoin-asset'
			)
			for (const item of stablecoinAssetItems) {
				const slugId = item.stablecoinId
				if (!slugId) continue
				const sourceKey = sources.sourceKey('stablecoin-asset', [slugId])
				sources.register(item.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				const cacheKey = JSON.stringify(['pro-dashboard', 'stablecoin-asset-chart-data', slugId])
				phase2Promises.push(
					sources
						.schedule(sourceKey, () =>
							withTimeout(fetchStablecoinAssetChartCacheValue(slugId), 15_000).then(async (data) => {
								if (data)
									await writeLine({
										type: 'stablecoinAssetData',
										key: cacheKey,
										data
									})
							})
						)
						.catch(recordStreamSourceFailure('stablecoin-asset'))
				)
			}

			// Income statement items
			const incomeStatementItems = items.filter(
				(item): item is IncomeStatementConfig => item.kind === 'income-statement'
			)
			for (const incomeItem of incomeStatementItems) {
				const protocol = incomeItem.protocol
				if (!protocol) continue
				const sourceKey = sources.sourceKey('income-statement', [protocol])
				sources.register(incomeItem.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				const cacheKey = JSON.stringify(['pro-dashboard', 'income-statement', protocol])
				phase2Promises.push(
					sources
						.schedule(sourceKey, async () => {
							const metadata = (await getIncomeMetadata()).get(slug(protocol))
							if (!metadata) return
							await withTimeout(getProtocolIncomeStatement({ metadata }), 15_000).then(async (data) => {
								if (data)
									await writeLine({
										type: 'incomeStatementData',
										key: cacheKey,
										data
									})
							})
						})
						.catch(recordStreamSourceFailure('income-statement'))
				)
			}

			// Chart builder items
			const chartBuilderItems = items.filter((item): item is ChartBuilderConfig => item.kind === 'builder')
			for (const builderItem of chartBuilderItems) {
				const cfg = builderItem.config
				if (cfg.mode !== 'protocol' && STREAM_PROTOCOL_SERIES_SKIP_METRICS.has(cfg.metric)) continue
				const cacheKey = JSON.stringify(getChartBuilderQueryKey(cfg))
				const sourceKey = sources.sourceKey('chart-builder', [cacheKey])
				sources.register(builderItem.id, sourceKey)
				if (!sources.claim(sourceKey)) continue
				phase2Promises.push(
					sources
						.schedule(sourceKey, () =>
							withTimeout(fetchChartBuilderServerData(cfg), CHART_BUILDER_STREAM_TIMEOUT_MS).then((data) =>
								writeLine({ type: 'chartBuilderData', key: cacheKey, data })
							)
						)
						.catch(recordStreamSourceFailure('chart-builder'))
				)
			}

			await emitItemsReady(readiness.markReady(readiness.unregistered()))
			streamPromises.push(...phase2Promises)
		}
		await Promise.allSettled(streamPromises)

		if (!isStreamStopped()) await writeLine({ type: 'done' })
		await endStream()
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		if (!isStreamStopped()) await writeLine({ type: 'done' })
		await endStream()
	}
}

export const dashboardStreamApiHandler = withApiRouteTelemetry(
	'/api/dynamic/pro-dashboard/[dashboardId]/stream',
	handler
)
