import { fetchCoinGeckoTokensListFromDataset } from '~/api/coingecko'
import type { IResponseCGMarketsAPI } from '~/api/coingecko.types'
import { fetchCoinPrices } from '~/api/pricing'
import { CHART_COLORS } from '~/constants/colors'
import { fetchChainChart, fetchChainsByCategory } from '~/containers/Chains/api'
import { fetchRaises } from '~/containers/Raises/api'
import type { RaisesSummary } from '~/containers/Raises/summary'
import type { ProtocolEmissionSupplyMetricsMap } from '~/containers/Unlocks/api.types'
import { getPercentChange, slug } from '~/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { roundNumber } from '~/utils/numberFormat'
import { recordRuntimeError } from '~/utils/telemetry'
import { getPrevTvlFromChart } from '~/utils/tvlChart'
import { AIRDROP_EXCLUDE } from './airdrop-exclude'
import { fetchProtocols } from './api'
import {
	isProtocolListTvlKey,
	type ParentProtocolLite,
	type ProtocolListAdditiveTvlKey,
	type ProtocolLite,
	type ProtocolLiteTvlEntry
} from './api.types'
import type {
	ExtraTvlMetric,
	IExtraTvlByChainPageData,
	IExtraTvlProtocolRow,
	IProtocolsWithTokensByChainPageData,
	IRecentProtocol,
	IRecentProtocolsPageData,
	ITokenMetricProtocolRow
} from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortCategoriesByTvl(categoryTvlMap: Map<string, number>): Array<string> {
	return Array.from(categoryTvlMap.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([category]) => category)
}

function extractExtraTvl(protocol: ProtocolLite): Partial<Record<ProtocolListAdditiveTvlKey, ProtocolLiteTvlEntry>> {
	const extraTvl: Partial<Record<ProtocolListAdditiveTvlKey, ProtocolLiteTvlEntry>> = {}
	for (const sectionName in protocol.chainTvls) {
		if (isProtocolListTvlKey(sectionName)) {
			const section = protocol.chainTvls[sectionName]
			if (section !== undefined) extraTvl[sectionName] = section
		}
	}
	return extraTvl
}

// ---------------------------------------------------------------------------
// Query 1: RecentProtocols / Airdrops
// ---------------------------------------------------------------------------

export async function getRecentProtocols(): Promise<IRecentProtocolsPageData> {
	const { protocols, chains } = await fetchProtocols()

	const recentProtocols: Array<IRecentProtocol> = []
	const forkedList: Record<string, boolean> = {}
	const categoryTvlMap = new Map<string, number>()

	for (const protocol of protocols) {
		if (protocol.listedAt == null) continue

		const isForkedProtocol = (protocol.forkedFrom?.length ?? 0) > 0
		if (isForkedProtocol) {
			forkedList[protocol.name] = true
		}

		if (protocol.category) {
			categoryTvlMap.set(protocol.category, (categoryTvlMap.get(protocol.category) ?? 0) + (protocol.tvl ?? 0))
		}

		recentProtocols.push({
			name: protocol.name,
			symbol: protocol.symbol,
			logo: protocol.logo,
			url: protocol.url,
			category: protocol.category,
			chains: protocol.chains,
			chainTvls: protocol.chainTvls,
			tvl: protocol.tvl,
			tvlPrevDay: protocol.tvlPrevDay,
			tvlPrevWeek: protocol.tvlPrevWeek,
			tvlPrevMonth: protocol.tvlPrevMonth,
			mcap: protocol.mcap,
			listedAt: protocol.listedAt,
			defillamaId: protocol.defillamaId,
			...(protocol.deprecated !== undefined ? { deprecated: protocol.deprecated } : {}),
			...(isForkedProtocol ? { forkedFrom: protocol.forkedFrom } : {}),
			extraTvl: extractExtraTvl(protocol)
		})
	}

	recentProtocols.sort((a, b) => b.listedAt - a.listedAt)

	return {
		protocols: recentProtocols,
		chainList: chains,
		categories: sortCategoriesByTvl(categoryTvlMap),
		forkedList
	}
}

