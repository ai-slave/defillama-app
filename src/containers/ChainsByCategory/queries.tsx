import { fetchAdapterChainProtocolTotals } from '~/containers/AdapterMetrics/api'
import type { AdapterChainProtocolTotalsResponse } from '~/containers/AdapterMetrics/api.types'
import { getDimensionAdapterOverviewOfAllChains } from '~/containers/AdapterMetrics/queries'
import { fetchChainsAssetTotals } from '~/containers/BridgedTVL/api'
import type { ChainsAssetTotalsResponse } from '~/containers/BridgedTVL/api.types'
import { fetchChainsByCategory } from '~/containers/Chains/api'
import type { ChainsByCategoryResponse } from '~/containers/Chains/api.types'
import { fetchStablecoinAssetsApi } from '~/containers/Stablecoins/api'
import { sumStablecoinPegBalances } from '~/containers/Stablecoins/utils'
import { TVL_SETTINGS_KEYS } from '~/contexts/LocalStorage'
import { getNDistinctColors, slug } from '~/utils'
import type { IChainMetadata } from '~/utils/metadata/types'
import { shouldSubtractTvlOverlapSeries } from '~/utils/tvlOverlap'
import { normalizeChainsBaseTvlValue, removeStaleChainExtraTvlEntries } from './tvl'
import type { IChainsByCategoryData } from './types'

const OVERLAP_TVL_KEYS = ['doublecounted', 'liquidstaking', 'dcAndLsOverlap'] as const

function getChainSnapshotOverlapValues(
	extraTvl: IChainsByCategoryData['chains'][number]['extraTvl'],
	metric: 'tvl' | 'tvlPrevDay' | 'tvlPrevWeek' | 'tvlPrevMonth'
) {
	const values: Partial<Record<(typeof OVERLAP_TVL_KEYS)[number], number | null>> = {}
	for (const key of OVERLAP_TVL_KEYS) {
		if (!Object.hasOwn(extraTvl, key)) continue
		values[key] = extraTvl[key]?.[metric] ?? null
	}
	return values
}

function getChainChartOverlapValues(chainTvls: Record<string, number>, tvlTypes: ChainsByCategoryResponse['tvlTypes']) {
	const values: Partial<Record<(typeof OVERLAP_TVL_KEYS)[number], number>> = {}
	for (const key of OVERLAP_TVL_KEYS) {
		const compactKey = tvlTypes[key]
		if (compactKey == null) continue
		const value = chainTvls[compactKey]
		if (value !== undefined) values[key] = value
	}
	return values
}

type IChainsByCategoryChartData = Pick<IChainsByCategoryData, 'tvlChartsByChain' | 'totalTvlByDate'>

function buildChainsByCategoryChartData({
	stackedDataset,
	tvlTypes,
	sampledChart,
	extraTvlTypes
}: {
	stackedDataset: ChainsByCategoryResponse['stackedDataset']
	tvlTypes: ChainsByCategoryResponse['tvlTypes']
	sampledChart: boolean | undefined
	extraTvlTypes: ReadonlyArray<string>
}): IChainsByCategoryChartData {
	let chartDataset = stackedDataset
	if (sampledChart) {
		const sampledData: ChainsByCategoryResponse['stackedDataset'] = []
		const dataLength = stackedDataset.length
		for (let i = 0; i < stackedDataset.length; i++) {
			const row = stackedDataset[i]
			if (row === undefined) continue
			if (i % 2 === 0 || i === dataLength - 1) {
				sampledData.push(row)
			}
		}
		chartDataset = sampledData
	}

	const tvlChartsByChain: Record<string, Record<string, Record<number, number>>> = {}
	const totalTvlByDate: Record<string, Record<number, number>> = {}
	const keysToNames: Record<string, string> = {}
	for (const key in tvlTypes) {
		const compactKey = tvlTypes[key]
		if (compactKey != null) keysToNames[compactKey] = key
	}
	const includedTvlTypes = new Set(['tvl'])
	for (const key of extraTvlTypes) {
		if (tvlTypes[key] !== undefined) {
			includedTvlTypes.add(key)
		}
	}
	if (shouldSubtractTvlOverlapSeries(includedTvlTypes) && tvlTypes.dcAndLsOverlap !== undefined) {
		includedTvlTypes.add('dcAndLsOverlap')
	}

	for (const [date, tvls] of chartDataset) {
		for (const chain in tvls) {
			const chainTvls = tvls[chain]
			if (chainTvls === undefined) continue
			for (const key in chainTvls) {
				const rawValue = chainTvls[key]
				if (rawValue === undefined) continue
				const keyName = keysToNames[key]
				if (!keyName || !includedTvlTypes.has(keyName)) continue

				// Match /chain/:chain base TVL: subtract current doublecounted and liquid staking, then add overlap back.
				const value =
					keyName === 'tvl'
						? normalizeChainsBaseTvlValue(rawValue, getChainChartOverlapValues(chainTvls, tvlTypes))
						: rawValue
				const timestamp = +date * 1e3
				const existingChartsByChain = tvlChartsByChain[keyName]
				const chartsByChain: Record<string, Record<number, number>> = existingChartsByChain ?? {}
				if (!existingChartsByChain) tvlChartsByChain[keyName] = chartsByChain
				const existingChainChart = chartsByChain[chain]
				const chainChart: Record<number, number> = existingChainChart ?? {}
				if (!existingChainChart) chartsByChain[chain] = chainChart
				chainChart[timestamp] = value

				const existingTotalChart = totalTvlByDate[keyName]
				const totalChart: Record<number, number> = existingTotalChart ?? {}
				if (!existingTotalChart) totalTvlByDate[keyName] = totalChart
				totalChart[timestamp] = (totalChart[timestamp] ?? 0) + value
			}
		}
	}

	return { tvlChartsByChain, totalTvlByDate }
}

