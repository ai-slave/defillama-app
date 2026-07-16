import { fetchBlockExplorers, fetchLiquidityTokensDataset } from '~/api'
import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import type { CgChartResponse } from '~/api/coingecko.types'
import type { BlockExplorersResponse, ProtocolLiquidityTokensResponse } from '~/api/types'
import { V2_SERVER_URL } from '~/constants'
import { chainCoingeckoIdsForGasNotMcap } from '~/constants/chainTokens'
import { CHART_COLORS } from '~/constants/colors'
import { fetchAdapterProtocolMetrics } from '~/containers/AdapterMetrics/api'
import { listArticles } from '~/containers/Articles/api'
import { articleHref } from '~/containers/Articles/landing/utils'
import { fetchBridgeVolumeBySlug } from '~/containers/Bridges/api'
import { governanceIdsToApis } from '~/containers/Governance/api'
import { getProtocolIncentivesFromAggregatedEmissions } from '~/containers/Incentives/queries'
import { fetchOracleMetrics, fetchOracleProtocolChart } from '~/containers/Oracles/api'
import type { IOracleProtocolChart } from '~/containers/Oracles/api.types'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { fetchTreasuries } from '~/containers/Treasuries/api'
import type { ProtocolEmissionSupplyMetricsMap } from '~/containers/Unlocks/api.types'
import { readYieldsMeta, type YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { EnrichedEarnRow, YieldsMeta } from '~/containers/Yields/data/types'
import { TVL_SETTINGS_KEYS_SET } from '~/contexts/LocalStorage'
import { FEE_EXTRA_CONFIG_BY_SETTING, type FeeExtraConfig } from '~/metrics/feeExtras'
import { capitalizeFirstLetter, slug } from '~/utils'
import { fetchJson, getFastJsonTimeoutMs } from '~/utils/async'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { buildProtocolOverviewHallmarks } from '~/utils/hallmarks'
import type { IChainMetadata, IProtocolMetadata, ProtocolLlamaswapMetadata } from '~/utils/metadata/types'
import { optionalPageData } from '~/utils/optionalPageData'
import { findTokenPageRoute, type TokenDirectory } from '~/utils/tokenDirectory'
import { fetchProtocolExpenses, fetchProtocolOverviewMetrics, fetchProtocolTvlChart } from './api'
import type { IProtocolValueChart, IProtocolMetricsV2, IProtocolExpenses } from './api.types'
import { resolveProtocolCategory } from './category'
import { normalizeChartPointsToMs } from './chartSeries.utils'
import { oracleProtocols } from './constants'
import { buildAvailableCharts, buildDefaultToggledCharts } from './defaultCharts'
import { formatAdapterData } from './formatAdapterData'
import type { IProtocolOverviewPageData, IProtocolPageMetrics } from './types'
import { getProtocolWarningBanners } from './utils'

interface IProtocolDataExtended extends IProtocolMetricsV2 {
	tokenCGData?: {
		price: {
			current: number | null
			ath: number | null
			athDate: string | null
			atl: number | null
			atlDate: string | null
		}
		marketCap: { current: number | null }
		totalSupply: number | null
		fdv: { current: number | null }
		volume24h: {
			total: number | null
			cex: number | null
			dex: number | null
		}
		symbol: string | null
	} | null
	devMetrics?: {
		weeklyCommits: number | null
		monthlyCommits: number | null
		weeklyDevelopers: number | null
		monthlyDevelopers: number | null
		lastCommit: number | null
		updatedAt: number | null
	}
}

export const getProtocolMetricFlags = ({
	protocolData,
	metadata
}: {
	protocolData: IProtocolMetricsV2
	metadata: IProtocolMetadata
}): IProtocolPageMetrics => {
	return {
		tvl: !!metadata.tvl,
		dexs: !!metadata.dexs,
		dexsNotionalVolume: !!metadata.dexsNotionalVolume,
		perps: !!metadata.perps,
		openInterest: !!metadata.openInterest,
		optionsPremiumVolume: !!metadata.optionsPremiumVolume,
		optionsNotionalVolume: !!metadata.optionsNotionalVolume,
		dexAggregators: !!metadata.dexAggregators,
		perpsAggregators: !!metadata.perpsAggregators,
		bridgeAggregators: !!metadata.bridgeAggregators,
		stablecoins: !!metadata.stablecoins,
		bridge: !!metadata.bridge,
		treasury: !!metadata.treasury,
		unlocks: !!metadata.emissions,
		incentives: !!metadata.incentives,
		yields: !!metadata.yields,
		fees: !!metadata.fees,
		revenue: !!metadata.revenue,
		bribes: !!metadata.bribeRevenue,
		tokenTax: !!metadata.tokenTax,
		forks: !!metadata.forks,
		governance: !!metadata.governance,
		nfts: !!metadata.nfts,
		dev: !!protocolData.github,
		inflows: !!metadata.inflows,
		liquidity: !!metadata.liquidity,
		activeUsers: !!metadata.activeUsers,
		newUsers: !!metadata.newUsers,
		txCount: !!metadata.txCount,
		gasUsed: !!metadata.gasUsed,
		liquidationVolume: !!metadata.liquidationVolume,
		collateralLiquidated: !!metadata.collateralLiquidated,
		borrowed: !!metadata.borrowed,
		tokenRights: !!metadata.tokenRights
	}
}

type IBridgeVolumeResult = Array<{ date: string; depositUSD: number; withdrawUSD: number }> | null
type IProtocolTvlChartSeedResult = { data: IProtocolValueChart; failed: boolean }

export const getProtocolOverviewPageData = async ({
	protocolId,
	currentProtocolMetadata,
	isCEX = false,
	chainMetadata,
	tokenlist,
	cgExchangeIdentifiers,
	emissionsSupplyMetrics,
	protocolLlamaswapDataset,
	tokenDirectory = null,
	yieldsSnapshot
}: {
	protocolId: string
	currentProtocolMetadata: IProtocolMetadata
	isCEX?: boolean
	chainMetadata: Record<string, IChainMetadata>
	tokenlist: Record<string, import('~/utils/metadata/types').ITokenListEntry>
	cgExchangeIdentifiers: string[]
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
	protocolLlamaswapDataset?: ProtocolLlamaswapMetadata
	tokenDirectory?: TokenDirectory | null
	yieldsSnapshot: YieldsSnapshot | null
}): Promise<IProtocolOverviewPageData> => {
	const displayName = currentProtocolMetadata.displayName ?? ''
	const currentProtocolSlug = slug(displayName)
	const oracleProtocolName = (oracleProtocols as Record<string, string>)[displayName] ?? null
	const isOracleProtocol = Boolean(oracleProtocolName)
	const optionalProtocolData = <T,>(label: string, run: () => Promise<T>, fallback: T): Promise<T> =>
		optionalPageData(`protocol:${currentProtocolSlug}:${label}`, run, fallback)
	const feeExtraMetricPromise = (extra: FeeExtraConfig) =>
		currentProtocolMetadata[extra.protocolMetadataField]
			? fetchAdapterProtocolMetrics({
					adapterType: 'fees',
					dataType: extra.dataType,
					protocol: displayName
				}).then((data) =>
					formatAdapterData({
						data,
						methodologyKey: extra.methodologyKey
					})
				)
			: Promise.resolve(null)
	const bribesDataPromise = feeExtraMetricPromise(FEE_EXTRA_CONFIG_BY_SETTING.bribes)
	const tokenTaxDataPromise = feeExtraMetricPromise(FEE_EXTRA_CONFIG_BY_SETTING.tokentax)
	const researchReportsPromise = optionalProtocolData(
		'research',
		() =>
			listArticles({ tags: [currentProtocolSlug], section: 'report', limit: 3, sort: 'newest' }).then(
				(res): IProtocolOverviewPageData['articles'] =>
					res.items.map((article) => ({
						headline: article.title,
						date: article.displayDate ?? article.publishedAt ?? article.updatedAt,
						href: articleHref(article),
						imgSrc: article.coverImage?.url ?? null
					}))
			),
		[]
	)

	const [
		protocolData,
		protocolTvlChartSeed,
		feesData,
		revenueData,
		holdersRevenueData,
		bribesData,
		tokenTaxData,
		dexVolumeData,
		dexNotionalVolumeData,
		dexAggregatorVolumeData,
		perpVolumeData,
		openInterestData,
		perpAggregatorVolumeData,
		bridgeAggregatorVolumeData,
		optionsPremiumVolumeData,
		optionsNotionalVolumeData,
		liquidationVolumeData,
		collateralLiquidatedData,
		treasury,
		yieldsData,
		incentives,
		adjustedSupply,
		activeUsers,
		newUsers,
		transactions,
		gasUsd,
		expenses,
		yieldsConfig,
		liquidityInfo,
		liteProtocolsData,
		bridgeVolumeData,
		incomeStatement,
		oracleChartData,
		oracleTvs,
		blockExplorersData
	]: [
		IProtocolDataExtended,
		IProtocolTvlChartSeedResult,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		Awaited<ReturnType<typeof formatAdapterData>>,
		IProtocolOverviewPageData['treasury'],
		EnrichedEarnRow[] | null,
		IProtocolOverviewPageData['incentives'],
		number | null,
		number | null,
		number | null,
		number | null,
		number | null,
		IProtocolExpenses | null,
		YieldsMeta | null,
		ProtocolLiquidityTokensResponse,
		ProtocolsResponse,
		IBridgeVolumeResult,
		IProtocolOverviewPageData['incomeStatement'],
		IOracleProtocolChart | null,
		IProtocolOverviewPageData['oracleTvs'],
		BlockExplorersResponse
	] = await Promise.all([
		fetchProtocolOverviewMetrics(currentProtocolSlug).then(async (data): Promise<IProtocolDataExtended> => {
			try {
				const geckoId = data.gecko_id
				const tokenEntry = geckoId ? (tokenlist[geckoId] ?? null) : null
				const tickers =
					tokenEntry && geckoId
						? await fetchCoinGeckoChartByIdWithCacheFallback(geckoId)
								.then((res) => res?.data?.coinData?.tickers)
								.catch(() => undefined)
						: undefined
				return { ...data, tokenCGData: getTokenCGData(tokenEntry, tickers, cgExchangeIdentifiers) }
			} catch (e) {
				console.log('[HTTP]:[ERROR]:[TOKEN_CG_DATA]:', e)
				return data
			}
		}),
		currentProtocolMetadata.tvl && !isOracleProtocol
			? fetchProtocolTvlChart({ protocol: currentProtocolSlug, timeout: getFastJsonTimeoutMs() })
					.then((chart): IProtocolTvlChartSeedResult => ({ data: chart ?? [], failed: false }))
					.catch((err) => {
						console.log(
							'[HTTP]:[ERROR]:[PROTOCOL_TVL_CHART]:',
							currentProtocolSlug,
							err instanceof Error ? err.message : err
						)
						return { data: [], failed: true }
					})
			: Promise.resolve({ data: [], failed: false }),
		currentProtocolMetadata.fees
			? fetchAdapterProtocolMetrics({
					adapterType: 'fees',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'Fees' }))
			: Promise.resolve(null),
		currentProtocolMetadata.revenue
			? fetchAdapterProtocolMetrics({
					adapterType: 'fees',
					dataType: 'dailyRevenue',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'Revenue' }))
			: Promise.resolve(null),
		currentProtocolMetadata.holdersRevenue
			? fetchAdapterProtocolMetrics({
					adapterType: 'fees',
					dataType: 'dailyHoldersRevenue',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'HoldersRevenue' }))
			: Promise.resolve(null),
		bribesDataPromise,
		tokenTaxDataPromise,
		currentProtocolMetadata.dexs
			? fetchAdapterProtocolMetrics({
					adapterType: 'dexs',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: data.methodology?.['Volume'] ? 'Volume' : 'dexs' }))
			: Promise.resolve(null),
		currentProtocolMetadata.dexsNotionalVolume
			? fetchAdapterProtocolMetrics({
					adapterType: 'dexs',
					dataType: 'dailyNotionalVolume',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) =>
					formatAdapterData({
						data,
						methodologyKey: data.methodology?.NotionalVolume ? 'NotionalVolume' : 'dexsNotionalVolume'
					})
				)
			: Promise.resolve(null),
		currentProtocolMetadata.dexAggregators
			? fetchAdapterProtocolMetrics({
					adapterType: 'aggregators',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'dexAggregators' }))
			: Promise.resolve(null),
		currentProtocolMetadata.perps
			? fetchAdapterProtocolMetrics({
					adapterType: 'derivatives',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'perps' }))
			: Promise.resolve(null),
		currentProtocolMetadata.openInterest
			? fetchAdapterProtocolMetrics({
					adapterType: 'open-interest',
					protocol: currentProtocolMetadata.displayName ?? '',
					dataType: 'openInterestAtEnd'
				}).then((data) => formatAdapterData({ data, methodologyKey: 'openInterest' }))
			: Promise.resolve(null),
		currentProtocolMetadata.perpsAggregators
			? fetchAdapterProtocolMetrics({
					adapterType: 'aggregator-derivatives',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'perpsAggregators' }))
			: Promise.resolve(null),
		currentProtocolMetadata.bridgeAggregators
			? fetchAdapterProtocolMetrics({
					adapterType: 'bridge-aggregators',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'bridgeAggregators' }))
			: Promise.resolve(null),
		currentProtocolMetadata.optionsPremiumVolume
			? fetchAdapterProtocolMetrics({
					adapterType: 'options',
					dataType: 'dailyPremiumVolume',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'optionsPremiumVolume' }))
			: Promise.resolve(null),
		currentProtocolMetadata.optionsNotionalVolume
			? fetchAdapterProtocolMetrics({
					adapterType: 'options',
					dataType: 'dailyNotionalVolume',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'optionsNotionalVolume' }))
			: Promise.resolve(null),
		currentProtocolMetadata.liquidationVolume
			? fetchAdapterProtocolMetrics({
					adapterType: 'liquidations',
					dataType: 'dailyLiquidationVolume',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'LiquidationVolume' }))
			: Promise.resolve(null),
		currentProtocolMetadata.collateralLiquidated
			? fetchAdapterProtocolMetrics({
					adapterType: 'liquidations',
					dataType: 'dailyCollateralLiquidated',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) => formatAdapterData({ data, methodologyKey: 'CollateralLiquidated' }))
			: Promise.resolve(null),
		currentProtocolMetadata.treasury
			? optionalProtocolData(
					'treasury',
					() =>
						fetchTreasuries()
							.then(
								(res: Array<{ id: string; tokenBreakdowns?: Record<string, number | null> }>) =>
									res.find((item) => item.id === `${protocolId}-treasury`)?.tokenBreakdowns ?? null
							)
							.then((res): IProtocolOverviewPageData['treasury'] => {
								if (!res) return null
								return {
									majors: res.majors ?? null,
									stablecoins: res.stablecoins ?? null,
									ownTokens: res.ownTokens ?? null,
									others: res.others ?? null,
									total: [res.majors, res.stablecoins, res.ownTokens, res.others].reduce(
										(acc: number, curr) => acc + +(curr ?? 0),
										0
									)
								}
							}),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata.yields && yieldsSnapshot
			? optionalProtocolData(
					'yields',
					() =>
						import('~/containers/Yields/data/enrich.server').then(({ getEntityEarn }) => getEntityEarn(yieldsSnapshot)),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata?.incentives && protocolId
			? optionalProtocolData(
					'incentives',
					() =>
						getProtocolIncentivesFromAggregatedEmissions({
							protocolId,
							protocolDisplayName: currentProtocolMetadata.displayName ?? ''
						}),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata?.emissions && protocolId
			? (emissionsSupplyMetrics[currentProtocolSlug]?.supplyMetrics?.adjustedSupply ?? null)
			: null,
		currentProtocolMetadata.activeUsers
			? optionalProtocolData(
					'active_users',
					() =>
						fetchAdapterProtocolMetrics({
							protocol: currentProtocolMetadata.displayName,
							adapterType: 'active-users'
						}).then((data) => data?.total24h ?? null),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata.newUsers
			? optionalProtocolData(
					'new_users',
					() =>
						fetchAdapterProtocolMetrics({
							protocol: currentProtocolMetadata.displayName,
							adapterType: 'new-users'
						}).then((data) => data?.total24h ?? null),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata.txCount
			? optionalProtocolData(
					'transactions',
					() =>
						fetchAdapterProtocolMetrics({
							protocol: currentProtocolMetadata.displayName,
							adapterType: 'active-users',
							dataType: 'dailyTransactionsCount'
						}).then((data) => data?.total24h ?? null),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata.gasUsed
			? optionalProtocolData(
					'gas_used',
					() =>
						fetchAdapterProtocolMetrics({
							protocol: currentProtocolMetadata.displayName,
							adapterType: 'active-users',
							dataType: 'dailyGasUsed'
						}).then((data) => data?.total24h ?? null),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata.expenses && protocolId
			? optionalProtocolData(
					'expenses',
					() => fetchProtocolExpenses().then((data) => data.find((item) => item.protocolId === protocolId) ?? null),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata.liquidity && yieldsSnapshot
			? optionalProtocolData('liquidity_yields_config', () => readYieldsMeta(yieldsSnapshot), null)
			: Promise.resolve(null),
		currentProtocolMetadata?.liquidity
			? optionalProtocolData('liquidity_tokens', () => fetchLiquidityTokensDataset(), [])
			: Promise.resolve([]),
		fetchProtocols().catch((): ProtocolsResponse => ({ protocols: [], chains: [], parentProtocols: [] })),
		currentProtocolMetadata.bridge
			? optionalProtocolData(
					'bridge_volume',
					() =>
						fetchBridgeVolumeBySlug(slug(currentProtocolMetadata.displayName)).then(
							(data) => data.dailyVolumes || null
						),
					null
				)
			: Promise.resolve(null),
		optionalProtocolData(
			'income_statement',
			() => getProtocolIncomeStatement({ metadata: currentProtocolMetadata }),
			null
		),
		oracleProtocolName
			? optionalProtocolData(
					'oracle_chart',
					() =>
						fetchOracleProtocolChart({ protocol: oracleProtocolName }).then((data): Array<[number, number]> | null =>
							normalizeChartPointsToMs(data)
						),
					null
				)
			: Promise.resolve(null),
		oracleProtocolName
			? optionalProtocolData(
					'oracle_metrics',
					() =>
						fetchOracleMetrics().then((data): Record<string, number> | null => {
							const protocolTvsByOracle = data?.oraclesTVS?.[oracleProtocolName]
							if (!protocolTvsByOracle) return null
							const tvs: Record<string, number> = {}

							const displayNameTvs = protocolTvsByOracle[displayName]
							const slugNameTvs = protocolTvsByOracle[slug(displayName)]
							const selectedProtocolTvs: Record<string, Record<string, number>> = displayNameTvs
								? { [displayName]: displayNameTvs }
								: slugNameTvs
									? { [slug(displayName)]: slugNameTvs }
									: (protocolTvsByOracle as unknown as Record<string, Record<string, number>>)
							for (const protocolKey in selectedProtocolTvs) {
								const chainTvs = selectedProtocolTvs[protocolKey]
								for (const chain in chainTvs) {
									const nestedValue = Number(chainTvs[chain])
									if (!Number.isFinite(nestedValue)) continue
									tvs[chain] = (tvs[chain] ?? 0) + nestedValue
								}
							}
							return Object.keys(tvs).length > 0 ? tvs : null
						}),
					null
				)
			: Promise.resolve(null),
		fetchBlockExplorers().catch((): BlockExplorersResponse => [])
	])

	const resolvedCategory = resolveProtocolCategory({
		protocolData,
		liteProtocols: liteProtocolsData?.protocols ?? []
	})

	const otherProtocolSlugs = new Set(protocolData.otherProtocols?.map((protocol) => slug(protocol)) ?? [])
	let trackedPoolCount = 0
	let trackedApyCount = 0
	let trackedApyTotal = 0
	for (const pool of yieldsData ?? []) {
		const matchesProtocol =
			pool.protocol === currentProtocolMetadata.displayName ||
			pool.protocolSlug === currentProtocolSlug ||
			(!protocolData.parentProtocol && pool.protocolSlug != null && otherProtocolSlugs.has(pool.protocolSlug))
		if (!matchesProtocol) continue

		trackedPoolCount += 1
		const apy = pool.apy.current.total
		if (apy != null) {
			trackedApyCount += 1
			trackedApyTotal += apy
		}
	}
	const yields = trackedPoolCount
		? {
				noOfPoolsTracked: trackedPoolCount,
				averageAPY: trackedApyCount ? trackedApyTotal / trackedApyCount : null
			}
		: null

	const tokenPools = yieldsConfig
		? (liquidityInfo?.find((p: ProtocolLiquidityTokensResponse[number]) => p.id === protocolData.id)?.tokenPools ?? [])
		: []

	const liquidityAggregated = tokenPools.reduce(
		(agg: Record<string, Record<string, number>>, pool: { project: string; chain: string; tvlUsd: number }) => {
			if (!agg[pool.project]) agg[pool.project] = {}
			agg[pool.project][pool.chain] = pool.tvlUsd + (agg[pool.project][pool.chain] ?? 0)
			return agg
		},
		{} as Record<string, Record<string, number>>
	)

	const protocolNameBySlug = new Map((yieldsConfig?.protocols ?? []).map((protocol) => [protocol.slug, protocol.name]))
	const tokenLiquidity = yieldsConfig
		? (() => {
				const rows: Array<[string, string, number]> = []
				for (const protocolSlug in liquidityAggregated) {
					const protocolName = protocolNameBySlug.get(protocolSlug) ?? protocolSlug
					const chainValues = liquidityAggregated[protocolSlug]
					for (const chainName in chainValues) {
						rows.push([protocolName, chainName, Number(chainValues[chainName])])
					}
				}
				rows.sort((a: [string, string, number], b: [string, string, number]) => b[2] - a[2])
				return rows
			})()
		: ([] as Array<[string, string, number]>)

	const raises =
		protocolData.raises
			?.sort((a, b) => a.date - b.date)
			?.map((r) => ({
				...r,
				investors: (r.leadInvestors ?? []).concat(r.otherInvestors ?? [])
			})) ?? null

	const hasKeyMetrics = !!(
		protocolData.currentChainTvls?.staking != null ||
		protocolData.currentChainTvls?.borrowed != null ||
		raises?.length ||
		expenses ||
		treasury ||
		tokenLiquidity?.length ||
		feesData?.totalAllTime ||
		revenueData?.totalAllTime ||
		holdersRevenueData?.totalAllTime ||
		incentives ||
		dexVolumeData?.totalAllTime ||
		dexNotionalVolumeData?.totalAllTime ||
		perpVolumeData?.totalAllTime ||
		dexAggregatorVolumeData?.totalAllTime ||
		perpAggregatorVolumeData?.totalAllTime ||
		bridgeAggregatorVolumeData?.totalAllTime ||
		optionsPremiumVolumeData?.totalAllTime ||
		optionsNotionalVolumeData?.totalAllTime ||
		liquidationVolumeData?.totalAllTime ||
		collateralLiquidatedData?.totalAllTime ||
		openInterestData?.total24h != null ||
		bridgeVolumeData?.length ||
		bribesData?.totalAllTime ||
		tokenTaxData?.totalAllTime ||
		oracleTvs ||
		protocolData.tokenCGData
	)

	const protocolChainsSet = new Set(protocolData.chains ?? [])

	const competitors =
		liteProtocolsData && resolvedCategory
			? (() => {
					const rows: Array<{ name: string; tvl: number; commonChains: number }> = []
					const currentCategory = resolvedCategory.toLowerCase()
					const currentName = protocolData.name?.toLowerCase()
					for (const protocol of liteProtocolsData.protocols) {
						if (!protocol.category) continue
						if (protocol.category.toLowerCase() !== currentCategory) continue
						if (protocol.name.toLowerCase() === currentName) continue
						const candidateChainsSet = new Set(protocol.chains)
						let hasCommonChain = false
						for (const chain of candidateChainsSet) {
							if (protocolChainsSet.has(chain)) {
								hasCommonChain = true
								break
							}
						}
						if (!hasCommonChain) continue

						let commonChains = 0
						for (const chain of protocolData?.chains ?? []) {
							if (candidateChainsSet.has(chain)) {
								commonChains += 1
							}
						}

						rows.push({ name: protocol.name, tvl: protocol.tvl, commonChains })
					}
					rows.sort((a, b) => b.tvl - a.tvl)
					return rows
				})()
			: []

	const competitorsSet = new Set<string>()
	const competitorsMap = new Map(competitors.map((p) => [p.name, p]))

	const protocolsWithCommonChains = competitors.toSorted((a, b) => b.commonChains - a.commonChains).slice(0, 5)

	// first 5 are the protocols that are on same chain + same category
	for (const p of protocolsWithCommonChains) {
		competitorsSet.add(p.name)
	}

	// last 5 are the protocols in same category
	for (const p of competitors) {
		if (competitorsSet.size < 10) {
			competitorsSet.add(p.name)
		}
	}

	const competitorsList: Array<{ name: string; tvl: number }> = []
	for (const protocolName of competitorsSet) {
		const competitor = competitorsMap.get(protocolName)
		if (!competitor) continue
		competitorsList.push({ name: competitor.name, tvl: competitor.tvl })
	}

	const hacks = protocolData.hacks?.toSorted((a, b) => (a.date ?? 0) - (b.date ?? 0)) ?? null

	const protocolMetrics = getProtocolMetricFlags({
		protocolData,
		metadata: currentProtocolMetadata
	})

	const chains: Array<[string, number]> = []
	const currentChainTvlsObj = protocolData.currentChainTvls ?? {}
	for (const chain in currentChainTvlsObj) {
		if (chain.includes('-') || chain === 'offers') continue
		if (TVL_SETTINGS_KEYS_SET.has(chain)) continue
		if (currentChainTvlsObj[chain] != null) {
			chains.push([chain, currentChainTvlsObj[chain]])
		}
	}
	let firstChain: string | null = null
	let firstChainTvl = -Infinity
	for (const [chain, tvl] of chains) {
		if (tvl > firstChainTvl) {
			firstChain = chain
			firstChainTvl = tvl
		}
	}
	const tokenGeckoId = currentProtocolMetadata.gecko_id ?? null
	const llamaswapChains = !isCEX && tokenGeckoId ? (protocolLlamaswapDataset?.[tokenGeckoId] ?? null) : null
	const chartDenominations: Array<{ symbol: string; geckoId?: string | null }> = []
	if (firstChain && !isCEX) {
		chartDenominations.push({ symbol: 'USD', geckoId: null })

		const cmetadata = chainMetadata?.[slug(firstChain)]
		const chainGasIds = chainCoingeckoIdsForGasNotMcap as Record<
			string,
			{ geckoId: string; symbol: string; cmcId: string }
		>
		if (cmetadata && chainGasIds[cmetadata.name]) {
			chartDenominations.push({
				symbol: chainGasIds[cmetadata.name].symbol,
				geckoId: chainGasIds[cmetadata.name].geckoId
			})
		} else if (cmetadata?.gecko_id) {
			chartDenominations.push({ symbol: cmetadata.tokenSymbol ?? '', geckoId: cmetadata.gecko_id })
		} else {
			chartDenominations.push({ symbol: 'ETH', geckoId: chainMetadata?.['ethereum']?.gecko_id })
		}
	}

	const protocolTvlChartData = protocolTvlChartSeed.data
	const availableCharts = buildAvailableCharts({
		isCEX,
		hasTvlChart: Boolean(
			currentProtocolMetadata.tvl && (protocolTvlChartData.length > 0 || protocolTvlChartSeed.failed)
		),
		hasTvsChart: Boolean(oracleChartData?.length),
		hasGeckoId: Boolean(tokenGeckoId),
		hasLiquidity: Boolean(currentProtocolMetadata.liquidity),
		hasFees: Boolean(feesData),
		hasRevenue: Boolean(revenueData),
		hasHoldersRevenue: Boolean(holdersRevenueData),
		hasDexVolume: Boolean(dexVolumeData),
		hasDexNotionalVolume: Boolean(dexNotionalVolumeData),
		hasPerpVolume: Boolean(perpVolumeData),
		hasOpenInterest: Boolean(openInterestData),
		hasOptionsPremiumVolume: Boolean(optionsPremiumVolumeData),
		hasOptionsNotionalVolume: Boolean(optionsNotionalVolumeData),
		hasDexAggregatorVolume: Boolean(dexAggregatorVolumeData),
		hasPerpAggregatorVolume: Boolean(perpAggregatorVolumeData),
		hasBridgeAggregatorVolume: Boolean(bridgeAggregatorVolumeData),
		hasLiquidationVolume: Boolean(liquidationVolumeData),
		hasCollateralLiquidated: Boolean(collateralLiquidatedData),
		hasBridgeVolume: Boolean(bridgeVolumeData),
		hasUnlocks: Boolean(currentProtocolMetadata.emissions),
		hasIncentives: Boolean(incentives),
		hasStaking: protocolData.currentChainTvls?.staking != null,
		hasBorrowed: protocolData.currentChainTvls?.borrowed != null,
		hasUsdInflows: Boolean(protocolMetrics.inflows),
		hasTreasury: Boolean(treasury),
		hasMedianApy: Boolean(yields && !protocolData.isParentProtocol),
		hasGovernance: Boolean(protocolData.governanceID),
		hasNfts: Boolean(currentProtocolMetadata.nfts),
		hasActiveAddresses: protocolMetrics.activeUsers,
		hasNewAddresses: protocolMetrics.newUsers,
		hasTransactions: protocolMetrics.txCount,
		hasGasUsed: protocolMetrics.gasUsed
	})

	const chartColors: Record<string, string> = {}
	for (let i = 0; i < availableCharts.length; i++) {
		const chart = availableCharts[i]
		chartColors[chart] = CHART_COLORS[i]
	}

	const { hallmarks, rangeHallmarks } = buildProtocolOverviewHallmarks({
		hacks,
		protocolHallmarks: protocolData.hallmarks,
		dimensions: protocolData.dimensions
	})

	const name = protocolData.name ?? currentProtocolMetadata.displayName ?? ''

	const initialMultiSeriesChartData: IProtocolOverviewPageData['initialMultiSeriesChartData'] = {}
	if (protocolTvlChartData.length > 0) {
		initialMultiSeriesChartData[isCEX ? 'Total Assets' : 'TVL'] = protocolTvlChartData
	}
	if (oracleChartData?.length) {
		initialMultiSeriesChartData['TVS'] = oracleChartData
	}
	const availableChartSet = new Set(availableCharts)
	const primaryTvlChartLabel = isCEX ? 'Total Assets' : ('TVL' as const)
	const defaultToggledCharts = buildDefaultToggledCharts({
		isCEX,
		isOracleProtocol,
		protocolMetricsTvl: Boolean(currentProtocolMetadata.tvl),
		protocolTvlChartData,
		currentChainTvls: protocolData.currentChainTvls ?? undefined,
		availableCharts,
		category: resolvedCategory
	})
	if (protocolTvlChartSeed.failed && availableChartSet.has(primaryTvlChartLabel)) {
		defaultToggledCharts.unshift(primaryTvlChartLabel)
	}

	const titleMetrics: string[] = []
	const seoExcludedCharts = ['Successful Proposals', 'Total Proposals', 'Max Votes']
	if (incomeStatement) {
		seoExcludedCharts.push('Fees', 'Revenue', 'Incentives', 'Holders Revenue')
	}
	const chartLabelsForSeo = availableCharts.filter((chart) => !seoExcludedCharts.includes(chart))

	let seoDescription = `Track ${name} on DefiLlama. Including ${chartLabelsForSeo.length ? chartLabelsForSeo.join(', ') : 'key onchain and financial stats'}`

	if (availableCharts.includes(isCEX ? 'Total Assets' : 'TVL')) {
		titleMetrics.push(isCEX ? 'Assets' : 'TVL')
	}
	if (availableCharts.includes('Fees')) {
		titleMetrics.push('Fees')
	}
	if (availableCharts.includes('Revenue')) {
		titleMetrics.push('Revenue')
	}
	if (availableCharts.includes('DEX Volume') || availableCharts.includes('Perp Volume')) {
		titleMetrics.push('Volume')
	}
	if (incomeStatement) {
		// titleMetrics.push('Income Statement')
		seoDescription += `, Income Statement`
		for (const type in incomeStatement.labelsByType) {
			const breakdowns = incomeStatement.labelsByType[type]?.map((label) =>
				label === 'Token Buy Back' ? 'Token Buyback' : label
			)
			if (breakdowns?.length) {
				seoDescription += `, ${type} (${breakdowns.join(', ')})`
			}
		}
	} else {
		if (availableCharts.includes('Revenue') && availableCharts.includes('Incentives')) {
			// titleMetrics.push('Earnings')
			seoDescription += `, Earnings`
		}
		if (expenses) {
			// titleMetrics.push('Expenses')
			seoDescription += `, Expenses`
		}
	}

	const titleMetricSegment =
		titleMetrics.length === 0
			? 'Stats & Charts'
			: titleMetrics.length === 1
				? `${titleMetrics[0]} Stats & Charts`
				: `${titleMetrics.slice(0, -1).join(', ')} & ${titleMetrics.at(-1)}`
	const seoTitle = `${name} ${titleMetricSegment}`

	return {
		id: String(protocolData.id),
		name: name,
		category: resolvedCategory,
		tags: protocolData.tags ?? null,
		otherProtocols: protocolData.otherProtocols ?? null,
		deprecated: protocolData.deprecated ?? false,
		chains: protocolData.chains ?? [],
		currentTvlByChain: currentProtocolMetadata.tvl ? (protocolData.currentChainTvls ?? {}) : {},
		description: protocolData.description ?? '',
		website: protocolData.referralUrl?.trim() || protocolData.url?.trim() || null,
		isWebsiteReferral: Boolean(protocolData.referralUrl?.trim()),
		twitter: protocolData.twitter ?? null,
		safeHarbor: currentProtocolMetadata.safeHarbor ?? false,
		github: protocolData.github
			? typeof protocolData.github === 'string'
				? [protocolData.github]
				: protocolData.github
			: null,
		tvlMethodology:
			protocolData.methodology ||
			(currentProtocolMetadata.tvl && protocolData.module !== 'dummy.js'
				? 'Total value of all coins held in the smart contracts of the protocol'
				: null),
		tvlMethodologyUrl:
			protocolData.tvlCodePath && !protocolData.tvlCodePath.endsWith('dummy.js')
				? protocolData.tvlCodePath
				: currentProtocolMetadata.tvl && protocolData.module && protocolData.module !== 'dummy.js'
					? `https://github.com/DefiLlama/DefiLlama-Adapters/tree/main/projects/${protocolData.module}`
					: null,
		treasuryMethodologyUrl: protocolData.treasuryCodePath ?? null,
		token: {
			symbol:
				protocolData.symbol && protocolData.symbol !== '-'
					? protocolData.symbol
					: (protocolData.tokenCGData?.symbol ?? null),
			gecko_id: tokenGeckoId,
			gecko_url: tokenGeckoId ? `https://www.coingecko.com/en/coins/${tokenGeckoId}` : null,
			tokenPageRoute: findTokenPageRoute(tokenDirectory, {
				defillamaId: String(protocolData.id),
				geckoId: tokenGeckoId
			}),
			explorer_url:
				getBlockExplorerNew({
					apiResponse: blockExplorersData,
					address: protocolData.address ?? '',
					urlType: 'token'
				})?.url ?? null
		},
		metrics: protocolMetrics,
		fees: feesData,
		revenue: revenueData,
		holdersRevenue: holdersRevenueData,
		bribeRevenue: bribesData,
		tokenTax: tokenTaxData,
		dexVolume: dexVolumeData,
		dexNotionalVolume: dexNotionalVolumeData,
		dexAggregatorVolume: dexAggregatorVolumeData,
		perpVolume: perpVolumeData,
		openInterest: openInterestData,
		perpAggregatorVolume: perpAggregatorVolumeData,
		bridgeAggregatorVolume: bridgeAggregatorVolumeData,
		optionsPremiumVolume: optionsPremiumVolumeData,
		optionsNotionalVolume: optionsNotionalVolumeData,
		liquidationVolume: liquidationVolumeData,
		collateralLiquidated: collateralLiquidatedData,
		bridgeVolume: bridgeVolumeData || null,
		treasury,
		unlocks: null,
		governance: null,
		yields,
		articles: await researchReportsPromise,
		incentives,
		users:
			activeUsers || newUsers || transactions || gasUsd
				? {
						activeUsers: activeUsers ?? null,
						newUsers: newUsers ?? null,
						transactions: transactions ?? null,
						gasUsd: gasUsd ?? null
					}
				: null,
		raises: raises?.length ? raises : null,
		expenses: expenses
			? {
					headcount: expenses.headcount ?? null,
					annualUsdCost: Object.entries(expenses.annualUsdCost ?? {}).map(([category, amount]) => [
						capitalizeFirstLetter(category),
						amount ?? null
					]),
					total: Object.values(expenses.annualUsdCost ?? {}).reduce((acc, curr) => acc + curr, 0),
					sources: expenses.sources ?? null,
					notes: expenses.notes ?? null,
					lastUpdate: expenses.lastUpdate ?? null
				}
			: null,
		tokenLiquidity:
			tokenLiquidity?.length > 0
				? { pools: tokenLiquidity, total: tokenLiquidity.reduce((acc, curr) => acc + curr[2], 0) }
				: null,
		tokenCGData: protocolData.tokenCGData ?? null,
		outstandingFDV:
			adjustedSupply && protocolData.tokenCGData?.price?.current
				? adjustedSupply * protocolData.tokenCGData.price.current
				: null,
		audits:
			protocolData.audits && +protocolData.audits > 0
				? {
						total: +protocolData.audits,
						auditLinks: protocolData.audit_links ?? [],
						note: protocolData.audit_note ?? null
					}
				: null,
		isCEX,
		hasKeyMetrics,
		competitors: competitorsList,
		hacks: hacks ?? [],
		chartDenominations,
		availableCharts,
		chartColors,
		initialMultiSeriesChartData,
		hallmarks,
		rangeHallmarks,
		geckoId: tokenGeckoId,
		governanceApis: governanceIdsToApis(protocolData.governanceID ?? []),
		incomeStatement,
		warningBanners: getProtocolWarningBanners(protocolData),
		defaultChartView:
			feesData?.defaultChartView ??
			revenueData?.defaultChartView ??
			holdersRevenueData?.defaultChartView ??
			bribesData?.defaultChartView ??
			tokenTaxData?.defaultChartView ??
			dexVolumeData?.defaultChartView ??
			dexNotionalVolumeData?.defaultChartView ??
			dexAggregatorVolumeData?.defaultChartView ??
			perpVolumeData?.defaultChartView ??
			perpAggregatorVolumeData?.defaultChartView ??
			bridgeAggregatorVolumeData?.defaultChartView ??
			optionsPremiumVolumeData?.defaultChartView ??
			optionsNotionalVolumeData?.defaultChartView ??
			liquidationVolumeData?.defaultChartView ??
			collateralLiquidatedData?.defaultChartView ??
			'daily',
		seoTitle,
		seoDescription,
		defaultToggledCharts,
		oracleTvs,
		llamaswapChains
	}
}

function getTokenCGData(
	tokenEntry: import('~/utils/metadata/types').ITokenListEntry | null,
	tickers: CgChartResponse['data']['coinData']['tickers'] | undefined,
	cgExchangeIdentifiers: string[]
) {
	if (!tokenEntry) return null

	let cexVolume: number | null = null
	let dexVolume: number | null = null
	if (tickers) {
		const cexIds = new Set(cgExchangeIdentifiers)
		let cex = 0
		let dex = 0
		for (const t of tickers) {
			const vol = t.converted_volume?.usd ?? 0
			if (t.trust_score === 'red') continue
			if (cexIds.has(t.market?.identifier ?? '')) {
				cex += vol
			} else {
				dex += vol
			}
		}
		cexVolume = cex
		dexVolume = dex
	}

	return {
		price: {
			current: tokenEntry.current_price ?? null,
			ath: tokenEntry.ath ?? null,
			athDate: tokenEntry.ath_date ?? null,
			atl: tokenEntry.atl ?? null,
			atlDate: tokenEntry.atl_date ?? null
		},
		marketCap: { current: tokenEntry.market_cap ?? null },
		totalSupply: tokenEntry.total_supply ?? null,
		fdv: { current: tokenEntry.fully_diluted_valuation ?? null },
		volume24h: {
			total: tokenEntry.total_volume ?? null,
			cex: cexVolume,
			dex: dexVolume
		},
		symbol: tokenEntry.symbol ? tokenEntry.symbol.toUpperCase() : null
	}
}

const protocolsWithFalsyBreakdownMetrics = new Set([])

type IncomeStatementSource = { kind: 'protocol'; metadata: IProtocolMetadata } | { kind: 'token'; token: string }

export function getProtocolIncomeStatement({ metadata }: { metadata: IProtocolMetadata }) {
	return getIncomeStatement({ kind: 'protocol', metadata })
}

export function getTokenIncomeStatement({ token }: { token: string }) {
	return getIncomeStatement({ kind: 'token', token })
}

async function getIncomeStatement(source: IncomeStatementSource) {
	try {
		if (source.kind === 'protocol' && (!source.metadata.fees || !source.metadata.revenue)) {
			return null
		}

		if (source.kind === 'protocol' && typeof window !== 'undefined') {
			const protocol = slug(source.metadata.displayName)
			return fetchJson(`/api/public/income-statement?protocol=${encodeURIComponent(protocol)}`).catch(() => null)
		}

		const entity = source.kind === 'protocol' ? source.metadata.displayName : source.token
		const incomeStatement = await fetchJson(
			`${V2_SERVER_URL}/metrics/financial-statement/${source.kind}/${slug(entity)}?q=30`
		)

		if (!incomeStatement) {
			throw new Error(`Missing income statement for ${source.kind}=${entity}`)
		}

		type IncomeStatementData = NonNullable<IProtocolOverviewPageData['incomeStatement']>['data']
		const aggregates: IncomeStatementData =
			incomeStatement?.aggregates ??
			({
				monthly: {},
				quarterly: {},
				yearly: {},
				cumulative: {}
			} as IncomeStatementData)

		type PeriodEntry = Record<string, { value: number; 'by-label': Record<string, number> }> & { timestamp?: number }
		type AggregatesMap = Record<string, Record<string, PeriodEntry>>
		// IncomeStatementData uses a union key ('monthly' | 'quarterly' | 'yearly') which is structurally
		// compatible with Record<string, ...>, but TS doesn't allow direct assignment. We widen through
		// a single cast since the runtime shape is guaranteed to match.
		const aggregatesMap: AggregatesMap = aggregates as AggregatesMap

		if (protocolsWithFalsyBreakdownMetrics.has(source.kind === 'protocol' ? (source.metadata.displayName ?? '') : '')) {
			for (const groupBy in aggregatesMap) {
				for (const period in aggregatesMap[groupBy]) {
					for (const label in aggregatesMap[groupBy][period]) {
						if (label === 'timestamp') continue
						const entry = aggregatesMap[groupBy][period][label]
						if (entry && typeof entry === 'object' && 'by-label' in entry) {
							entry['by-label'] = {}
						}
					}
				}
			}
		}

		const labelsByType: Record<string, Set<string>> = {}
		const metricTypes = new Set<string>()

		// Collect all breakdown labels and metric type names present in the raw aggregates.
		// The table UI renders breakdown rows based on `labelsByType`, while the Sankey reads `by-label` directly.
		// If this isn't computed, breakdown rows will be missing in the table even when `by-label` data exists.
		for (const groupBy in aggregatesMap) {
			for (const period in aggregatesMap[groupBy]) {
				aggregatesMap[groupBy][period].timestamp = period.includes('Q')
					? new Date(
							`${period.split('-')[0]}-${((parseInt(period.split('-')[1].replace('Q', '')) - 1) * 3 + 1).toString().padStart(2, '0')}`
						).getTime()
					: new Date(period.length === 4 ? `${period}-01-01` : period).getTime()

				const periodData = aggregatesMap[groupBy][period]
				for (const type in periodData) {
					if (type === 'timestamp') continue
					metricTypes.add(type)
					const byLabel = periodData?.[type]?.['by-label']
					if (!byLabel) continue
					for (const breakdownLabel in byLabel) {
						if (!labelsByType[type]) labelsByType[type] = new Set()
						labelsByType[type].add(breakdownLabel)
					}
				}
			}
		}

		const cumulativePeriod: PeriodEntry = {}
		let latestMonthlyTimestamp = 0

		for (const period in aggregatesMap.monthly ?? {}) {
			const periodData = aggregatesMap.monthly[period]
			latestMonthlyTimestamp = Math.max(latestMonthlyTimestamp, Number(periodData?.timestamp ?? 0))

			for (const label in periodData) {
				if (label === 'timestamp') continue

				const entry = periodData[label] as { value: number; 'by-label': Record<string, number> } | undefined
				if (!entry) continue

				const cumulativeEntry = cumulativePeriod[label] as
					| { value: number; 'by-label': Record<string, number> }
					| undefined

				if (!cumulativeEntry) {
					cumulativePeriod[label] = {
						value: 0,
						'by-label': {}
					}
				}

				;(cumulativePeriod[label] as { value: number; 'by-label': Record<string, number> }).value += entry.value ?? 0

				for (const breakdownLabel in entry['by-label'] ?? {}) {
					const breakdowns = (cumulativePeriod[label] as { value: number; 'by-label': Record<string, number> })[
						'by-label'
					]
					breakdowns[breakdownLabel] = (breakdowns[breakdownLabel] ?? 0) + (entry['by-label'][breakdownLabel] ?? 0)
				}
			}
		}

		if (Object.keys(cumulativePeriod).length > 0) {
			cumulativePeriod.timestamp = latestMonthlyTimestamp
			aggregatesMap.cumulative = { cumulative: cumulativePeriod }
		}

		const finalLabelsByType: Record<string, Array<string>> = {}
		for (const label in labelsByType) {
			finalLabelsByType[label] = Array.from(labelsByType[label])
		}

		const methodology = incomeStatement.methodology ?? {}
		const breakdownMethodology = incomeStatement.breakdownMethodology ?? {}

		methodology['Earnings'] = 'Gross Profit minus Incentives'

		// If parent has no methodology, aggregate unique methodologies from child protocols
		if (incomeStatement.methodology == null && incomeStatement.childProtocols != null) {
			// Collect unique methodologies for each label type using Sets
			const methodologyByLabel: Record<string, Set<string>> = {}
			const breakdownMethodologyByLabel: Record<string, Record<string, Set<string>>> = {}

			for (const childProtocol of incomeStatement.childProtocols) {
				// Aggregate methodology
				if (childProtocol.methodology) {
					for (const label in childProtocol.methodology) {
						const methodologyText = childProtocol.methodology[label]
						if (methodologyText) {
							if (!methodologyByLabel[label]) {
								methodologyByLabel[label] = new Set()
							}
							methodologyByLabel[label].add(methodologyText)
						}
					}
				}

				// Aggregate breakdownMethodology
				if (childProtocol.breakdownMethodology) {
					for (const label in childProtocol.breakdownMethodology) {
						if (!breakdownMethodologyByLabel[label]) {
							breakdownMethodologyByLabel[label] = {}
						}
						const breakdowns = childProtocol.breakdownMethodology[label]
						for (const breakdownLabel in breakdowns) {
							const breakdownText = breakdowns[breakdownLabel]
							if (breakdownText) {
								if (!breakdownMethodologyByLabel[label][breakdownLabel]) {
									breakdownMethodologyByLabel[label][breakdownLabel] = new Set()
								}
								breakdownMethodologyByLabel[label][breakdownLabel].add(breakdownText)
							}
						}
					}
				}
			}

			// Convert Sets/Maps to strings
			for (const label in methodologyByLabel) {
				const uniqueMethodologies = Array.from(methodologyByLabel[label])
				if (uniqueMethodologies.length === 1) {
					methodology[label] = uniqueMethodologies[0]
				} else {
					// Multiple unique methodologies - show with child protocol names
					const parts: string[] = []
					for (const childProtocol of incomeStatement.childProtocols) {
						const childMethodology = childProtocol.methodology?.[label]
						if (childMethodology) {
							parts.push(`${childProtocol.displayName}: ${childMethodology}`)
						}
					}
					methodology[label] = parts.join('\n')
				}
			}

			for (const label in breakdownMethodologyByLabel) {
				if (!breakdownMethodology[label]) {
					breakdownMethodology[label] = {}
				}
				for (const breakdownLabel in breakdownMethodologyByLabel[label]) {
					const uniqueBreakdowns = Array.from(breakdownMethodologyByLabel[label][breakdownLabel])
					if (uniqueBreakdowns.length === 1) {
						breakdownMethodology[label][breakdownLabel] = uniqueBreakdowns[0]
					} else {
						// Multiple unique breakdown methodologies - show with child protocol names
						const parts: string[] = []
						for (const childProtocol of incomeStatement.childProtocols) {
							const childBreakdown = childProtocol.breakdownMethodology?.[label]?.[breakdownLabel]
							if (childBreakdown) {
								parts.push(`${childProtocol.displayName}: ${childBreakdown}`)
							}
						}
						breakdownMethodology[label][breakdownLabel] = parts.join('\n')
					}
				}
			}
		}

		return {
			data: aggregates,
			labelsByType: finalLabelsByType,
			methodology: methodology,
			breakdownMethodology: breakdownMethodology,
			hasOtherTokenHolderFlows: metricTypes.has('Others Token Holder Flows'),
			hasTokenHolderNetIncome: metricTypes.has('Token Holder Net Income')
		} as IProtocolOverviewPageData['incomeStatement']
	} catch (err) {
		if (typeof window === 'undefined') {
			throw err
		}
		return null
	}
}