export async function getAirdropsProtocols(): Promise<IRecentProtocolsPageData> {
	const [{ protocols, chains, parentProtocols }, { raises }] = await Promise.all([fetchProtocols(), fetchRaises()])

	const parents: Record<string, boolean> = {}
	for (const p of parentProtocols) {
		if (p.gecko_id) {
			parents[p.id] = true
		}
	}

	const raisesById = new Map<string, RaisesSummary>()
	for (const r of raises) {
		if (r.defillamaId) {
			let summary = raisesById.get(r.defillamaId)
			if (!summary) {
				summary = { totalUsd: null, undisclosedCount: 0 }
				raisesById.set(r.defillamaId, summary)
			}
			if (r.amountUsd === null) summary.undisclosedCount++
			else summary.totalUsd = (summary.totalUsd ?? 0) + r.amountUsd
		}
	}

	const airdropsProtocols: Array<IRecentProtocol> = []
	const forkedList: Record<string, boolean> = {}
	const categoryTvlMap = new Map<string, number>()

	for (const protocol of protocols) {
		if (protocol.symbol !== '-') continue
		if (AIRDROP_EXCLUDE.has(protocol.name)) continue
		if (protocol.parentProtocol != null && parents[protocol.parentProtocol]) continue

		const isForkedProtocol = (protocol.forkedFrom?.length ?? 0) > 0
		if (isForkedProtocol) {
			forkedList[protocol.name] = true
		}

		if (protocol.category) {
			categoryTvlMap.set(protocol.category, (categoryTvlMap.get(protocol.category) ?? 0) + (protocol.tvl ?? 0))
		}
		const raiseSummary = raisesById.get(protocol.defillamaId)

		airdropsProtocols.push({
			name: protocol.name,
			symbol: protocol.symbol,
			logo: protocol.logo,
			url: protocol.url,
			category: protocol.category,
			chains: protocol.chains,
			chainTvls: protocol.chainTvls,
			tvl: protocol.tvl,
			tvlPrevDay: protocol.tvlPrevDay,
			tvlPrevWeek: protocol.tvlPrevWeek,
			tvlPrevMonth: protocol.tvlPrevMonth,
			mcap: protocol.mcap,
			listedAt: protocol.listedAt ?? 1_624_728_920,
			defillamaId: protocol.defillamaId,
			...(protocol.deprecated !== undefined ? { deprecated: protocol.deprecated } : {}),
			...(isForkedProtocol ? { forkedFrom: protocol.forkedFrom } : {}),
			extraTvl: extractExtraTvl(protocol),
			...(raiseSummary ? { raiseSummary } : {})
		})
	}

	airdropsProtocols.sort((a, b) => a.listedAt - b.listedAt)

	return {
		protocols: airdropsProtocols,
		chainList: chains,
		categories: sortCategoriesByTvl(categoryTvlMap),
		forkedList
	}
}

// ---------------------------------------------------------------------------
// Query 2: ExtraTvl (total-borrowed, total-staked, pool2)
// ---------------------------------------------------------------------------

interface ExtraTvlMetricConfig {
	chartKey: ExtraTvlChartKey
	suffix: string
	label: string
	basePath: string
}
type ExtraTvlChartKey = 'borrowed' | 'staking' | 'pool2'

const EXTRA_TVL_CONFIG: Record<ExtraTvlMetric, ExtraTvlMetricConfig> = {
	borrowed: { chartKey: 'borrowed', suffix: '-borrowed', label: 'Active Loans', basePath: '/active-loans' },
	staking: { chartKey: 'staking', suffix: '-staking', label: 'Total Staked', basePath: '/total-staked' },
	pool2: { chartKey: 'pool2', suffix: '-pool2', label: 'Pool2 TVL', basePath: '/pool2' }
}

