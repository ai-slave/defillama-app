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
	RWAAssetChartTarget,
	RWAChartMetricKey
} from './api.types'
import { rwaSlug } from './rwaSlug'

export function rwaUnixSecondsToMilliseconds(ts: number): number {
	return ts * 1e3
}

/**
 * Fetch current active TVL values for RWA projects.
 */
export async function fetchRWAActiveTVLs(): Promise<Array<IFetchedRWAProject>> {
	return fetchJson<Array<IFetchedRWAProject>>(`${RWA_SERVER_URL}/current`)
}

/**
 * Fetch the listing view of the current RWA rows, the fields the RWA pages read.
 * ProDashboard keeps fetchRWAActiveTVLs: its asset picker reads coingeckoId, which the listing leaves out.
 */
export async function fetchRWACurrentListing(): Promise<Array<IFetchedRWAProject>> {
	const rows = await fetchJson<Array<IFetchedRWAProject>>(`${RWA_SERVER_URL}/current?lite=true`)
	// The listing leaves out empty values. The row type requires the first three, and the pages read
	// a missing bridgeTvlBreakdown as an unknown bridge split rather than none.
	return rows.map((row) => ({ price: null, onChainMcap: {}, defiActiveTvl: {}, bridgeTvlBreakdown: {}, ...row }))
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

// This protocol's OWN issued RWA mcap history, same bare [unixSec, usd] shape. Server-side the
// series is summed over the assets the protocol is credited with issuing, so a child reports its
// own product rather than the parent platform's whole book.
export async function fetchRWAProtocolMcapChart(protocolSlug: string): Promise<Array<[number, number]>> {
	const rows = await fetchJson<Array<[number, number]>>(
		`${RWA_SERVER_URL}/protocol/${encodeURIComponent(protocolSlug)}/mcap/chart`
	)
	return Array.isArray(rows) ? rows.filter((row) => Array.isArray(row) && row.length === 2) : []
}

// Platform Active AUM history as a bare [unixSec, usd] series — the shape the protocol
// chart panel expects. Read off the platform breakdown rather than /chart/platform/:slug so
// governance tokens are excluded and stablecoins kept, matching the platform page's active AUM.
export async function fetchRWAPlatformAumChart(platformSlug: string): Promise<Array<[number, number]>> {
	const rows = await fetchJson<IRWABreakdownChartResponse>(
		`${RWA_SERVER_URL}/chart/platform-breakdown?key=activeMcap&includeStablecoin=true`
	).then(rwaRowsInMilliseconds)
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
		// The shared breakdown fetcher normalizes timestamps to milliseconds; this series is seconds.
		series.push([row.timestamp / 1e3, total])
	}
	series.sort((a, b) => a[0] - b[0])
	// The platform series starts at the RWA dataset epoch, not the platform's first asset, so
	// it can carry years of leading zeros that render as a flat line before any real history.
	let firstNonZero = 0
	while (firstNonZero < series.length && series[firstNonZero]![1] === 0) firstNonZero++
	return firstNonZero > 0 ? series.slice(firstNonZero) : series
}

type RWAAssetBreakdownScope = {
	target: RWAAssetChartTarget
	includeStablecoins: boolean
	includeGovernance: boolean
}

/**
 * The route of a scope's per-asset history, relative to RWA_SERVER_URL. Every asset is the all-chains file.
 */
export function buildRWAAssetBreakdownPath({
	target,
	includeStablecoins,
	includeGovernance
}: RWAAssetBreakdownScope): string {
	const scope = target.kind === 'all' ? 'chain/all' : `${target.kind}/${encodeURIComponent(rwaSlug(target.slug))}`
	const searchParams = new URLSearchParams({
		includeStablecoin: String(includeStablecoins),
		includeGovernance: String(includeGovernance)
	})
	return `/chart/${scope}/asset-breakdown?${searchParams.toString()}`
}

/**
 * Fetch a scope's per-asset history for all four metrics at once.
 */
export async function fetchRWAChartDataByAsset(scope: RWAAssetBreakdownScope): Promise<IRWAChartDataByAsset> {
	return fetchJson<IRWAChartDataByAsset>(`${RWA_SERVER_URL}${buildRWAAssetBreakdownPath(scope)}`)
}

function fetchRWAAssetBreakdownMetric(
	path: string,
	metric: RWAChartMetricKey | 'bridgeTvl',
	timeout?: number
): Promise<IRWAChartMetricRows> {
	return fetchJson<IRWAChartMetricRows>(`${RWA_SERVER_URL}${path}&key=${metric}`, { timeout })
}

// DeFi TVL without its bridge part is the only metric read as two series and subtracted.
function leavesOutBridge(metric: RWAChartMetricKey, includeBridgeTvl: boolean): boolean {
	return metric === 'defiActiveTvl' && !includeBridgeTvl
}

/**
 * Fetch one metric of a scope's per-asset history, timestamps in unix seconds as served.
 * With bridge TVL left out, DeFi TVL is read with its bridge portion and the two are subtracted.
 */
export async function fetchRWAAssetBreakdownRows({
	metric,
	includeBridgeTvl = true,
	timeout,
	...scope
}: RWAAssetBreakdownScope & {
	metric: RWAChartMetricKey
	includeBridgeTvl?: boolean
	timeout?: number
}): Promise<IRWAChartMetricRows> {
	const path = buildRWAAssetBreakdownPath(scope)
	if (!leavesOutBridge(metric, includeBridgeTvl)) return fetchRWAAssetBreakdownMetric(path, metric, timeout)
	const [defiRows, bridgeRows] = await Promise.all([
		fetchRWAAssetBreakdownMetric(path, 'defiActiveTvl', timeout),
		fetchRWAAssetBreakdownMetric(path, 'bridgeTvl', timeout)
	])
	return subtractBridgeFromMetricRows(defiRows, bridgeRows)
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
	return fetchRWAAssetBreakdownRows({ target, metric, includeStablecoins, includeGovernance, includeBridgeTvl })
		.then(rwaRowsInMilliseconds)
		.catch((error) => {
			const scope = target.kind === 'all' ? 'every asset' : `${target.kind} ${target.slug}`
			console.error(`Failed to fetch the RWA ${metric} history of ${scope}:`, error)
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
	const rows = leavesOutBridge(metric, includeBridgeTvl)
		? subtractBridgeFromMetricRows(data.defiActiveTvl, data.bridgeTvl)
		: data[metric]
	return rwaRowsInMilliseconds(rows)
}

/** Chart rows with the API's unix-second timestamps turned into milliseconds. */
export function rwaRowsInMilliseconds<T extends { timestamp: number }>(rows: Array<T>): Array<T> {
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
		.then(rwaRowsInMilliseconds)
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
		.then(rwaRowsInMilliseconds)
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
		.then(rwaRowsInMilliseconds)
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
		.then(rwaRowsInMilliseconds)
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
	return fetchJson<Array<IRWAAssetChartApiRow>>(`${RWA_SERVER_URL}/chart/asset/${encodedAssetId}?excludeChains=true`)
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
	return { source, dimensions: ['timestamp', 'DeFi Active TVL', 'Active AUM', 'Onchain AUM'] }
}