function buildChainsLatestTvlTimestamps({
	stackedDataset,
	tvlTypes
}: {
	stackedDataset: ChainsByCategoryResponse['stackedDataset']
	tvlTypes: ChainsByCategoryResponse['tvlTypes']
}): IChainsByCategoryChartData['tvlChartsByChain'] {
	const keysToNames: Record<string, string> = {}
	for (const key in tvlTypes) {
		const compactKey = tvlTypes[key]
		if (compactKey != null) keysToNames[compactKey] = key
	}

	const latestTimestamps: Record<string, Record<string, number>> = {}
	for (const [date, tvls] of stackedDataset) {
		const timestamp = +date * 1e3
		for (const chain in tvls) {
			const chainTvls = tvls[chain]
			if (chainTvls === undefined) continue
			for (const key in chainTvls) {
				const keyName = keysToNames[key]
				if (!keyName) continue

				const existingTimestampsByChain = latestTimestamps[keyName]
				const timestampsByChain: Record<string, number> = existingTimestampsByChain ?? {}
				if (!existingTimestampsByChain) latestTimestamps[keyName] = timestampsByChain
				const latestTimestamp = timestampsByChain[chain]
				if (latestTimestamp == null || timestamp > latestTimestamp) {
					timestampsByChain[chain] = timestamp
				}
			}
		}
	}

	const tvlChartsByChain: IChainsByCategoryChartData['tvlChartsByChain'] = {}
	for (const key in latestTimestamps) {
		const timestampsByChain = latestTimestamps[key]
		if (timestampsByChain === undefined) continue
		const chartsByChain: Record<string, Record<number, number>> = {}
		tvlChartsByChain[key] = chartsByChain
		for (const chain in timestampsByChain) {
			const timestamp = timestampsByChain[chain]
			if (timestamp === undefined) continue
			chartsByChain[chain] = { [timestamp]: 1 }
		}
	}

	return tvlChartsByChain
}

export async function getChainsByCategoryChartData({
	category,
	sampledChart,
	extraTvlTypes
}: {
	category: string
	sampledChart?: boolean
	extraTvlTypes?: ReadonlyArray<string>
}): Promise<IChainsByCategoryChartData> {
	const { stackedDataset, tvlTypes } = await fetchChainsByCategory(category)
	return buildChainsByCategoryChartData({
		stackedDataset,
		tvlTypes,
		sampledChart,
		extraTvlTypes: extraTvlTypes ?? []
	})
}

async function fetchOptionalAdapterChainProtocolTotals(
	options: Parameters<typeof fetchAdapterChainProtocolTotals>[0]
): Promise<AdapterChainProtocolTotalsResponse | null> {
	try {
		return await fetchAdapterChainProtocolTotals(options)
	} catch (error) {
		console.log(error)
		return null
	}
}

async function fetchOptionalChainAssetTotals(): Promise<ChainsAssetTotalsResponse> {
	try {
		return await fetchChainsAssetTotals()
	} catch (error) {
		console.log(error)
		return {}
	}
}

