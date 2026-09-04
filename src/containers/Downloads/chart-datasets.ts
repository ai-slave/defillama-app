import {
	SERVER_URL,
	V2_SERVER_URL,
	YIELDS_V2_SERVER_URL,
	BRIDGES_SERVER_URL,
	RWA_SERVER_URL,
	STABLECOINS_SERVER_URL
} from '~/constants'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import type { EarnRow } from '~/containers/Yields/data/types'
import { fetchPoolDetailHistory } from '~/containers/Yields/poolDetail/fetch'
import type { PoolHistory } from '~/containers/Yields/poolDetail/types'
import { slug as toSlug } from '~/utils'
import { fetchWithPoolingOnServer } from '~/utils/http-client'

export type CategoryBreakdownKind = { kind: 'tvl' } | { kind: 'dimension'; adapterType: string; dataType?: string }

export interface ChartDatasetDefinition {
	slug: string
	name: string
	description: string
	category: string
	paramType: 'protocol' | 'chain'
	paramLabel: string
	optionsUrl: string
	extractOptions: (json: unknown) => Array<{ label: string; value: string }>
	buildUrl: (param: string) => string
	extractRows: (json: unknown) => Array<Record<string, unknown>>
	customFetch?: (param: string) => Promise<Array<Record<string, unknown>>>
	categoryBreakdown?: CategoryBreakdownKind
	sumMode?: { columnLabel: string }
}

const OVERVIEW_QS = 'excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true'

type ProtocolOption = { label: string; value: string; category?: string; isChild?: boolean }
type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value != null && !Array.isArray(value)
}

function recordArray(value: unknown, field: string): JsonRecord[] {
	if (!isRecord(value) || !Array.isArray(value[field])) return []
	return value[field].filter(isRecord)
}

function recordValue(value: unknown, field: string): unknown {
	return isRecord(value) ? value[field] : undefined
}

function stringValue(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null
}

function createDownloadChartRow(date: unknown): Record<string, unknown> {
	return { date }
}

/**
 * Group protocols by parent, following the same pattern as ProDashboard.
 *
 * The `parentProtocols` array from the API provides parent entries (id, name).
 * Children reference their parent via `parentProtocol` field.
 * We create synthetic parent entries with aggregated sort values,
 * merge them with solo protocols, and nest children underneath.
 */
function groupProtocolOptions(
	json: unknown,
	sortValue: (protocol: JsonRecord) => number,
	labelFn: (protocol: JsonRecord) => string
): ProtocolOption[] {
	const protocols = recordArray(json, 'protocols')
	const parentProtocols = recordArray(json, 'parentProtocols')

	const filtered = protocols.filter((protocol) => stringValue(protocol.name))

	// Aggregate child sort values per parent
	const parentTotals = new Map<string, number>()
	const childrenByParentId = new Map<string, JsonRecord[]>()

	for (const protocol of filtered) {
		const parentId = stringValue(protocol.parentProtocol)
		if (parentId) {
			parentTotals.set(parentId, (parentTotals.get(parentId) || 0) + sortValue(protocol))
			const children = childrenByParentId.get(parentId) || []
			children.push(protocol)
			childrenByParentId.set(parentId, children)
		}
	}

	// Build synthetic parent entries from the parentProtocols array
	const matchedParentIds = new Set<string>()
	const syntheticParents: JsonRecord[] = []
	for (const parent of parentProtocols) {
		const parentId = stringValue(parent.id)
		if (parentId == null || !childrenByParentId.has(parentId)) continue
		matchedParentIds.add(parentId)
		syntheticParents.push({
			name: parent.name,
			id: parentId,
			category: childrenByParentId.get(parentId)?.[0]?.category ?? undefined,
			_syntheticTvl: parentTotals.get(parentId) || 0,
			parentProtocol: null
		})
	}

	// Children whose parent isn't in parentProtocols (e.g. overview APIs) — treat as top-level
	const soloProtocols: JsonRecord[] = []
	const orphanedChildren: JsonRecord[] = []
	for (const protocol of filtered) {
		const parentId = stringValue(protocol.parentProtocol)
		if (!parentId) soloProtocols.push(protocol)
		else if (!matchedParentIds.has(parentId)) orphanedChildren.push(protocol)
	}

	// Merge: solo protocols + synthetic parents + orphaned children, then sort
	const parentsOrSolo = [...soloProtocols, ...syntheticParents, ...orphanedChildren]
	parentsOrSolo.sort(
		(a, b) =>
			(typeof b._syntheticTvl === 'number' ? b._syntheticTvl : sortValue(b)) -
			(typeof a._syntheticTvl === 'number' ? a._syntheticTvl : sortValue(a))
	)

	const options: ProtocolOption[] = []
	for (const parent of parentsOrSolo) {
		const name = stringValue(parent.name)
		if (!name) continue
		options.push({
			label: labelFn(parent),
			value: toSlug(name),
			category: stringValue(parent.category) ?? undefined
		})
		const parentId = stringValue(parent.id)
		const children = parentId ? childrenByParentId.get(parentId) || [] : []
		if (children.length > 0) {
			children.sort((a, b) => sortValue(b) - sortValue(a))
			for (const child of children) {
				const childName = stringValue(child.name)
				if (!childName) continue
				options.push({
					label: labelFn(child),
					value: toSlug(childName),
					category: stringValue(child.category) ?? undefined,
					isChild: true
				})
			}
		}
	}

	return options
}