export async function getExtraTvlByChain({
	chain,
	metric,
	protocolMetadata
}: {
	chain: string
	metric: ExtraTvlMetric
	protocolMetadata: Record<string, IProtocolMetadata>
}): Promise<IExtraTvlByChainPageData | null> {
	const config = EXTRA_TVL_CONFIG[metric]

	const [{ protocols, parentProtocols }, chart, chainsList]: [
		{ protocols: Array<ProtocolLite>; parentProtocols: Array<ParentProtocolLite> },
		Array<[number, number]> | null,
		Array<string>
	] = await Promise.all([
		fetchProtocols(),
		fetchChainChart(chain)
			.then((data) => data?.[config.chartKey]?.map((item): [number, number] => [+item[0] * 1e3, item[1]]) ?? [])
			.catch((error) => {
				recordRuntimeError(error, 'pageBuild', {
					event: 'extraTvlByChain',
					status: 'chart-failed',
					chain,
					metric,
					label: config.label
				})
				return null
			}),
		fetchChainsByCategory('All')
			.then((data) =>
				(data?.chainTvls ?? []).flatMap((chainData) =>
					chainData.extraTvl?.[config.chartKey] !== undefined ? [chainData.name] : []
				)
			)
			.catch((error) => {
				recordRuntimeError(error, 'pageBuild', {
					event: 'extraTvlByChain',
					status: 'chains-list-failed',
					chain,
					metric,
					label: config.label
				})
				return []
			})
	])

	if (!chart || chart.length === 0) return null

	const finalProtocols: Array<IExtraTvlProtocolRow> = []
	const parentChildren: Record<string, Array<{ row: IExtraTvlProtocolRow; prevMonthValue: number | null }>> = {}
	const parentProtocolsMap = new Map(parentProtocols.map((parentProtocol) => [parentProtocol.id, parentProtocol]))

	for (const protocol of protocols) {
		let totalValue: number | null = 0
		let totalPrevMonth: number | null = 0
		let hasMetricValue = false

		for (const ctvl in protocol.chainTvls) {
			const isMetricSection = ctvl.endsWith(config.suffix)
			const matchesChain = chain === 'All' || ctvl === `${chain}${config.suffix}`
			if (isMetricSection && matchesChain) {
				const chainTvl = protocol.chainTvls[ctvl]
				if (chainTvl === undefined) continue
				hasMetricValue = true
				totalValue = totalValue == null || chainTvl.tvl == null ? null : totalValue + chainTvl.tvl
				totalPrevMonth =
					totalPrevMonth == null || chainTvl.tvlPrevMonth == null ? null : totalPrevMonth + chainTvl.tvlPrevMonth
			}
		}

		if (!hasMetricValue) continue

		const pct = totalPrevMonth != null ? getPercentChange(totalValue, totalPrevMonth) : null

		const p: IExtraTvlProtocolRow = {
			name: protocol.name,
			logo: protocol.logo,
			slug: slug(protocol.name),
			category: protocol.category,
			chains: protocolMetadata[protocol.defillamaId]?.chains ?? protocol.chains,
			...(protocol.deprecated ? { deprecated: true } : {}),
			value: totalValue,
			change_1m: pct != null ? roundNumber(pct, 2) : null
		}

		if (protocol.parentProtocol) {
			const children = parentChildren[protocol.parentProtocol] ?? (parentChildren[protocol.parentProtocol] = [])
			children.push({ row: p, prevMonthValue: totalPrevMonth })
		} else {
			finalProtocols.push(p)
		}
	}

	for (const parentId in parentChildren) {
		const parent = parentProtocolsMap.get(parentId)
		const childrenWithPrevMonth = parentChildren[parentId]
		if (childrenWithPrevMonth === undefined) continue
		if (!parent || childrenWithPrevMonth.length <= 1) {
			for (const child of childrenWithPrevMonth) finalProtocols.push(child.row)
			continue
		}
		const children: Array<IExtraTvlProtocolRow> = []
		let totalValue: number | null = 0
		let totalPrevMonth: number | null = 0
		const categorySet = new Set<string>()
		const chainSet = new Set<string>()
		for (const { row, prevMonthValue } of childrenWithPrevMonth) {
			children.push(row)
			totalValue = totalValue == null || row.value == null ? null : totalValue + row.value
			totalPrevMonth = totalPrevMonth == null || prevMonthValue == null ? null : totalPrevMonth + prevMonthValue
			if (row.category) categorySet.add(row.category)
			for (const childChain of row.chains) chainSet.add(childChain)
		}
		const categories = Array.from(categorySet)
		const pct = totalPrevMonth != null ? getPercentChange(totalValue, totalPrevMonth) : null

		finalProtocols.push({
			name: parent.name,
			logo: parent.logo,
			slug: slug(parent.name),
			category: categories.length > 1 ? null : (categories[0] ?? null),
			chains: Array.from(chainSet),
			value: totalValue,
			change_1m: pct != null ? roundNumber(pct, 2) : null,
			subRows: children
		})
	}

	const latestChartPoint = chart.at(-1)
	if (latestChartPoint === undefined) return null
	const nowMs = Date.now()
	const totalValue = getPrevTvlFromChart(chart, 0, nowMs) ?? latestChartPoint[1]
	const previousDayValue = getPrevTvlFromChart(chart, 1, nowMs)
	const change24hPct = getPercentChange(totalValue, previousDayValue)
	const change24h = change24hPct == null || !Number.isFinite(change24hPct) ? null : roundNumber(change24hPct, 2)
	const chartColor = CHART_COLORS[0]

	return {
		protocols: finalProtocols.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
		chain,
		chains: [
			{ label: 'All', to: config.basePath },
			...chainsList.map((c) => ({ label: c, to: `${config.basePath}/chain/${slug(c)}` }))
		],
		dataset: {
			source: chart.map(([timestamp, value]) => [timestamp, value]),
			dimensions: ['timestamp', config.label]
		},
		charts: [
			{
				type: 'line' as const,
				name: config.label,
				encode: { x: 0, y: 1 },
				color: chartColor,
				stack: config.label
			}
		],
		totalValue,
		change24h,
		metric
	}
}