export const getChainsByCategory = async ({
	chainMetadata,
	category,
	sampledChart,
	includeChartData = true
}: {
	chainMetadata: Record<string, IChainMetadata>
	category: string
	sampledChart?: boolean
	includeChartData?: boolean
}): Promise<IChainsByCategoryData> => {
	const [
		{ categories, chainTvls, ...rest },
		dexs,
		fees,
		revenue,
		stablecoins,
		activeUsers,
		chainsAssets,
		chainNftsVolume,
		appRevenue
	] = await Promise.all([
		fetchChainsByCategory(category),
		getDimensionAdapterOverviewOfAllChains({ adapterType: 'dexs', dataType: 'dailyVolume', chainMetadata }),
		fetchOptionalAdapterChainProtocolTotals({
			adapterType: 'fees',
			chain: 'All'
		}),
		fetchOptionalAdapterChainProtocolTotals({
			adapterType: 'fees',
			chain: 'All',
			dataType: 'dailyRevenue'
		}),
		fetchStablecoinAssetsApi(),
		fetchOptionalAdapterChainProtocolTotals({
			adapterType: 'active-users',
			chain: 'All',
			dataType: 'dailyActiveUsers'
		}),
		fetchOptionalChainAssetTotals(),
		fetchOptionalAdapterChainProtocolTotals({
			adapterType: 'nft-volume',
			chain: 'All',
			dataType: 'dailyVolume'
		}),
		getDimensionAdapterOverviewOfAllChains({ adapterType: 'fees', dataType: 'dailyAppRevenue', chainMetadata })
	])

	const categoryLinks = [
		{ label: 'All', to: '/chains' },
		{ label: 'Non-EVM', to: '/chains/non-evm' }
	].concat(
		categories.map((cat) => ({
			label: cat,
			to: `/chains/${slug(cat)}`
		}))
	)

	// Find categoryName by matching slugified category against categories
	let categoryName: string
	if (category === 'all') {
		categoryName = 'All'
	} else if (category === 'non-evm') {
		categoryName = 'Non-EVM'
	} else {
		categoryName = categories.find((cat) => slug(cat) === category) || category
	}

	const allColors = getNDistinctColors(rest.chainsUnique.length)
	const colorsByChain: Record<string, string> = {}

	for (let index = 0; index < rest.chainsUnique.length; index++) {
		const chain = rest.chainsUnique[index]
		if (chain === undefined) continue
		const color = allColors[index]
		if (color == null) throw new Error(`Missing chart color for chain ${chain}`)
		colorsByChain[chain] = color
	}

	colorsByChain['Others'] = '#AAAAAA'

	const stablesChainMcapMap = new Map<string, number>()
	for (const chain of stablecoins.chains) {
		const key = slug(chain.name)
		if (stablesChainMcapMap.has(key)) continue
		stablesChainMcapMap.set(key, sumStablecoinPegBalances(chain.totalCirculatingUSD))
	}

	type AdapterProtocol = AdapterChainProtocolTotalsResponse['protocols'][number]
	const feesByDisplayName = new Map<string, AdapterProtocol>()
	for (const protocol of fees?.protocols ?? []) {
		if (!feesByDisplayName.has(protocol.displayName)) feesByDisplayName.set(protocol.displayName, protocol)
	}

	const revenueByDisplayName = new Map<string, AdapterProtocol>()
	for (const protocol of revenue?.protocols ?? []) {
		if (!revenueByDisplayName.has(protocol.displayName)) revenueByDisplayName.set(protocol.displayName, protocol)
	}

	const nftVolumeByDisplayName = new Map<string, AdapterProtocol>()
	for (const protocol of chainNftsVolume?.protocols ?? []) {
		if (!nftVolumeByDisplayName.has(protocol.displayName)) nftVolumeByDisplayName.set(protocol.displayName, protocol)
	}

	const activeUsersByDisplayName = new Map<string, AdapterProtocol>()
	for (const protocol of activeUsers?.protocols ?? []) {
		if (!protocol.defillamaId.startsWith('chain#')) continue
		if (!activeUsersByDisplayName.has(protocol.displayName)) {
			activeUsersByDisplayName.set(protocol.displayName, protocol)
		}
	}

	const { tvlChartsByChain, totalTvlByDate } = includeChartData
		? buildChainsByCategoryChartData({
				stackedDataset: rest.stackedDataset,
				tvlTypes: rest.tvlTypes,
				sampledChart,
				extraTvlTypes: TVL_SETTINGS_KEYS
			})
		: ({ tvlChartsByChain: {}, totalTvlByDate: {} } satisfies IChainsByCategoryChartData)
	const staleExtraTvlCleanupCharts = includeChartData
		? tvlChartsByChain
		: buildChainsLatestTvlTimestamps({
				stackedDataset: rest.stackedDataset,
				tvlTypes: rest.tvlTypes
			})

	return {
		tvlChartsByChain,
		totalTvlByDate,
		category,
		categoryName,
		allCategories: categoryLinks,
		colorsByChain,
		chains: chainTvls
			.map((chain) => {
				const name = slug(chain.name)
				const extraTvl = removeStaleChainExtraTvlEntries({
					chainName: chain.name,
					extraTvl: chain.extraTvl,
					tvlChartsByChain: staleExtraTvlCleanupCharts
				})

				const chainFees = feesByDisplayName.get(chain.name)
				const fees24h = fees === null ? null : (chainFees?.total24h ?? 0)
				const fees7d = fees === null ? null : (chainFees?.total7d ?? 0)
				const fees30d = fees === null ? null : (chainFees?.total30d ?? 0)

				const chainRevenue = revenueByDisplayName.get(chain.name)
				const revenue24h = revenue === null ? null : (chainRevenue?.total24h ?? 0)
				const revenue7d = revenue === null ? null : (chainRevenue?.total7d ?? 0)
				const revenue30d = revenue === null ? null : (chainRevenue?.total30d ?? 0)

				const appRevenue24h = appRevenue[chain.name]?.['24h'] ?? 0
				const appRevenue7d = appRevenue[chain.name]?.['7d'] ?? 0
				const appRevenue30d = appRevenue[chain.name]?.['30d'] ?? 0

				const dexVolume24h = dexs[chain.name]?.['24h'] ?? 0
				const dexVolume7d = dexs[chain.name]?.['7d'] ?? 0
				const dexVolume30d = dexs[chain.name]?.['30d'] ?? 0

				const stablesMcap = stablesChainMcapMap.get(name) ?? 0

				const chainActiveUsers = activeUsersByDisplayName.get(chain.name)
				const activeUsers24h = activeUsers === null ? null : (chainActiveUsers?.total24h ?? 0)
				const activeUsers7d = activeUsers === null ? null : (chainActiveUsers?.total7d ?? 0)
				const activeUsers30d = activeUsers === null ? null : (chainActiveUsers?.total30d ?? 0)

				const currentChainMetadata = chainMetadata[name]
				const protocols = currentChainMetadata?.protocolCount ?? chain.protocols ?? null

				const tvl = normalizeChainsBaseTvlValue(chain.tvl, getChainSnapshotOverlapValues(extraTvl, 'tvl'))
				const tvlPrevDay = normalizeChainsBaseTvlValue(
					chain.tvlPrevDay,
					getChainSnapshotOverlapValues(extraTvl, 'tvlPrevDay')
				)
				const tvlPrevWeek = normalizeChainsBaseTvlValue(
					chain.tvlPrevWeek,
					getChainSnapshotOverlapValues(extraTvl, 'tvlPrevWeek')
				)
				const tvlPrevMonth = normalizeChainsBaseTvlValue(
					chain.tvlPrevMonth,
					getChainSnapshotOverlapValues(extraTvl, 'tvlPrevMonth')
				)

				const chainNftVolume = nftVolumeByDisplayName.get(chain.name)
				const nftVolume24h = chainNftsVolume === null ? null : (chainNftVolume?.total24h ?? 0)
				const nftVolume7d = chainNftsVolume === null ? null : (chainNftVolume?.total7d ?? 0)
				const nftVolume30d = chainNftsVolume === null ? null : (chainNftVolume?.total30d ?? 0)
				const chainAssets = chainsAssets[chain.name]
				const childGroups = rest.chainsGroupbyParent[chain.name] ?? null

				return {
					...chain,
					extraTvl,
					protocols,
					deprecated: currentChainMetadata?.deprecated === true,
					stablesMcap,
					dexVolume24h,
					dexVolume7d,
					dexVolume30d,
					fees24h,
					fees7d,
					fees30d,
					revenue24h,
					revenue7d,
					revenue30d,
					appRevenue24h,
					appRevenue7d,
					appRevenue30d,
					activeUsers24h,
					activeUsers7d,
					activeUsers30d,
					chainAssets: chainAssets ?? null,
					bridgedTvl: chainAssets?.total.total ?? null,
					childGroups,
					tvl,
					tvlPrevDay,
					tvlPrevWeek,
					tvlPrevMonth,
					nftVolume24h,
					nftVolume7d,
					nftVolume30d
				}
			})
			.sort((a, b) => {
				if (a.tvl == null) return b.tvl == null ? 0 : 1
				if (b.tvl == null) return -1
				return b.tvl - a.tvl
			}),
		description:
			category === 'All'
				? 'Combined TVL, Fees, Volume, Stablecoins Supply by all chains. DefiLlama is committed to providing accurate data without ads or sponsored content, as well as transparency.'
				: `Combined TVL, Fees, Volume, Stablecoins Supply by ${category} chains. DefiLlama is committed to providing accurate data without ads or sponsored content, as well as transparency.`
	}
}