const extractOverviewProtocolOptions = (json: unknown): ProtocolOption[] =>
	groupProtocolOptions(
		json,
		(p) => Number(p.total24h) || 0,
		(p) => stringValue(p.displayName) ?? stringValue(p.name) ?? ''
	)

const extractLiteProtocolOptions = (json: unknown): ProtocolOption[] =>
	groupProtocolOptions(
		json,
		(p) => Number(p.tvlUsd ?? p.tvl) || 0,
		(p) => stringValue(p.name) ?? ''
	)

function sumBorrowedTvl(chainTvls: unknown): number {
	if (!chainTvls || typeof chainTvls !== 'object' || Array.isArray(chainTvls)) return 0
	let total = 0
	for (const [key, entry] of Object.entries(chainTvls)) {
		if (!key.endsWith('-borrowed')) continue
		const tvl = isRecord(entry) ? Number(entry.tvl) : Number(entry)
		if (Number.isFinite(tvl) && tvl > 0) total += tvl
	}
	return total
}

const extractActiveLoansProtocolOptions = (json: unknown): ProtocolOption[] => {
	const protocols = recordArray(json, 'protocols')
	const withBorrowed = protocols.filter((protocol) => sumBorrowedTvl(protocol.chainTvls) > 0)
	const parentIdsWithBorrowed = new Set<string>()
	for (const protocol of withBorrowed) {
		const parentId = stringValue(protocol.parentProtocol)
		if (parentId) parentIdsWithBorrowed.add(parentId)
	}
	const parentProtocols = recordArray(json, 'parentProtocols').filter((parent) => {
		const parentId = stringValue(parent.id)
		return parentId != null && parentIdsWithBorrowed.has(parentId)
	})
	return groupProtocolOptions(
		{ protocols: withBorrowed, parentProtocols },
		(p) => sumBorrowedTvl(p.chainTvls),
		(p) => stringValue(p.name) ?? ''
	)
}

const extractOverviewChainOptions = (json: unknown): Array<{ label: string; value: string }> => {
	const chains = recordValue(json, 'allChains')
	const chainOptions = Array.isArray(chains)
		? chains.flatMap(
				(chain): Array<{ label: string; value: string }> =>
					typeof chain === 'string' && chain ? [{ label: chain, value: toSlug(chain) }] : []
			)
		: []
	chainOptions.sort((a, b) => a.label.localeCompare(b.label))
	return [{ label: 'All Chains', value: 'all' }, ...chainOptions]
}

const extractTimestampValuePairs = (json: unknown): Array<Record<string, unknown>> => {
	if (!Array.isArray(json)) return []
	const rows: Array<Record<string, unknown>> = []
	for (const item of json) {
		if (!Array.isArray(item) || item.length < 2) continue
		rows.push({ date: item[0], value: item[1] })
	}
	return rows
}

const extractLiteChartRows = (json: unknown): Array<Record<string, unknown>> => {
	if (Array.isArray(json)) {
		const rows: Array<Record<string, unknown>> = []
		for (const item of json) {
			if (!isRecord(item) || item.date == null) continue
			const row = createDownloadChartRow(item.date)
			for (const key in item) {
				if (key === 'date') continue
				row[key] = item[key]
			}
			rows.push(row)
		}
		return rows
	}
	if (isRecord(json)) {
		const metrics: string[] = []
		for (const key in json) {
			if (json[key] && typeof json[key] === 'object') metrics.push(key)
		}
		if (metrics.length === 0) return []

		const isArrayOfPairs = metrics.some(
			(k) => Array.isArray(json[k]) && json[k].length > 0 && Array.isArray(json[k][0])
		)

		if (isArrayOfPairs) {
			const tsMap = new Map<number, Record<string, unknown>>()
			for (const metric of metrics) {
				const arr = json[metric]
				if (!Array.isArray(arr)) continue
				for (const entry of arr) {
					if (!Array.isArray(entry) || entry.length < 2) continue
					const ts = Number(entry[0])
					if (!Number.isFinite(ts)) continue
					let row = tsMap.get(ts)
					if (!row) {
						row = createDownloadChartRow(ts)
						tsMap.set(ts, row)
					}
					row[metric] = entry[1]
				}
			}
			return [...tsMap.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)
		}

		const timestampSet = new Set<string>()
		for (const metric of metrics) {
			const series = json[metric]
			if (isRecord(series)) for (const ts in series) timestampSet.add(ts)
		}
		return [...timestampSet]
			.sort((a, b) => Number(a) - Number(b))
			.map((ts) => {
				const row = createDownloadChartRow(Number(ts))
				for (const metric of metrics) {
					const series = json[metric]
					row[metric] = isRecord(series) ? (series[ts] ?? null) : null
				}
				return row
			})
	}
	return []
}

const extractBridgeVolumeRows = (json: unknown): Array<Record<string, unknown>> => {
	if (!Array.isArray(json)) return []
	const rows: Array<Record<string, unknown>> = []
	for (const item of json) {
		if (!isRecord(item) || item.date == null) continue
		rows.push({
			date: item.date,
			depositUSD: item.depositUSD ?? null,
			withdrawUSD: item.withdrawUSD ?? null,
			depositTxs: item.depositTxs ?? null,
			withdrawTxs: item.withdrawTxs ?? null
		})
	}
	return rows
}