// ---------------------------------------------------------------------------
// Query 3: Token metrics (mcaps, fdv, token-prices, outstanding-fdv)
// ---------------------------------------------------------------------------

const TOKEN_METRIC_EXCLUDE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Foundation', 'Meme'])

function buildTokenMetricProtocols({
	protocols,
	parentProtocols,
	protocolMetadata,
	getValue,
	getParentValue
}: {
	protocols: Array<ProtocolLite>
	parentProtocols: Array<ParentProtocolLite>
	protocolMetadata: Record<string, IProtocolMetadata>
	getValue: (protocol: ProtocolLite) => number | null
	getParentValue: (parent: ParentProtocolLite) => number | null
}): { finalProtocols: Array<ITokenMetricProtocolRow> } {
	const parentProtocolsMap = new Map(parentProtocols.map((p) => [p.id, p]))
	const finalProtocols: Array<ITokenMetricProtocolRow> = []
	const parentChildren: Record<string, Array<ITokenMetricProtocolRow>> = {}

	for (const protocol of protocols) {
		if (TOKEN_METRIC_EXCLUDE_CATEGORIES.has(protocol.category ?? '')) continue

		const p: ITokenMetricProtocolRow = {
			name: protocol.name,
			logo: protocol.logo,
			slug: slug(protocol.name),
			category: protocol.category,
			chains: protocolMetadata[protocol.defillamaId]?.chains ?? protocol.chains,
			...(protocol.deprecated ? { deprecated: true } : {}),
			value: getValue(protocol)
		}

		if (protocol.parentProtocol) {
			const children = parentChildren[protocol.parentProtocol] ?? (parentChildren[protocol.parentProtocol] = [])
			children.push(p)
		} else {
			finalProtocols.push(p)
		}
	}

	for (const parentId in parentChildren) {
		const parent = parentProtocolsMap.get(parentId)
		const children = parentChildren[parentId]
		if (children === undefined) continue
		if (!parent || children.length <= 1) {
			finalProtocols.push(...children)
			continue
		}
		const categorySet = new Set<string>()
		const chainSet = new Set<string>()
		for (const child of children) {
			if (child.category) categorySet.add(child.category)
			for (const childChain of child.chains) chainSet.add(childChain)
		}
		const cats = Array.from(categorySet)

		finalProtocols.push({
			name: parent.name,
			logo: parent.logo,
			slug: slug(parent.name),
			category: cats.length > 1 ? null : (cats[0] ?? null),
			chains: Array.from(chainSet),
			subRows: children,
			value: getParentValue(parent)
		})
	}

	return { finalProtocols }
}

