import { RWA_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	IFetchedRWAProject,
	IRWAStatsResponse,
	IRWAChartDataByAsset,
	IRWAChartMetricRows,
	IRWAAssetData,
	IRWAAssetChartApiRow,
	IRWABreakdownChartParams,
	IRWABreakdownChartResponse,
	IRWAFlowGroupAggregateResponse,
	IRWAFlowOverviewAggregateResponse,
	IRWAFlowAssetBreakdownRow,
	IRWAFlowOverviewRequest,
	IRWAFlowOverviewSplitPoint,
	IRWAFlowSummaryResponse,
	IRWAFlowPointWithMcap,
	IRWAFlowsRequest,
	IRWAFlowsResponse,
	RWAAssetChartTarget,
	RWAChartMetricKey
} from './api.types'
import { rwaSlug } from './rwaSlug'

export function rwaUnixSecondsToMilliseconds(ts: number): number {
	return ts * 1e3
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

/**
 * Fetch current active TVL values for RWA projects.
 */
export async function fetchRWAActiveTVLs(): Promise<Array<IFetchedRWAProject>> {
	return fetchJson<Array<IFetchedRWAProject>>(`${RWA_SERVER_URL}/current`)
}

/**
 * Fetch aggregate stats for the RWA dashboard.
 */
export async function fetchRWAStats(): Promise<IRWAStatsResponse> {
	return fetchJson<IRWAStatsResponse>(`${RWA_SERVER_URL}/stats`)
}

/**
 * Fetch details for a single RWA asset by id.
 */
export async function fetchRWAAssetDataById(assetId: string): Promise<IFetchedRWAProject> {
	const encodedAssetId = encodeURIComponent(assetId)
	return fetchJson<IFetchedRWAProject>(`${RWA_SERVER_URL}/rwa/${encodedAssetId}`)
}

function buildRWAFlowsUrl(assetId: string, request: IRWAFlowsRequest = {}): string {
	const encodedAssetId = encodeURIComponent(assetId)
	const searchParams = new URLSearchParams()
	if (request.start != null) searchParams.set('start', String(request.start))
	if (request.end != null) searchParams.set('end', String(request.end))
	if (request.withMcap) searchParams.set('withMcap', 'true')
	const qs = searchParams.toString()
	return `${RWA_SERVER_URL}/flows/${encodedAssetId}${qs ? `?${qs}` : ''}`
}

/**
 * Fetch daily net USD flows for a single RWA asset.
 */
export function fetchRWAFlows(
	assetId: string,
	request: IRWAFlowsRequest & { withMcap: true }
): Promise<IRWAFlowsResponse<IRWAFlowPointWithMcap>>
export function fetchRWAFlows(assetId: string, request?: IRWAFlowsRequest): Promise<IRWAFlowsResponse>
export async function fetchRWAFlows(
	assetId: string,
	request: IRWAFlowsRequest = {}
): Promise<IRWAFlowsResponse | IRWAFlowsResponse<IRWAFlowPointWithMcap>> {
	return fetchJson<IRWAFlowsResponse | IRWAFlowsResponse<IRWAFlowPointWithMcap>>(buildRWAFlowsUrl(assetId, request))
}

export function fetchRWAFlowsOverview(): Promise<IRWAFlowOverviewAggregateResponse>
export function fetchRWAFlowsOverview(request: IRWAFlowOverviewRequest): Promise<Array<IRWAFlowOverviewSplitPoint>>
export async function fetchRWAFlowsOverview(
	request?: IRWAFlowOverviewRequest
): Promise<IRWAFlowOverviewAggregateResponse | Array<IRWAFlowOverviewSplitPoint>> {
	const searchParams = new URLSearchParams()
	if (request) {
		searchParams.set('splitBy', request.splitBy)
		searchParams.set('includeStablecoin', String(request.includeStablecoin))
		searchParams.set('includeGovernance', String(request.includeGovernance))
	}
	const qs = searchParams.toString()
	return fetchJson<IRWAFlowOverviewAggregateResponse | Array<IRWAFlowOverviewSplitPoint>>(
		`${RWA_SERVER_URL}/flows/overview${qs ? `?${qs}` : ''}`
	)
}

export async function fetchRWAFlowsSummary(): Promise<IRWAFlowSummaryResponse> {
	return fetchJson<IRWAFlowSummaryResponse>(`${RWA_SERVER_URL}/flows/summary`)
}

export async function fetchRWAFlowsAssetGroup(assetGroup: string): Promise<IRWAFlowGroupAggregateResponse> {
	return fetchJson<IRWAFlowGroupAggregateResponse>(
		`${RWA_SERVER_URL}/flows/assetGroup/${encodeURIComponent(assetGroup)}`
	)
}

export async function fetchRWAFlowsCategory(category: string): Promise<IRWAFlowGroupAggregateResponse> {
	return fetchJson<IRWAFlowGroupAggregateResponse>(`${RWA_SERVER_URL}/flows/category/${encodeURIComponent(category)}`)
}

export async function fetchRWAFlowsPlatform(platform: string): Promise<IRWAFlowGroupAggregateResponse> {
	return fetchJson<IRWAFlowGroupAggregateResponse>(`${RWA_SERVER_URL}/flows/platform/${encodeURIComponent(platform)}`)
}

export async function fetchRWAFlowsChain(chain: string): Promise<IRWAFlowGroupAggregateResponse> {
	return fetchJson<IRWAFlowGroupAggregateResponse>(`${RWA_SERVER_URL}/flows/chain/${encodeURIComponent(chain)}`)
}

export async function fetchRWAFlowAssetBreakdown(
	target: RWAAssetChartTarget
): Promise<Array<IRWAFlowAssetBreakdownRow>> {
	if (target.kind === 'all') {
		return fetchJson<Array<IRWAFlowAssetBreakdownRow>>(`${RWA_SERVER_URL}/flows/asset-breakdown`)
	}
	return fetchJson<Array<IRWAFlowAssetBreakdownRow>>(
		`${RWA_SERVER_URL}/flows/asset-breakdown/${target.kind}/${encodeURIComponent(target.slug)}`
	)
}

// Platform Active Marketcap history as a bare [unixSec, usd] series — the shape the protocol
// chart panel expects. Read off the platform breakdown rather than /chart/platform/:slug so
// governance tokens are excluded and stablecoins kept, matching the platform page's onchainAum.
export async function fetchRWAPlatformAumChart(platformSlug: string): Promise<Array<[number, number]>> {
	const rows = await fetchJson<IRWABreakdownChartResponse>(
		`${RWA_SERVER_URL}/chart/platform-breakdown?key=activeMcap&includeStablecoin=true`
	).then(normalizeRWABreakdownChartRows)
	const wantedSlug = rwaSlug(platformSlug)
	// Breakdown columns are platform display names, so cache the slug test per column.
	const columnMatches = new Map<string, boolean>()
	const isWantedColumn = (column: string): boolean => {
		let matched = columnMatches.get(column)
		if (matched === undefined) {
			matched = column !== 'timestamp' && rwaSlug(column) === wantedSlug
			columnMatches.set(column, matched)
		}
		return matched
	}
	const series: Array<[number, number]> = []
	for (const row of rows) {
		if (row?.timestamp == null) continue
		let total: number | null = null
		for (const column in row) {
			if (!isWantedColumn(column)) continue
			const value = row[column]
			if (typeof value === 'number') total = (total ?? 0) + value
		}
		if (total == null) continue
		// The shared breakdown fetcher normalises timestamps to milliseconds; this series is seconds.
		series.push([row.timestamp / 1e3, total])
	}
	series.sort((a, b) => a[0] - b[0])
	// The platform series starts at the RWA dataset epoch, not the platform's first asset, so
	// it can carry years of leading zeros that render as a flat line before any real history.
	let firstNonZero = 0
	while (firstNonZero < series.length && series[firstNonZero]![1] === 0) firstNonZero++
	return firstNonZero > 0 ? series.slice(firstNonZero) : series
}

export async function fetchRWAChartDataByAsset({
	target,
	includeStablecoins,
	includeGovernance
}: {
	target: RWAAssetChartTarget
	includeStablecoins: boolean
	includeGovernance: boolean
}): Promise<IRWAChartDataByAsset> {
	let chartUrl = `${RWA_SERVER_URL}/chart/chain/all`
	switch (target.kind) {
		case 'all':
			break
		case 'chain':
			chartUrl = `${RWA_SERVER_URL}/chart/chain/${target.slug}`
			break
		case 'category':
			chartUrl = `${RWA_SERVER_URL}/chart/category/${target.slug}`
			break
		case 'platform':
			chartUrl = `${RWA_SERVER_URL}/chart/platform/${target.slug}`
			break
		case 'assetGroup':
			chartUrl = `${RWA_SERVER_URL}/chart/assetGroup/${target.slug}`
			break
		default:
			assertNever(target)
	}

	const searchParams = new URLSearchParams({
		includeStablecoin: String(includeStablecoins),
		includeGovernance: String(includeGovernance)
	})
	return fetchJson<IRWAChartDataByAsset>(`${chartUrl}/asset-breakdown?${searchParams.toString()}`)
}

export async function fetchRWAChartMetricDataByAsset({
	target,
	metric,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl = true
}: {
	target: RWAAssetChartTarget
	metric: RWAChartMetricKey
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl?: boolean
}): Promise<IRWAChartMetricRows | null> {
	return fetchRWAChartDataByAsset({ target, includeStablecoins, includeGovernance })
		.then((data) => normalizeRWAChartMetricRows(data, metric, includeBridgeTvl))
		.catch((error) => {
			console.error(`Failed to fetch RWA ${metric} chart data by asset:`, error)
			return null
		})
}

/**
 * Subtract the per-asset bridge/interop portion from defiActiveTvl rows.
 * Only meaningful for the defiActiveTvl metric; other metrics have no bridge component.
 */
export function subtractBridgeFromMetricRows(
	defiRows: IRWAChartMetricRows,
	bridgeRows: IRWAChartMetricRows | undefined
): IRWAChartMetricRows {
	if (bridgeRows == null) throw new Error('RWA bridge TVL history is unavailable')
	const bridgeByTimestamp = new Map<number, Record<string, number>>()
	for (const row of bridgeRows) bridgeByTimestamp.set(row.timestamp, row as Record<string, number>)

	return defiRows.map((row) => {
		const bridgeRow = bridgeByTimestamp.get(row.timestamp)
		if (!bridgeRow) throw new Error(`RWA bridge TVL history is missing timestamp ${row.timestamp}`)
		const out: { timestamp: number } & Record<string, number> = { timestamp: row.timestamp }
		for (const key in row) {
			if (key === 'timestamp') continue
			const value = row[key]
			if (value === undefined) continue
			const bridgeVal = bridgeRow[key] ?? 0
			out[key] = value - bridgeVal
		}
		return out
	})
}

export function normalizeRWAChartMetricRows(
	data: IRWAChartDataByAsset,
	metric: RWAChartMetricKey,
	includeBridgeTvl = true
): IRWAChartMetricRows {
	const rows =
		metric === 'defiActiveTvl' && !includeBridgeTvl
			? subtractBridgeFromMetricRows(data.defiActiveTvl, data.bridgeTvl)
			: data[metric]
	return rows.map((row) => ({ ...row, timestamp: rwaUnixSecondsToMilliseconds(row.timestamp) }))
}

function normalizeRWABreakdownChartRows(rows: IRWABreakdownChartResponse): IRWABreakdownChartResponse {
	return rows.map((row) => ({ ...row, timestamp: rwaUnixSecondsToMilliseconds(row.timestamp) }))
}

/**
 * Fetch chain-level RWA breakdown chart data.
 */
export async function fetchRWAChainBreakdownChartData(
	params: IRWABreakdownChartParams = {}
): Promise<IRWABreakdownChartResponse | null> {
	const searchParams = new URLSearchParams()
	if (params.key && params.key !== 'onChainMcap') searchParams.set('key', params.key)
	if (params.includeStablecoin) searchParams.set('includeStablecoin', 'true')
	if (params.includeGovernance) searchParams.set('includeGovernance', 'true')
	const qs = searchParams.toString()
	const url = `${RWA_SERVER_URL}/chart/chain-breakdown${qs ? `?${qs}` : ''}`
	return fetchJson<IRWABreakdownChartResponse>(url)
		.then(normalizeRWABreakdownChartRows)
		.catch((error) => {
			console.error('Failed to fetch RWA chain breakdown chart data:', error)
			return null
		})
}

/**
 * Fetch category-level RWA breakdown chart data.
 */
export async function fetchRWACategoryBreakdownChartData(
	params: IRWABreakdownChartParams = {}
): Promise<IRWABreakdownChartResponse | null> {
	const searchParams = new URLSearchParams()
	if (params.key && params.key !== 'onChainMcap') searchParams.set('key', params.key)
	if (params.includeStablecoin) searchParams.set('includeStablecoin', 'true')
	if (params.includeGovernance) searchParams.set('includeGovernance', 'true')
	const qs = searchParams.toString()
	const url = `${RWA_SERVER_URL}/chart/category-breakdown${qs ? `?${qs}` : ''}`
	return fetchJson<IRWABreakdownChartResponse>(url)
		.then(normalizeRWABreakdownChartRows)
		.catch((error) => {
			console.error('Failed to fetch RWA category breakdown chart data:', error)
			return null
		})
}

/**
 * Fetch platform-level RWA breakdown chart data.
 */
export async function fetchRWAPlatformBreakdownChartData(
	params: IRWABreakdownChartParams = {}
): Promise<IRWABreakdownChartResponse | null> {
	const searchParams = new URLSearchParams()
	if (params.key && params.key !== 'onChainMcap') searchParams.set('key', params.key)
	if (params.includeStablecoin) searchParams.set('includeStablecoin', 'true')
	if (params.includeGovernance) searchParams.set('includeGovernance', 'true')
	const qs = searchParams.toString()
	const url = `${RWA_SERVER_URL}/chart/platform-breakdown${qs ? `?${qs}` : ''}`
	return fetchJson<IRWABreakdownChartResponse>(url)
		.then(normalizeRWABreakdownChartRows)
		.catch((error) => {
			console.error('Failed to fetch RWA platform breakdown chart data:', error)
			return null
		})
}

/**
 * Fetch asset-group-level RWA breakdown chart data.
 */
export async function fetchRWAAssetGroupBreakdownChartData(
	params: IRWABreakdownChartParams = {}
): Promise<IRWABreakdownChartResponse | null> {
	const searchParams = new URLSearchParams()
	if (params.key && params.key !== 'onChainMcap') searchParams.set('key', params.key)
	if (params.includeStablecoin) searchParams.set('includeStablecoin', 'true')
	if (params.includeGovernance) searchParams.set('includeGovernance', 'true')
	const qs = searchParams.toString()
	const url = `${RWA_SERVER_URL}/chart/assetGroup-breakdown${qs ? `?${qs}` : ''}`
	return fetchJson<IRWABreakdownChartResponse>(url)
		.then(normalizeRWABreakdownChartRows)
		.catch((error) => {
			console.error('Failed to fetch RWA asset-group breakdown chart data:', error)
			return null
		})
}

/**
 * Fetch and normalize historical chart data for a single RWA asset.
 */
export async function fetchRWAAssetChartData(assetId: string): Promise<IRWAAssetData['chartDataset']> {
	const encodedAssetId = encodeURIComponent(assetId)
	return fetchJson<Array<IRWAAssetChartApiRow>>(`${RWA_SERVER_URL}/chart/asset/${encodedAssetId}`)
		.then(buildRWAAssetChartDataset)
		.catch((error) => {
			console.error('Failed to fetch RWA asset chart data:', error)
			return null
		})
}

export function buildRWAAssetChartDataset(
	data: Array<IRWAAssetChartApiRow>
): NonNullable<IRWAAssetData['chartDataset']> {
	const source = data.map<[number, number | null, number | null, number | null]>((item) => [
		rwaUnixSecondsToMilliseconds(item.timestamp),
		item.defiActiveTvl ?? null,
		item.activeMcap ?? null,
		item.onChainMcap ?? null
	])
	return { source, dimensions: ['timestamp', 'DeFi Active TVL', 'Active Mcap', 'Onchain Mcap'] }
}