export function extractYieldsV2HistoryRows(history: PoolHistory): Array<Record<string, unknown>> {
	return history.map((point) => ({
		date: point.date,
		tvlUsd: point.tvl_usd,
		supplyApy: point.apy.avg_1d.total,
		supplyApyBase: point.apy.avg_1d.base,
		supplyApyReward: point.apy.avg_1d.reward,
		supplyApyIntrinsic: point.intrinsic?.apy.avg_1d.base ?? null,
		supplyApy7d: point.apy.avg_7d.total,
		supplyApyBase7d: point.apy.avg_7d.base,
		supplyApyReward7d: point.apy.avg_7d.reward,
		supplyApyIntrinsic7d: point.intrinsic?.apy.avg_7d.base ?? null,
		supplyApy30d: point.apy.avg_30d.total,
		supplyApyBase30d: point.apy.avg_30d.base,
		supplyApyReward30d: point.apy.avg_30d.reward,
		supplyApyIntrinsic30d: point.intrinsic?.apy.avg_30d.base ?? null,
		pricePerShare: point.price_per_share
	}))
}

const extractRWACategoryRows = (json: unknown): Array<Record<string, unknown>> => {
	if (!Array.isArray(json)) return []
	const rows: Array<Record<string, unknown>> = []
	for (const item of json) {
		if (!isRecord(item) || item.timestamp == null) continue
		const row = createDownloadChartRow(item.timestamp)
		for (const key in item) {
			if (key === 'timestamp') continue
			row[key] = item[key]
		}
		rows.push(row)
	}
	return rows
}

function sumRecord(rec: unknown): number {
	if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return 0
	let total = 0
	for (const key in rec) {
		const v = rec[key]
		if (typeof v === 'number' && Number.isFinite(v)) total += v
	}
	return total
}

function makeDimensionProtocolChart(opts: {
	slug: string
	name: string
	description: string
	category: string
	adapterType: string
	dataType?: string
}): ChartDatasetDefinition {
	const dtParam = opts.dataType ? `&dataType=${opts.dataType}` : ''
	const dtChartParam = opts.dataType ? `?dataType=${opts.dataType}` : ''
	return {
		slug: opts.slug,
		name: opts.name,
		description: opts.description,
		category: opts.category,
		paramType: 'protocol',
		paramLabel: 'Protocol',
		optionsUrl: `${SERVER_URL}/overview/${opts.adapterType}?${OVERVIEW_QS}${dtParam}`,
		extractOptions: extractOverviewProtocolOptions,
		buildUrl: (param: string) =>
			`${V2_SERVER_URL}/chart/${opts.adapterType}/protocol/${encodeURIComponent(param)}${dtChartParam}`,
		extractRows: extractTimestampValuePairs,
		categoryBreakdown: { kind: 'dimension', adapterType: opts.adapterType, dataType: opts.dataType }
	}
}

function makeDimensionChainChart(opts: {
	slug: string
	name: string
	description: string
	category: string
	adapterType: string
	dataType?: string
}): ChartDatasetDefinition {
	const dtParam = opts.dataType ? `&dataType=${opts.dataType}` : ''
	const dtChartParam = opts.dataType ? `?dataType=${opts.dataType}` : ''
	return {
		slug: opts.slug,
		name: opts.name,
		description: opts.description,
		category: opts.category,
		paramType: 'chain',
		paramLabel: 'Chain',
		optionsUrl: `${SERVER_URL}/overview/${opts.adapterType}?${OVERVIEW_QS}${dtParam}`,
		extractOptions: extractOverviewChainOptions,
		buildUrl: (param: string) =>
			param === 'all'
				? `${V2_SERVER_URL}/chart/${opts.adapterType}${dtChartParam}`
				: `${V2_SERVER_URL}/chart/${opts.adapterType}/chain/${encodeURIComponent(param)}${dtChartParam}`,
		extractRows: extractTimestampValuePairs
	}
}

const extractOverviewCategoryOptions = (json: unknown): Array<{ label: string; value: string }> => {
	const protocols = recordArray(json, 'protocols')
	const catTotals = new Map<string, number>()
	for (const p of protocols) {
		const c = p.category
		if (typeof c === 'string' && c) {
			catTotals.set(c, (catTotals.get(c) || 0) + (Number(p.total24h) || 0))
		}
	}
	return [...catTotals.entries()].sort(([, a], [, b]) => b - a).map(([c]) => ({ label: c, value: toSlug(c) }))
}

function makeDimensionCategoryChart(opts: {
	slug: string
	name: string
	description: string
	category: string
	adapterType: string
	dataType?: string
}): ChartDatasetDefinition {
	const dtParam = opts.dataType ? `&dataType=${opts.dataType}` : ''
	const dtChartParam = opts.dataType ? `?dataType=${opts.dataType}` : ''
	return {
		slug: opts.slug,
		name: opts.name,
		description: opts.description,
		category: opts.category,
		paramType: 'protocol',
		paramLabel: 'Category',
		optionsUrl: `${SERVER_URL}/overview/${opts.adapterType}?${OVERVIEW_QS}${dtParam}`,
		extractOptions: extractOverviewCategoryOptions,
		buildUrl: (param: string) =>
			`${V2_SERVER_URL}/chart/${opts.adapterType}/category/${encodeURIComponent(param)}${dtChartParam}`,
		extractRows: extractTimestampValuePairs
	}
}