/** The categories of the rows a page lists, sorted, so every category option matches at least one row. */
function getRowCategories(rows: Array<ITokenMetricProtocolRow>): Array<string> {
	const categories = new Set<string>()
	for (const row of rows) {
		if (row.category) categories.add(row.category)
		for (const child of row.subRows ?? []) {
			if (child.category) categories.add(child.category)
		}
	}
	return Array.from(categories).sort()
}

function filterAndSort(protocols: Array<ITokenMetricProtocolRow>, chain: string): Array<ITokenMetricProtocolRow> {
	return protocols
		.filter((p) => p.value != null && (chain === 'All' || p.chains.includes(chain)))
		.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
}

function buildChainLinks(chains: Array<string>, basePath: string): Array<{ label: string; to: string }> {
	return [{ label: 'All', to: basePath }, ...chains.map((c) => ({ label: c, to: `${basePath}/chain/${slug(c)}` }))]
}

export async function getProtocolsMarketCapsByChain({
	chain,
	protocolMetadata
}: {
	chain: string
	protocolMetadata: Record<string, IProtocolMetadata>
}): Promise<IProtocolsWithTokensByChainPageData | null> {
	const { protocols, chains, parentProtocols } = await fetchProtocols()

	const { finalProtocols } = buildTokenMetricProtocols({
		protocols,
		parentProtocols,
		protocolMetadata,
		getValue: (p) => p.mcap ?? null,
		getParentValue: (p) => p.mcap ?? null
	})

	const rows = filterAndSort(finalProtocols, chain)

	return {
		protocols: rows,
		chain,
		chains: buildChainLinks(chains, '/mcaps'),
		categories: getRowCategories(rows),
		type: 'mcap'
	}
}

export async function getProtocolsFDVsByChain({
	chain,
	protocolMetadata
}: {
	chain: string
	protocolMetadata: Record<string, IProtocolMetadata>
}): Promise<IProtocolsWithTokensByChainPageData | null> {
	const [{ protocols, chains, parentProtocols }, tokenList]: [
		{ protocols: Array<ProtocolLite>; chains: Array<string>; parentProtocols: Array<ParentProtocolLite> },
		Array<IResponseCGMarketsAPI>
	] = await Promise.all([fetchProtocols(), fetchCoinGeckoTokensListFromDataset()])

	const tokenListMap = new Map(tokenList.map((t) => [t.id, t]))

	const { finalProtocols } = buildTokenMetricProtocols({
		protocols,
		parentProtocols,
		protocolMetadata,
		getValue: (p) => (p.geckoId ? (tokenListMap.get(p.geckoId)?.['fully_diluted_valuation'] ?? null) : null),
		getParentValue: (parent) =>
			parent.gecko_id ? (tokenListMap.get(parent.gecko_id)?.['fully_diluted_valuation'] ?? null) : null
	})

	const rows = filterAndSort(finalProtocols, chain)

	return {
		protocols: rows,
		chain,
		chains: buildChainLinks(chains, '/fdv'),
		categories: getRowCategories(rows),
		type: 'fdv'
	}
}