export const chartDatasets: ChartDatasetDefinition[] = [
	{
		slug: 'rwa-category-chart',
		name: 'RWA by Category',
		description: 'Historical Real World Asset breakdown by category (Tokenized Funds, Gold, Stocks, etc.)',
		category: 'RWA',
		paramType: 'chain',
		paramLabel: 'Chain',
		sumMode: { columnLabel: 'mcap' },
		optionsUrl: `${RWA_SERVER_URL}/current?z=0`,
		extractOptions: (json) => {
			const allOption = { label: 'All Chains', value: 'all' }
			if (!Array.isArray(json)) return [allOption]
			const chainMcap = new Map<string, number>()
			for (const item of json) {
				if (!isRecord(item)) continue
				const chains = item.chain
				const mcapData = item.activeMcap
				if (!Array.isArray(chains)) continue
				for (const c of chains) {
					if (typeof c !== 'string') continue
					let mcap = 0
					if (isRecord(mcapData)) {
						mcap = Number(mcapData[c]) || 0
					}
					chainMcap.set(c, (chainMcap.get(c) ?? 0) + mcap)
				}
			}
			return [
				allOption,
				...[...chainMcap.entries()].sort(([, a], [, b]) => b - a).map(([c]) => ({ label: c, value: c }))
			]
		},
		buildUrl: (_param: string) => `${RWA_SERVER_URL}/chart/category-breakdown`,
		extractRows: extractRWACategoryRows,
		customFetch: async (param: string) => {
			if (param === 'all') {
				const resp = await fetchWithPoolingOnServer(`${RWA_SERVER_URL}/chart/category-breakdown`)
				if (!resp.ok) return []
				return extractRWACategoryRows(await resp.json())
			}
			const [assetResp, assetsResp] = await Promise.all([
				fetchWithPoolingOnServer(`${RWA_SERVER_URL}/chart/chain/${encodeURIComponent(param)}/asset-breakdown`),
				fetchWithPoolingOnServer(`${RWA_SERVER_URL}/current?z=0`)
			])
			if (!assetResp.ok || !assetsResp.ok) return []
			const assetData: unknown = await assetResp.json()
			const assets: unknown = await assetsResp.json()
			const assetToCategory = new Map<string, string>()
			if (Array.isArray(assets)) {
				for (const asset of assets) {
					if (!isRecord(asset)) continue
					const canonicalMarketId = asset.canonicalMarketId
					const cats = asset.category
					if (typeof canonicalMarketId === 'string' && Array.isArray(cats) && typeof cats[0] === 'string') {
						assetToCategory.set(canonicalMarketId, cats[0])
					}
				}
			}
			const onChainMcap = recordArray(assetData, 'onChainMcap')
			if (onChainMcap.length === 0) return []
			return onChainMcap
				.filter((item) => item.timestamp != null)
				.map((item) => {
					const row = createDownloadChartRow(item.timestamp)
					const catTotals = new Map<string, number>()
					for (const [key, val] of Object.entries(item)) {
						if (key === 'timestamp') continue
						const cat = assetToCategory.get(key) ?? 'Other'
						catTotals.set(cat, (catTotals.get(cat) ?? 0) + (Number(val) || 0))
					}
					for (const [cat, total] of catTotals) {
						row[cat] = total
					}
					return row
				})
		}
	},
	{
		slug: 'rwa-chain-chart',
		name: 'RWA by Chain',
		description: 'Historical total RWA on-chain mcap for a specific chain',
		category: 'RWA',
		paramType: 'chain',
		paramLabel: 'Chain',
		optionsUrl: `${RWA_SERVER_URL}/current?z=0`,
		extractOptions: (json) => {
			if (!Array.isArray(json)) return []
			const chainMcap = new Map<string, number>()
			for (const item of json) {
				if (!isRecord(item)) continue
				const chains = item.chain
				const mcapData = item.activeMcap
				if (!Array.isArray(chains)) continue
				for (const c of chains) {
					if (typeof c !== 'string') continue
					let mcap = 0
					if (isRecord(mcapData)) {
						mcap = Number(mcapData[c]) || 0
					}
					chainMcap.set(c, (chainMcap.get(c) ?? 0) + mcap)
				}
			}
			return [...chainMcap.entries()].sort(([, a], [, b]) => b - a).map(([c]) => ({ label: c, value: c }))
		},
		buildUrl: (param: string) => `${RWA_SERVER_URL}/chart/chain/${encodeURIComponent(param)}/asset-breakdown`,
		extractRows: (json) => {
			const onChainMcap = recordArray(json, 'onChainMcap')
			if (onChainMcap.length === 0) return []
			return onChainMcap
				.filter((item) => item.timestamp != null)
				.map((item) => {
					let total = 0
					for (const [key, val] of Object.entries(item)) {
						if (key === 'timestamp') continue
						if (typeof val === 'number' && Number.isFinite(val)) total += val
					}
					return { date: item.timestamp, value: total }
				})
		}
	},
	{
		slug: 'rwa-asset-chart',
		name: 'RWA by Asset',
		description: 'Historical on-chain mcap time series for every Real World Asset in a selected category',
		category: 'RWA',
		paramType: 'protocol',
		paramLabel: 'Category',
		sumMode: { columnLabel: 'mcap' },
		optionsUrl: `${RWA_SERVER_URL}/current?z=0`,
		extractOptions: (json) => {
			if (!Array.isArray(json)) return []
			const catMcap = new Map<string, number>()
			for (const item of json) {
				if (!isRecord(item)) continue
				const cats = item.category
				if (!Array.isArray(cats)) continue
				const total = sumRecord(item.onChainMcap)
				for (const c of cats) {
					if (typeof c !== 'string' || !c) continue
					if (c === 'rwa-perps') continue
					catMcap.set(c, (catMcap.get(c) ?? 0) + total)
				}
			}
			return [...catMcap.entries()].sort(([, a], [, b]) => b - a).map(([c]) => ({ label: c, value: rwaSlug(c) }))
		},
		buildUrl: (param: string) => `${RWA_SERVER_URL}/chart/category/${encodeURIComponent(param)}/asset-breakdown`,
		extractRows: () => [],
		customFetch: async (param: string) => {
			const [chartResp, assetsResp] = await Promise.all([
				fetchWithPoolingOnServer(`${RWA_SERVER_URL}/chart/category/${encodeURIComponent(param)}/asset-breakdown`),
				fetchWithPoolingOnServer(`${RWA_SERVER_URL}/current?z=0`)
			])
			if (!chartResp.ok || !assetsResp.ok) return []
			const chart: unknown = await chartResp.json()
			const assets: unknown = await assetsResp.json()
			const idToName = new Map<string, string>()
			if (Array.isArray(assets)) {
				for (const asset of assets) {
					if (!isRecord(asset)) continue
					const id = asset.canonicalMarketId
					const name = asset.assetName ?? asset.ticker
					if (typeof id === 'string' && typeof name === 'string') {
						idToName.set(id, name)
					}
				}
			}
			const onChainMcap = recordArray(chart, 'onChainMcap')
			if (onChainMcap.length === 0) return []
			return onChainMcap
				.filter((item) => item.timestamp != null)
				.map((item) => {
					const row = createDownloadChartRow(item.timestamp)
					const seen = new Map<string, number>()
					for (const [key, val] of Object.entries(item)) {
						if (key === 'timestamp') continue
						const label = idToName.get(key) ?? key
						seen.set(label, (seen.get(label) ?? 0) + (Number(val) || 0))
					}
					for (const [label, v] of seen) row[label] = v
					return row
				})
		}
	},

	{
		slug: 'stablecoin-mcap-chart',
		name: 'Stablecoin Mcap by Stablecoin',
		description: 'Historical circulating supply for a specific stablecoin',
		category: 'Stablecoins',
		paramType: 'protocol',
		paramLabel: 'Stablecoin',
		optionsUrl: `${STABLECOINS_SERVER_URL}/stablecoins`,
		extractOptions: (json) => {
			const assets = recordArray(json, 'peggedAssets')
			return assets
				.filter((asset) => stringValue(asset.name) && !asset.deprecated && !asset.delisted)
				.sort((a, b) => sumRecord(b.circulating) - sumRecord(a.circulating))
				.map((asset) => ({ label: `${String(asset.name)} (${String(asset.symbol)})`, value: String(asset.id) }))
		},
		buildUrl: (param: string) => `${STABLECOINS_SERVER_URL}/stablecoin/${encodeURIComponent(param)}`,
		extractRows: (json) => {
			const tokens = recordArray(json, 'tokens')
			return tokens
				.filter((token) => token.date != null)
				.map((token) => ({
					date: token.date,
					circulating: sumRecord(token.circulating)
				}))
		}
	},
	{
		slug: 'stablecoin-chain-mcap-chart',
		name: 'Stablecoin Mcap by Chain',
		description: 'Historical total stablecoin circulating supply for a specific chain',
		category: 'Stablecoins',
		paramType: 'chain',
		paramLabel: 'Chain',
		optionsUrl: `${STABLECOINS_SERVER_URL}/stablecoins`,
		extractOptions: (json) => {
			const chains = recordArray(json, 'chains')
			return [
				{ label: 'All Chains', value: 'all' },
				...chains
					.filter((chain) => stringValue(chain.name))
					.sort((a, b) => sumRecord(b.totalCirculatingUSD) - sumRecord(a.totalCirculatingUSD))
					.map((chain) => ({ label: String(chain.name), value: String(chain.name) }))
			]
		},
		buildUrl: (param: string) => `${STABLECOINS_SERVER_URL}/stablecoincharts2/${encodeURIComponent(param)}`,
		extractRows: (json) => {
			const points = recordArray(json, 'aggregated')
			return points
				.filter((point) => point.date != null)
				.map((point) => ({
					date: Number(point.date),
					totalCirculatingUSD: sumRecord(point.totalCirculatingUSD)
				}))
		}
	},

	{
		slug: 'cex-inflows-chart',
		name: 'CEX Inflows',
		description: 'Historical daily USD inflows/outflows for a specific centralized exchange',
		category: 'CEX',
		paramType: 'protocol',
		paramLabel: 'Exchange',
		optionsUrl: `${SERVER_URL}/cexs`,
		extractOptions: (json) => {
			const cexs = recordArray(json, 'cexs')
			return cexs
				.filter((cex) => stringValue(cex.slug))
				.sort((a, b) => (Number(b.currentTvl) || 0) - (Number(a.currentTvl) || 0))
				.map((cex) => ({ label: String(cex.name), value: toSlug(String(cex.slug)) }))
		},
		buildUrl: (param: string) => `${V2_SERVER_URL}/chart/tvl/protocol/${encodeURIComponent(param)}`,
		extractRows: (json) => {
			const pairs = extractTimestampValuePairs(json)
			if (pairs.length < 2) return []
			const rows: Array<Record<string, unknown>> = []
			for (let i = 1; i < pairs.length; i++) {
				const currentVal = pairs[i].value as number
				const prevVal = pairs[i - 1].value as number
				if (currentVal == null || prevVal == null || !Number.isFinite(currentVal) || !Number.isFinite(prevVal)) continue
				rows.push({
					date: pairs[i].date,
					inflow: currentVal - prevVal
				})
			}
			return rows
		}
	},

	{
		slug: 'protocol-tvl-chart',
		name: 'Protocol TVL',
		description: 'Historical TVL timeseries for a specific protocol',
		category: 'TVL',
		paramType: 'protocol',
		paramLabel: 'Protocol',
		optionsUrl: `${SERVER_URL}/lite/protocols2?zz=19`,
		extractOptions: extractLiteProtocolOptions,
		buildUrl: (param: string) => `${V2_SERVER_URL}/chart/tvl/protocol/${encodeURIComponent(param)}`,
		extractRows: extractTimestampValuePairs,
		categoryBreakdown: { kind: 'tvl' }
	},
	{
		slug: 'protocol-active-loans-chart',
		name: 'Protocol Active Loans',
		description: 'Historical active loans (borrowed) timeseries for a specific protocol',
		category: 'TVL',
		paramType: 'protocol',
		paramLabel: 'Protocol',
		optionsUrl: `${SERVER_URL}/lite/protocols2?zz=19`,
		extractOptions: extractActiveLoansProtocolOptions,
		buildUrl: (param: string) => `${V2_SERVER_URL}/chart/tvl/protocol/${encodeURIComponent(param)}?key=borrowed`,
		extractRows: extractTimestampValuePairs
	},
	{
		slug: 'chain-tvl-chart',
		name: 'Chain TVL',
		description: 'Historical TVL timeseries for a specific chain',
		category: 'TVL',
		paramType: 'chain',
		paramLabel: 'Chain',
		optionsUrl: `${V2_SERVER_URL}/chains`,
		extractOptions: (json) => {
			if (!Array.isArray(json)) return [{ label: 'All Chains', value: 'all' }]
			const chains = json.filter(isRecord)
			return [
				{ label: 'All Chains', value: 'all' },
				...chains
					.filter((chain) => stringValue(chain.name))
					.sort((a, b) => (Number(b.tvl) || 0) - (Number(a.tvl) || 0))
					.map((chain) => ({ label: String(chain.name), value: String(chain.name) }))
			]
		},
		buildUrl: (param: string) =>
			param === 'all' ? `${SERVER_URL}/lite/charts` : `${SERVER_URL}/lite/charts/${encodeURIComponent(param)}`,
		extractRows: extractLiteChartRows
	},
	{
		slug: 'category-tvl-chart',
		name: 'Category TVL',
		description: 'Historical TVL for a specific protocol category',
		category: 'TVL',
		paramType: 'protocol',
		paramLabel: 'Category',
		optionsUrl: `${SERVER_URL}/categories`,
		extractOptions: (json) => {
			const categories = recordValue(json, 'categories')
			if (!categories || typeof categories !== 'object') return []
			const keys = Array.isArray(categories)
				? categories.filter((category): category is string => typeof category === 'string')
				: Object.keys(categories)
			return keys
				.sort((a: string, b: string) => a.localeCompare(b))
				.map((c: string) => ({ label: c, value: toSlug(c) }))
		},
		buildUrl: (param: string) => `${SERVER_URL}/charts/categories/${encodeURIComponent(param)}`,
		extractRows: extractLiteChartRows
	},

	makeDimensionProtocolChart({
		slug: 'protocol-fees-chart',
		name: 'Protocol Fees',
		description: 'Historical daily fees for a specific protocol',
		category: 'Fees & Revenue',
		adapterType: 'fees'
	}),
	makeDimensionChainChart({
		slug: 'chain-fees-chart',
		name: 'Chain Fees',
		description: 'Historical daily fees for a specific chain',
		category: 'Fees & Revenue',
		adapterType: 'fees'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-revenue-chart',
		name: 'Protocol Revenue',
		description: 'Historical daily revenue for a specific protocol',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyRevenue'
	}),
	makeDimensionChainChart({
		slug: 'chain-revenue-chart',
		name: 'Chain Revenue',
		description: 'Historical daily revenue for a specific chain',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyRevenue'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-user-fees-chart',
		name: 'Protocol User Fees',
		description: 'Historical daily user fees for a specific protocol',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyUserFees'
	}),
	makeDimensionChainChart({
		slug: 'chain-user-fees-chart',
		name: 'Chain User Fees',
		description: 'Historical daily user fees for a specific chain',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyUserFees'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-holders-revenue-chart',
		name: 'Protocol Holders Revenue',
		description: 'Historical daily holders revenue for a specific protocol',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyHoldersRevenue'
	}),
	makeDimensionChainChart({
		slug: 'chain-holders-revenue-chart',
		name: 'Chain Holders Revenue',
		description: 'Historical daily holders revenue for a specific chain',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyHoldersRevenue'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-protocol-revenue-chart',
		name: 'Protocol Treasury Revenue',
		description: 'Historical daily protocol treasury revenue for a specific protocol',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyProtocolRevenue'
	}),
	makeDimensionChainChart({
		slug: 'chain-protocol-revenue-chart',
		name: 'Chain Treasury Revenue',
		description: 'Historical daily protocol treasury revenue for a specific chain',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyProtocolRevenue'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-supply-side-revenue-chart',
		name: 'Protocol Supply Side Revenue',
		description: 'Historical daily supply side revenue for a specific protocol',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailySupplySideRevenue'
	}),
	makeDimensionChainChart({
		slug: 'chain-supply-side-revenue-chart',
		name: 'Chain Supply Side Revenue',
		description: 'Historical daily supply side revenue for a specific chain',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailySupplySideRevenue'
	}),
	makeDimensionCategoryChart({
		slug: 'category-fees-chart',
		name: 'Category Fees',
		description: 'Historical daily fees for a specific protocol category',
		category: 'Fees & Revenue',
		adapterType: 'fees'
	}),
	makeDimensionCategoryChart({
		slug: 'category-revenue-chart',
		name: 'Category Revenue',
		description: 'Historical daily revenue for a specific protocol category',
		category: 'Fees & Revenue',
		adapterType: 'fees',
		dataType: 'dailyRevenue'
	}),

	makeDimensionProtocolChart({
		slug: 'protocol-dex-volume-chart',
		name: 'Protocol DEX Volume',
		description: 'Historical daily DEX trading volume for a specific protocol',
		category: 'Volume',
		adapterType: 'dexs'
	}),
	makeDimensionChainChart({
		slug: 'chain-dex-volume-chart',
		name: 'Chain DEX Volume',
		description: 'Historical daily DEX trading volume for a specific chain',
		category: 'Volume',
		adapterType: 'dexs'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-perps-volume-chart',
		name: 'Protocol Perps Volume',
		description: 'Historical daily perpetual derivatives volume for a specific protocol',
		category: 'Volume',
		adapterType: 'derivatives'
	}),
	makeDimensionChainChart({
		slug: 'chain-perps-volume-chart',
		name: 'Chain Perps Volume',
		description: 'Historical daily perpetual derivatives volume for a specific chain',
		category: 'Volume',
		adapterType: 'derivatives'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-options-premium-chart',
		name: 'Protocol Options Premium Volume',
		description: 'Historical daily options premium volume for a specific protocol',
		category: 'Volume',
		adapterType: 'options',
		dataType: 'dailyPremiumVolume'
	}),
	makeDimensionChainChart({
		slug: 'chain-options-premium-chart',
		name: 'Chain Options Premium Volume',
		description: 'Historical daily options premium volume for a specific chain',
		category: 'Volume',
		adapterType: 'options',
		dataType: 'dailyPremiumVolume'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-aggregator-volume-chart',
		name: 'Protocol Aggregator Volume',
		description: 'Historical daily DEX aggregator volume for a specific protocol',
		category: 'Volume',
		adapterType: 'aggregators'
	}),
	makeDimensionChainChart({
		slug: 'chain-aggregator-volume-chart',
		name: 'Chain Aggregator Volume',
		description: 'Historical daily DEX aggregator volume for a specific chain',
		category: 'Volume',
		adapterType: 'aggregators'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-options-notional-chart',
		name: 'Protocol Options Notional Volume',
		description: 'Historical daily options notional volume for a specific protocol',
		category: 'Volume',
		adapterType: 'options',
		dataType: 'dailyNotionalVolume'
	}),
	makeDimensionChainChart({
		slug: 'chain-options-notional-chart',
		name: 'Chain Options Notional Volume',
		description: 'Historical daily options notional volume for a specific chain',
		category: 'Volume',
		adapterType: 'options',
		dataType: 'dailyNotionalVolume'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-open-interest-chart',
		name: 'Protocol Open Interest',
		description: 'Historical open interest for a specific protocol',
		category: 'Volume',
		adapterType: 'open-interest',
		dataType: 'openInterestAtEnd'
	}),
	makeDimensionChainChart({
		slug: 'chain-open-interest-chart',
		name: 'Chain Open Interest',
		description: 'Historical open interest for a specific chain',
		category: 'Volume',
		adapterType: 'open-interest',
		dataType: 'openInterestAtEnd'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-perps-aggregator-volume-chart',
		name: 'Protocol Perps Aggregator Volume',
		description: 'Historical daily perps aggregator volume for a specific protocol',
		category: 'Volume',
		adapterType: 'aggregator-derivatives'
	}),
	makeDimensionChainChart({
		slug: 'chain-perps-aggregator-volume-chart',
		name: 'Chain Perps Aggregator Volume',
		description: 'Historical daily perps aggregator volume for a specific chain',
		category: 'Volume',
		adapterType: 'aggregator-derivatives'
	}),
	makeDimensionProtocolChart({
		slug: 'protocol-bridge-aggregator-volume-chart',
		name: 'Protocol Bridge Aggregator Volume',
		description: 'Historical daily bridge aggregator volume for a specific protocol',
		category: 'Volume',
		adapterType: 'bridge-aggregators'
	}),
	makeDimensionChainChart({
		slug: 'chain-bridge-aggregator-volume-chart',
		name: 'Chain Bridge Aggregator Volume',
		description: 'Historical daily bridge aggregator volume for a specific chain',
		category: 'Volume',
		adapterType: 'bridge-aggregators'
	}),
	makeDimensionCategoryChart({
		slug: 'category-dex-volume-chart',
		name: 'Category DEX Volume',
		description: 'Historical daily DEX trading volume for a specific protocol category',
		category: 'Volume',
		adapterType: 'dexs'
	}),
	makeDimensionCategoryChart({
		slug: 'category-perps-volume-chart',
		name: 'Category Perps Volume',
		description: 'Historical daily perpetual derivatives volume for a specific protocol category',
		category: 'Volume',
		adapterType: 'derivatives'
	}),

	{
		slug: 'chain-bridge-volume-chart',
		name: 'Chain Bridge Volume',
		description: 'Historical bridge deposit/withdrawal volume for a specific chain',
		category: 'Bridges',
		paramType: 'chain',
		paramLabel: 'Chain',
		optionsUrl: `${BRIDGES_SERVER_URL}/bridges?includeChains=true`,
		extractOptions: (json) => {
			const chains = recordArray(json, 'chains')
			return chains
				.filter((chain) => stringValue(chain.name))
				.sort((a, b) => (Number(b.lastDailyVolume) || 0) - (Number(a.lastDailyVolume) || 0))
				.map((chain) => ({ label: String(chain.name), value: String(chain.name) }))
		},
		buildUrl: (param: string) => `${BRIDGES_SERVER_URL}/bridgevolume/${encodeURIComponent(param)}`,
		extractRows: extractBridgeVolumeRows
	},

	{
		slug: 'yield-pool-chart',
		name: 'Yield Pool History',
		description: 'V2 supply APY components and TVL history for a specific earn pool',
		category: 'Yields',
		paramType: 'protocol',
		paramLabel: 'Pool',
		optionsUrl: `${YIELDS_V2_SERVER_URL}/v2/earn`,
		extractOptions: (json) => {
			const pools = (json as { data?: EarnRow[] }).data ?? []
			return pools
				.filter((pool) => pool.display.label)
				.sort((a, b) => (b.tvl_usd ?? 0) - (a.tvl_usd ?? 0))
				.map((pool) => ({
					label: `${pool.protocol} - ${pool.display.label} (${pool.chain})`,
					value: pool.id
				}))
		},
		buildUrl: (param: string) => `${YIELDS_V2_SERVER_URL}/v2/earn/${encodeURIComponent(param)}/history?range=max`,
		extractRows: () => [],
		customFetch: (param: string) => fetchPoolDetailHistory(param, 'max').then(extractYieldsV2HistoryRows)
	},

	{
		slug: 'oracle-tvs-chart',
		name: 'Oracle TVS',
		description: 'Historical Total Value Secured for a specific oracle provider',
		category: 'Oracles',
		paramType: 'protocol',
		paramLabel: 'Oracle',
		optionsUrl: `${V2_SERVER_URL}/metrics/oracle`,
		extractOptions: (json) => {
			const value = recordValue(json, 'oraclesTVS')
			const tvs = isRecord(value) ? value : {}
			return Object.entries(tvs)
				.sort(([, a], [, b]) => (Number(b) || 0) - (Number(a) || 0))
				.map(([name]) => ({ label: name, value: toSlug(name) }))
		},
		buildUrl: (param: string) => `${V2_SERVER_URL}/chart/oracle/protocol/${encodeURIComponent(param)}`,
		extractRows: extractTimestampValuePairs
	}
]

export const chartDatasetsBySlug = new Map(chartDatasets.map((d) => [d.slug, d]))

export const chartDatasetCategories = [...new Set(chartDatasets.map((d) => d.category))]

export type ChartOptionsMap = Record<
	string,
	Array<{ label: string; value: string; category?: string; isChild?: boolean }>
>

export async function fetchAllChartOptions(): Promise<ChartOptionsMap> {
	const urlToDatasets = new Map<string, ChartDatasetDefinition[]>()
	for (const dataset of chartDatasets) {
		const existing = urlToDatasets.get(dataset.optionsUrl) ?? []
		existing.push(dataset)
		urlToDatasets.set(dataset.optionsUrl, existing)
	}

	const result: ChartOptionsMap = {}

	await Promise.all(
		[...urlToDatasets.entries()].map(async ([url, datasets]) => {
			try {
				const response = await fetchWithPoolingOnServer(url)
				if (!response.ok) {
					for (const ds of datasets) result[ds.slug] = []
					return
				}
				const json = await response.json()
				for (const ds of datasets) {
					try {
						result[ds.slug] = ds.extractOptions(json)
					} catch {
						result[ds.slug] = []
					}
				}
			} catch {
				for (const ds of datasets) result[ds.slug] = []
			}
		})
	)

	return result
}