export async function getProtocolsTokenPricesByChain({
	chain,
	protocolMetadata
}: {
	chain: string
	protocolMetadata: Record<string, IProtocolMetadata>
}): Promise<IProtocolsWithTokensByChainPageData | null> {
	const { protocols, chains, parentProtocols } = await fetchProtocols()

	const geckoIds = new Set<string>()
	for (const protocol of protocols) {
		if (protocol.geckoId) geckoIds.add(`coingecko:${protocol.geckoId}`)
	}
	for (const parent of parentProtocols) {
		if (parent.gecko_id) geckoIds.add(`coingecko:${parent.gecko_id}`)
	}

	const prices = await fetchCoinPrices(Array.from(geckoIds))

	const { finalProtocols } = buildTokenMetricProtocols({
		protocols,
		parentProtocols,
		protocolMetadata,
		getValue: (p) => (p.geckoId ? (prices[`coingecko:${p.geckoId}`]?.price ?? null) : null),
		getParentValue: (parent) => (parent.gecko_id ? (prices[`coingecko:${parent.gecko_id}`]?.price ?? null) : null)
	})

	const rows = filterAndSort(finalProtocols, chain)

	return {
		protocols: rows,
		chain,
		chains: buildChainLinks(chains, '/token-prices'),
		categories: getRowCategories(rows),
		type: 'price'
	}
}

export async function getProtocolsAdjustedFDVsByChain({
	chain,
	protocolMetadata,
	emissionsSupplyMetrics
}: {
	chain: string
	protocolMetadata: Record<string, IProtocolMetadata>
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
}): Promise<IProtocolsWithTokensByChainPageData | null> {
	const { protocols, chains, parentProtocols } = await fetchProtocols()

	const emissionsSlugByName = new Map<string, string>()
	const emissionGeckoIds: Record<string, string> = {}
	for (const protocol of protocols) {
		const emissionSlug = slug(protocol.name)
		emissionsSlugByName.set(protocol.name, emissionSlug)
		if (emissionsSupplyMetrics[emissionSlug] && protocol.geckoId) {
			emissionGeckoIds[protocol.name] = `coingecko:${protocol.geckoId}`
		}
	}
	for (const parent of parentProtocols) {
		const emissionSlug = slug(parent.name)
		emissionsSlugByName.set(parent.name, emissionSlug)
		if (emissionsSupplyMetrics[emissionSlug] && parent.gecko_id) {
			emissionGeckoIds[parent.name] = `coingecko:${parent.gecko_id}`
		}
	}

	const prices = await fetchCoinPrices(Object.values(emissionGeckoIds))

	const chainsWithEmissions = new Set<string>()
	for (const protocol of protocols) {
		const emissionSlug = emissionsSlugByName.get(protocol.name) ?? slug(protocol.name)
		if (emissionsSupplyMetrics[emissionSlug]) {
			for (const c of protocol.chains) {
				chainsWithEmissions.add(c)
			}
		}
	}

	const getAdjustedFdv = (geckoId: string | null | undefined, name: string): number | null => {
		if (!geckoId) return null
		const slugName = emissionsSlugByName.get(name) ?? slug(name)
		const adjustedSupply = emissionsSupplyMetrics[slugName]?.supplyMetrics?.adjustedSupply
		const price = prices[`coingecko:${geckoId}`]?.price
		if (adjustedSupply != null && price != null) return price * adjustedSupply
		return null
	}

	const { finalProtocols } = buildTokenMetricProtocols({
		protocols,
		parentProtocols,
		protocolMetadata,
		getValue: (p) => getAdjustedFdv(p.geckoId, p.name),
		getParentValue: (parent) => getAdjustedFdv(parent.gecko_id, parent.name)
	})

	const rows = filterAndSort(finalProtocols, chain)

	return {
		protocols: rows,
		chain,
		chains: [
			{ label: 'All', to: '/outstanding-fdv' },
			...chains
				.filter((c) => chainsWithEmissions.has(c))
				.map((c) => ({ label: c, to: `/outstanding-fdv/chain/${slug(c)}` }))
		],
		categories: getRowCategories(rows),
		type: 'outstanding-fdv'
	}
}
