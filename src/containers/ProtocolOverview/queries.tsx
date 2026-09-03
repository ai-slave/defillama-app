import { fetchBlockExplorers, fetchLiquidityTokensDataset } from '~/api'
import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import type { CgChartResponse } from '~/api/coingecko.types'
import type { BlockExplorersResponse, ProtocolLiquidityTokensResponse } from '~/api/types'
import { V2_SERVER_URL } from '~/constants'
import { chainCoingeckoIdsForGasNotMcap } from '~/constants/chainTokens'
import { CHART_COLORS } from '~/constants/colors'
import { fetchAdapterProtocolMetrics } from '~/containers/AdapterMetrics/api'
import { getSponsoredResearchReports } from '~/containers/Articles/api'
import { fetchBridgeVolumeBySlug } from '~/containers/Bridges/api'
import { governanceIdsToApis } from '~/containers/Governance/api'
import { getProtocolIncentivesFromAggregatedEmissions } from '~/containers/Incentives/queries'
import { fetchOracleMetrics, fetchOracleProtocolChart } from '~/containers/Oracles/api'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import type { TokenMarketSummary } from '~/containers/Tokens/types'
import { fetchTreasuries } from '~/containers/Treasuries/api'
import type { ProtocolEmissionSupplyMetricsMap } from '~/containers/Unlocks/api.types'
import { readYieldsMeta, type YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { YieldsMeta } from '~/containers/Yields/data/types'
import { TVL_SETTINGS_KEYS_SET } from '~/contexts/LocalStorage'
import { capitalizeFirstLetter, slug } from '~/utils'
import { fetchJson, getFastJsonTimeoutMs } from '~/utils/async'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { buildProtocolOverviewHallmarks } from '~/utils/hallmarks'
import type { IChainMetadata, IProtocolMetadata, ITokenListEntry } from '~/utils/metadata/types'
import { optionalPageData } from '~/utils/optionalPageData'
import { findTokenPageRoute, type TokenDirectory } from '~/utils/tokenDirectory'
import { fetchProtocolExpenses, fetchProtocolOverviewMetrics, fetchProtocolTvlChart } from './api'
import type {
	IIncomeStatementApiResponse,
	IncomeStatementMetric,
	IncomeStatementPeriod,
	IncomeStatementPeriods,
	IProtocolMetricsV2,
	IProtocolValueChart
} from './api.types'
import { resolveProtocolCategory } from './category'
import { normalizeSeriesToMilliseconds } from './chartSeries.utils'
import { oracleProtocols } from './constants'
import { buildAvailableCharts, buildDefaultToggledCharts } from './defaultCharts'
import { buildProtocolFaq, buildProtocolFaqRelationship } from './faq'
import { formatAdapterData } from './formatAdapterData'
import type { IProtocolOverviewPageData, IProtocolPageMetrics } from './types'
import { getProtocolWarningBanners } from './utils'

type IProtocolDataExtended = IProtocolMetricsV2 & {
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
		stablecoins: !!metadata.stablecoins || (!!metadata.cex && !!metadata.tvl),
		bridge: !!metadata.bridge,
		treasury: !!metadata.treasury,
		unlocks: !!metadata.emissions,
		incentives: !!metadata.incentives,
		yields: !!metadata.yields,
		fees: !!metadata.fees,
		revenue: !!metadata.revenue,
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

type IProtocolTvlChartSeedResult = {
	data: IProtocolValueChart
	failed: boolean
}

export const getProtocolOverviewPageData = async ({
	protocolId,
	currentProtocolMetadata,
	isCEX = false,
	chainMetadata,
	tokenlist,
	cgExchangeIdentifiers,
	emissionsSupplyMetrics,
	tokenDirectory = null,
	yieldsSnapshot,
	includeFaq = true,
	getTokenMarketSummary = null,
	researchSponsorEntitySlug
}: {
	protocolId: string
	currentProtocolMetadata: IProtocolMetadata
	isCEX?: boolean
	chainMetadata: Record<string, IChainMetadata>
	tokenlist: Record<string, ITokenListEntry>
	cgExchangeIdentifiers: string[]
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
	tokenDirectory?: TokenDirectory | null
	yieldsSnapshot: YieldsSnapshot | null
	includeFaq?: boolean
	getTokenMarketSummary?: ((geckoId: string) => Promise<TokenMarketSummary | null>) | null
	researchSponsorEntitySlug?: string
}): Promise<IProtocolOverviewPageData> => {
	const displayName = currentProtocolMetadata.displayName ?? ''
	const currentProtocolSlug = slug(displayName)
	const oracleProtocolName = (oracleProtocols as Record<string, string>)[displayName] ?? null
	const isOracleProtocol = Boolean(oracleProtocolName)
	const optionalProtocolData = <T,>(label: string, run: () => Promise<T>, fallback: T): Promise<T> =>
		optionalPageData(`protocol:${currentProtocolSlug}:${label}`, run, fallback)
	const researchReportsPromise = optionalProtocolData(
		'research',
		() =>
			getSponsoredResearchReports(isCEX ? 'cex' : 'protocol', researchSponsorEntitySlug ?? currentProtocolSlug, {
				limit: 3
			}).then((result) => result.reports),
		[]
	)
	const protocolDataPromise = fetchProtocolOverviewMetrics(currentProtocolSlug).then(
		async (data): Promise<IProtocolDataExtended> => {
			try {
				const geckoId = data.gecko_id ?? currentProtocolMetadata.gecko_id ?? null
				const tokenEntry = geckoId ? (tokenlist[geckoId] ?? null) : null
				const tickers =
					tokenEntry && geckoId
						? await fetchCoinGeckoChartByIdWithCacheFallback(geckoId, {
								timeframe: 'MAX',
								includeCoinData: true
							})
								.then((res) => res?.data?.coinData?.tickers)
								.catch(() => undefined)
						: undefined
				return {
					...data,
					tokenCGData: getTokenCGData(tokenEntry, tickers, cgExchangeIdentifiers)
				}
			} catch (e) {
				console.log('[HTTP]:[ERROR]:[TOKEN_CG_DATA]:', e)
				return data
			}
		}
	)
	const tokenMarketSummaryPromise = protocolDataPromise.then((data) => {
		const geckoId = data.gecko_id ?? currentProtocolMetadata.gecko_id ?? null
		return includeFaq && !isCEX && geckoId && getTokenMarketSummary
			? optionalProtocolData('token_market_summary', () => getTokenMarketSummary(geckoId), null)
			: null
	})

	const [
		protocolData,
		protocolTvlChartSeed,
		feesData,
		revenueData,
		holdersRevenueData,
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
		gasUsed,
		gasUsedUsd,
		expenses,
		yieldsConfig,
		liquidityInfo,
		liteProtocolsData,
		bridgeVolumeData,
		incomeStatement,
		oracleChartData,
		oracleTvs,
		blockExplorersData,
		tokenMarketSummary
	] = await Promise.all([
		protocolDataPromise,
		currentProtocolMetadata.tvl && !isOracleProtocol
			? fetchProtocolTvlChart({
					protocol: currentProtocolSlug,
					timeout: getFastJsonTimeoutMs()
				})
					.then(
						(chart): IProtocolTvlChartSeedResult => ({
							data: chart,
							failed: false
						})
					)
					.catch((err): IProtocolTvlChartSeedResult => {
						console.log(
							'[HTTP]:[ERROR]:[PROTOCOL_TVL_CHART]:',
							currentProtocolSlug,
							err instanceof Error ? err.message : err
						)
						return { data: [], failed: true }
					})
			: Promise.resolve<IProtocolTvlChartSeedResult>({
					data: [],
					failed: false
				}),
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
		currentProtocolMetadata.dexs
			? fetchAdapterProtocolMetrics({
					adapterType: 'dexs',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) =>
					formatAdapterData({
						data,
						methodologyKey: typeof data.methodology !== 'string' && data.methodology?.['Volume'] ? 'Volume' : 'dexs'
					})
				)
			: Promise.resolve(null),
		currentProtocolMetadata.dexsNotionalVolume
			? fetchAdapterProtocolMetrics({
					adapterType: 'dexs',
					dataType: 'dailyNotionalVolume',
					protocol: currentProtocolMetadata.displayName ?? ''
				}).then((data) =>
					formatAdapterData({
						data,
						methodologyKey:
							typeof data.methodology !== 'string' && data.methodology?.NotionalVolume
								? 'NotionalVolume'
								: 'dexsNotionalVolume'
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
							.then((res) => res.find((item) => item.id === `${protocolId}-treasury`)?.tokenBreakdowns ?? null)
							.then((res): IProtocolOverviewPageData['treasury'] => {
								if (!res) return null
								return {
									majors: res.majors,
									stablecoins: res.stablecoins,
									ownTokens: res.ownTokens,
									others: res.others,
									total: res.majors + res.stablecoins + res.ownTokens + res.others
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
							protocol: displayName,
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
							protocol: displayName,
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
							protocol: displayName,
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
							protocol: displayName,
							adapterType: 'active-users',
							dataType: 'dailyGasUsed'
						}).then((data) => data?.total24h ?? null),
					null
				)
			: Promise.resolve(null),
		currentProtocolMetadata.gasUsed
			? optionalProtocolData(
					'gas_used_usd',
					() =>
						fetchAdapterProtocolMetrics({
							protocol: displayName,
							adapterType: 'active-users',
							dataType: 'dailyGasUsedUsd'
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
			? optionalProtocolData<YieldsMeta | null>('liquidity_yields_config', () => readYieldsMeta(yieldsSnapshot), null)
			: Promise.resolve(null),
		currentProtocolMetadata?.liquidity
			? optionalProtocolData('liquidity_tokens', () => fetchLiquidityTokensDataset(), [])
			: Promise.resolve([]),
		fetchProtocols().catch(
			(): ProtocolsResponse => ({
				protocols: [],
				chains: [],
				parentProtocols: [],
				protocolCategories: []
			})
		),
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
					() => fetchOracleProtocolChart({ protocol: oracleProtocolName }).then(normalizeSeriesToMilliseconds),
					null
				)
			: Promise.resolve(null),
		oracleProtocolName
			? optionalProtocolData(
					'oracle_metrics',
					() =>
						fetchOracleMetrics().then((data): Record<string, number> | null => {
							const memberNames = data.oracles[oracleProtocolName]
							const protocolTvsByOracle = data.oraclesTVS[oracleProtocolName]
							if (!memberNames?.length || !protocolTvsByOracle) return null
							const tvs: Record<string, number> = {}

							for (const memberName of memberNames) {
								const chainTvs = protocolTvsByOracle[memberName]
								if (!chainTvs) continue
								for (const chain in chainTvs) {
									const nestedValue = chainTvs[chain]
									if (nestedValue === undefined) continue
									tvs[chain] = (tvs[chain] ?? 0) + nestedValue
								}
							}
							return tvs
						}),
					null
				)
			: Promise.resolve(null),
		fetchBlockExplorers().catch((): BlockExplorersResponse => []),
		tokenMarketSummaryPromise
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
			const project = agg[pool.project] ?? (agg[pool.project] = {})
			project[pool.chain] = pool.tvlUsd + (project[pool.chain] ?? 0)
			return agg
		},
		{} as Record<string, Record<string, number>>
	)

	const protocolNameBySlug = new Map<string, string>()
	if (yieldsConfig) {
		for (const protocol of yieldsConfig.protocols) protocolNameBySlug.set(protocol.slug, protocol.name)
	}
	const tokenLiquidity = yieldsConfig
		? (() => {
				const rows: Array<[string, string, number]> = []
				for (const protocolSlug in liquidityAggregated) {
					const protocolName = protocolNameBySlug.get(protocolSlug) ?? protocolSlug
					const chainValues = liquidityAggregated[protocolSlug]
					if (!chainValues) continue
					for (const chainName in chainValues) {
						const value = chainValues[chainName]
						if (value !== undefined) rows.push([protocolName, chainName, value])
					}
				}
				rows.sort((a: [string, string, number], b: [string, string, number]) => b[2] - a[2])
				return rows
			})()
		: ([] as Array<[string, string, number]>)

	const raises = protocolData.raises
		.slice()
		.sort((a, b) => a.date - b.date)
		.map((r) => ({
			...r,
			investors: r.leadInvestors.concat(r.otherInvestors)
		}))
	const currentTvlByChain = currentProtocolMetadata.tvl ? protocolData.currentChainTvls : null
	const hasFeeFamilyMetrics = (data: Awaited<ReturnType<typeof formatAdapterData>>) =>
		data != null &&
		(data.annualized1y != null ||
			data.total30d != null ||
			data.total7d != null ||
			data.total24h != null ||
			data.totalAllTime != null)
	const hasStandardAdapterMetrics = (data: Awaited<ReturnType<typeof formatAdapterData>>) =>
		data != null &&
		(data.total30d != null || data.total7d != null || data.total24h != null || data.totalAllTime != null)
	const hasIncentiveMetrics =
		incentives != null &&
		(incentives.emissions1y != null ||
			incentives.emissions30d != null ||
			incentives.emissions7d != null ||
			incentives.emissions24h != null ||
			incentives.emissionsAllTime != null)

	const hasKeyMetrics = Boolean(
		protocolData.currentChainTvls.staking != null ||
		protocolData.currentChainTvls.borrowed != null ||
		raises.length ||
		expenses ||
		treasury ||
		tokenLiquidity?.length ||
		hasFeeFamilyMetrics(feesData) ||
		hasFeeFamilyMetrics(revenueData) ||
		hasFeeFamilyMetrics(holdersRevenueData) ||
		hasIncentiveMetrics ||
		hasStandardAdapterMetrics(dexVolumeData) ||
		hasStandardAdapterMetrics(dexNotionalVolumeData) ||
		hasStandardAdapterMetrics(perpVolumeData) ||
		hasStandardAdapterMetrics(dexAggregatorVolumeData) ||
		hasStandardAdapterMetrics(perpAggregatorVolumeData) ||
		hasStandardAdapterMetrics(bridgeAggregatorVolumeData) ||
		hasStandardAdapterMetrics(optionsPremiumVolumeData) ||
		hasStandardAdapterMetrics(optionsNotionalVolumeData) ||
		hasStandardAdapterMetrics(liquidationVolumeData) ||
		hasStandardAdapterMetrics(collateralLiquidatedData) ||
		openInterestData?.total24h != null ||
		bridgeVolumeData?.length ||
		isOracleProtocol ||
		protocolData.tokenCGData
	)

	const resolvedProtocolChains = protocolData.chains.length
		? protocolData.chains
		: (currentProtocolMetadata.chains ?? [])
	const relationship = buildProtocolFaqRelationship({
		protocolId,
		protocolName: protocolData.name,
		category: resolvedCategory,
		isParent: Boolean(protocolData.isParentProtocol || protocolId.startsWith('parent#')),
		chains: resolvedProtocolChains,
		protocols: liteProtocolsData.protocols
	})
	const competitorsList =
		relationship.comparison?.peers.map((peer) => ({
			name: peer.name,
			tvl: peer.tvl
		})) ?? []

	const hacks = protocolData.hacks.toSorted((a, b) => (a.date ?? 0) - (b.date ?? 0))

	const protocolMetrics = getProtocolMetricFlags({
		protocolData,
		metadata: currentProtocolMetadata
	})

	const chains: Array<[string, number]> = []
	const currentChainTvlsObj = protocolData.currentChainTvls
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
	const tokenGeckoId = protocolData.gecko_id ?? currentProtocolMetadata.gecko_id ?? null
	const chartDenominations: Array<{ symbol: string; geckoId?: string | null }> = []
	if (firstChain && !isCEX) {
		chartDenominations.push({ symbol: 'USD', geckoId: null })

		const cmetadata = chainMetadata?.[slug(firstChain)]
		const chainGas = cmetadata ? chainCoingeckoIdsForGasNotMcap[cmetadata.name] : undefined
		if (chainGas) {
			chartDenominations.push({
				symbol: chainGas.symbol,
				geckoId: chainGas.geckoId
			})
		} else if (cmetadata?.gecko_id) {
			chartDenominations.push({
				symbol: cmetadata.tokenSymbol ?? '',
				geckoId: cmetadata.gecko_id
			})
		} else {
			const ethereumGeckoId = chainMetadata?.['ethereum']?.gecko_id
			chartDenominations.push({
				symbol: 'ETH',
				...(ethereumGeckoId !== undefined ? { geckoId: ethereumGeckoId } : {})
			})
		}
	}

	const protocolTvlChartData = protocolTvlChartSeed.data
	const availableCharts = buildAvailableCharts({
		isCEX,
		hasTvlChart: Boolean(currentProtocolMetadata.tvl && !isOracleProtocol),
		hasTvsChart: isOracleProtocol,
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
		hasStaking: protocolData.currentChainTvls.staking != null,
		hasBorrowed: protocolData.currentChainTvls.borrowed != null,
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
	for (let index = 0; index < availableCharts.length; index++) {
		const chart = availableCharts[index]
		if (chart === undefined) continue
		const color = CHART_COLORS[index]
		if (!color) throw new Error(`Missing protocol chart color at index ${index}`)
		chartColors[chart] = color
	}

	const { hallmarks, rangeHallmarks } = buildProtocolOverviewHallmarks({
		hacks,
		protocolHallmarks: protocolData.hallmarks,
		dimensions: protocolData.dimensions
	})

	const name = protocolData.name

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
		currentChainTvls: protocolData.currentChainTvls,
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
	const formattedExpenses = expenses
		? (() => {
				const annualUsdCost: Array<[string, number]> = []
				let total = 0
				for (const category in expenses.annualUsdCost) {
					const amount = expenses.annualUsdCost[category]
					if (amount === undefined) continue
					annualUsdCost.push([capitalizeFirstLetter(category), amount])
					total += amount
				}
				return {
					headcount: expenses.headcount ?? null,
					annualUsdCost,
					total,
					sources: expenses.sources ?? null,
					notes: expenses.notes ?? null,
					lastUpdate: expenses.lastUpdate ?? null
				}
			})()
		: null

	const pageData: IProtocolOverviewPageData = {
		id: protocolData.id,
		name: name,
		category: resolvedCategory,
		tags: protocolData.tags ?? null,
		otherProtocols: protocolData.otherProtocols ?? null,
		...(relationship.children.length
			? {
					childProtocols: relationship.children.map((child) => ({
						name: child.name,
						href: child.href,
						category: child.category,
						chains: child.chains
					}))
				}
			: {}),
		deprecated: protocolData.deprecated ?? false,
		chains: resolvedProtocolChains,
		currentTvlByChain,
		description: protocolData.description ?? '',
		website: protocolData.referralUrl?.trim() || protocolData.url.trim() || null,
		isWebsiteReferral: Boolean(protocolData.referralUrl?.trim()),
		twitter: protocolData.twitter ?? null,
		safeHarbor: currentProtocolMetadata.safeHarbor ?? false,
		github: protocolData.github ?? null,
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
				defillamaId: protocolData.id,
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
			activeUsers != null || newUsers != null || transactions != null || gasUsed != null || gasUsedUsd != null
				? {
						activeUsers: activeUsers ?? null,
						newUsers: newUsers ?? null,
						transactions: transactions ?? null,
						gasUsed: gasUsed ?? null,
						gasUsedUsd: gasUsedUsd ?? null
					}
				: null,
		raises: raises.length ? raises : null,
		expenses: formattedExpenses,
		tokenLiquidity:
			tokenLiquidity?.length > 0
				? {
						pools: tokenLiquidity,
						total: tokenLiquidity.reduce((acc, curr) => acc + curr[2], 0)
					}
				: null,
		tokenCGData: protocolData.tokenCGData ?? null,
		outstandingFDV:
			adjustedSupply != null && protocolData.tokenCGData?.price?.current != null
				? adjustedSupply * protocolData.tokenCGData.price.current
				: null,
		audits:
			protocolData.audits && +protocolData.audits > 0
				? {
						total: +protocolData.audits,
						auditLinks: protocolData.audit_links ?? [],
						note: null
					}
				: null,
		isCEX,
		researchSponsorEntity: {
			entityType: isCEX ? 'cex' : 'protocol',
			entitySlug: researchSponsorEntitySlug ?? currentProtocolSlug
		},
		hasKeyMetrics,
		competitors: competitorsList,
		hacks,
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
		isOracleProtocol,
		oracleTvs
	}

	if (isCEX || !includeFaq) return pageData

	const chainTvl = protocolData.currentChainTvls
	const hasCurrentChainTvl = resolvedProtocolChains.some((chain) => chainTvl[chain] != null)
	const currentTvlFromChains = hasCurrentChainTvl
		? resolvedProtocolChains.reduce((total, chain) => total + (chainTvl[chain] ?? 0), 0)
		: null
	const tvlSummary = getProtocolFaqTvlSummary(
		protocolTvlChartData,
		currentProtocolMetadata.tvl ? currentTvlFromChains : null
	)
	pageData.faqItems = buildProtocolFaq({
		name,
		tvl: tvlSummary,
		chains: resolvedProtocolChains.map((chain) => ({
			name: chain,
			tvl: chainTvl[chain] ?? null,
			href: chainMetadata[slug(chain)] ? `/chain/${slug(chain)}` : null
		})),
		fees: {
			fees30d: feesData?.total30d ?? null,
			revenue30d: revenueData?.total30d ?? null,
			annualizedFees: feesData?.annualized1y ?? null,
			annualizedRevenue: revenueData?.annualized1y ?? null
		},
		token: tokenMarketSummary
			? {
					...tokenMarketSummary,
					tokenPageRoute: pageData.token.tokenPageRoute ?? null
				}
			: null,
		comparison: relationship.comparison,
		children: relationship.children,
		useChildrenQuestion: relationship.useChildrenQuestion,
		treasury,
		hacks: hacks.map((hack) => ({
			date: hack.date,
			amountUsd: hack.amountUsd,
			classification: hack.classification
		})),
		metrics: {
			borrowed: protocolData.currentChainTvls.borrowed ?? null,
			dexVolume30d: dexVolumeData?.total30d ?? null,
			perpVolume30d: perpVolumeData?.total30d ?? null,
			openInterest: openInterestData?.total24h ?? null,
			yieldPoolCount: yields?.noOfPoolsTracked ?? null,
			averageApy: yields?.averageAPY ?? null
		}
	})

	return pageData
}

function getProtocolFaqTvlSummary(
	chart: IProtocolValueChart,
	fallbackCurrent: number | null
): {
	current: number | null
	change30d: number | null
} {
	const latest = chart.at(-1)
	if (!latest) return { current: fallbackCurrent, change30d: null }

	const targetTimestamp = latest[0] - 30 * 24 * 60 * 60 * 1000
	const current = fallbackCurrent ?? latest[1]
	let previous: [number, number] | null = null
	for (let index = chart.length - 1; index >= 0; index -= 1) {
		const point = chart[index]
		if (point && point[0] <= targetTimestamp) {
			previous = point
			break
		}
	}
	const change30d = previous && previous[1] !== 0 ? ((current - previous[1]) / previous[1]) * 100 : null
	return { current, change30d }
}

function getTokenCGData(
	tokenEntry: ITokenListEntry | null,
	tickers: NonNullable<NonNullable<CgChartResponse['data']>['coinData']>['tickers'] | undefined,
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

type IncomeStatementSource = { kind: 'protocol'; metadata: IProtocolMetadata } | { kind: 'token'; token: string }

type IncomeStatementMethodologySource = Pick<
	IIncomeStatementApiResponse,
	'methodology' | 'breakdownMethodology' | 'childProtocols'
>

export function buildIncomeStatementMethodologies(source: IncomeStatementMethodologySource): {
	methodology: Record<string, string>
	breakdownMethodology: Record<string, Record<string, string>>
} {
	const methodology: Record<string, string> = {}
	if (source.methodology) {
		for (const label in source.methodology) {
			const text = source.methodology[label]
			if (text !== undefined) methodology[label] = text
		}
	}

	const breakdownMethodology: Record<string, Record<string, string>> = {}
	const copyBreakdown = (label: string, breakdown: Record<string, string>) => {
		const copy: Record<string, string> = {}
		for (const breakdownLabel in breakdown) {
			const text = breakdown[breakdownLabel]
			if (text !== undefined) copy[breakdownLabel] = text
		}
		breakdownMethodology[label] = copy
	}
	if (source.breakdownMethodology) {
		for (const label in source.breakdownMethodology) {
			const value = source.breakdownMethodology[label]
			if (typeof value === 'string') methodology[label] = value
			else if (value !== undefined) copyBreakdown(label, value)
		}
	}

	if (source.methodology != null || !source.childProtocols) return { methodology, breakdownMethodology }

	const methodologyByLabel = new Map<string, Set<string>>()
	const breakdownByLabel = new Map<string, Map<string, Set<string>>>()
	const addMethodology = (label: string, text: string) => {
		let texts = methodologyByLabel.get(label)
		if (!texts) {
			texts = new Set()
			methodologyByLabel.set(label, texts)
		}
		texts.add(text)
	}
	const addBreakdown = (label: string, breakdown: Record<string, string>) => {
		let byBreakdownLabel = breakdownByLabel.get(label)
		if (!byBreakdownLabel) {
			byBreakdownLabel = new Map()
			breakdownByLabel.set(label, byBreakdownLabel)
		}
		for (const breakdownLabel in breakdown) {
			const text = breakdown[breakdownLabel]
			if (text === undefined) continue
			let texts = byBreakdownLabel.get(breakdownLabel)
			if (!texts) {
				texts = new Set()
				byBreakdownLabel.set(breakdownLabel, texts)
			}
			texts.add(text)
		}
	}

	for (const child of source.childProtocols) {
		if (child.methodology) {
			for (const label in child.methodology) {
				const text = child.methodology[label]
				if (text !== undefined) addMethodology(label, text)
			}
		}
		if (child.breakdownMethodology) {
			for (const label in child.breakdownMethodology) {
				const value = child.breakdownMethodology[label]
				if (typeof value === 'string') addMethodology(label, value)
				else if (value !== undefined) addBreakdown(label, value)
			}
		}
	}

	for (const [label, texts] of methodologyByLabel) {
		if (texts.size === 1) {
			const text = texts.values().next().value
			if (text) methodology[label] = text
			continue
		}
		const parts: string[] = []
		for (const child of source.childProtocols) {
			const childValue = child.methodology ? child.methodology[label] : child.breakdownMethodology?.[label]
			if (typeof childValue === 'string') parts.push(`${child.displayName}: ${childValue}`)
		}
		methodology[label] = parts.join('\n')
	}

	for (const [label, breakdownSets] of breakdownByLabel) {
		const output: Record<string, string> = {}
		breakdownMethodology[label] = output
		for (const [breakdownLabel, texts] of breakdownSets) {
			if (texts.size === 1) {
				const text = texts.values().next().value
				if (text) output[breakdownLabel] = text
				continue
			}
			const parts: string[] = []
			for (const child of source.childProtocols) {
				const value = child.breakdownMethodology?.[label]
				if (value && typeof value === 'object' && value[breakdownLabel]) {
					parts.push(`${child.displayName}: ${value[breakdownLabel]}`)
				}
			}
			output[breakdownLabel] = parts.join('\n')
		}
	}

	return { methodology, breakdownMethodology }
}

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
			return fetchJson<NonNullable<IProtocolOverviewPageData['incomeStatement']> | null>(
				`/api/public/income-statement?protocol=${encodeURIComponent(protocol)}&version=2`
			).catch(() => null)
		}

		const entity = source.kind === 'protocol' ? source.metadata.displayName : source.token
		const incomeStatement = await fetchJson<IIncomeStatementApiResponse>(
			`${V2_SERVER_URL}/metrics/financial-statement/${source.kind}/${slug(entity)}?q=30`
		)
		const aggregates = normalizeIncomeStatementAggregates(incomeStatement.aggregates)

		const labelsByType: Record<string, Set<string>> = {}
		const metricTypes = new Set<string>()

		// Collect all breakdown labels and metric type names present in the raw aggregates.
		// The table UI renders breakdown rows based on `labelsByType`, while the Sankey reads `by-label` directly.
		// If this isn't computed, breakdown rows will be missing in the table even when `by-label` data exists.
		for (const aggregateKey of ['monthly', 'quarterly', 'yearly'] as const) {
			const periods = aggregates[aggregateKey]
			for (const period in periods) {
				const periodData = periods[period]
				if (periodData === undefined) continue
				for (const type in periodData.values) {
					metricTypes.add(type)
					const byLabel = periodData.values[type]?.['by-label']
					if (!byLabel) continue
					for (const breakdownLabel in byLabel) {
						const labels = labelsByType[type] ?? (labelsByType[type] = new Set())
						labels.add(breakdownLabel)
					}
				}
			}
		}

		const cumulativeMetrics: Record<string, NormalizedIncomeStatementMetric> = {}
		let hasCumulativeMetrics = false
		let latestMonthlyTimestamp = 0

		const monthlyPeriods = aggregates.monthly
		for (const period in monthlyPeriods) {
			const periodData = monthlyPeriods[period]
			if (periodData === undefined) continue
			latestMonthlyTimestamp = Math.max(latestMonthlyTimestamp, periodData.timestamp)

			for (const label in periodData.values) {
				const entry = periodData.values[label]
				if (!entry) continue

				let cumulativeEntry = cumulativeMetrics[label]
				if (cumulativeEntry === undefined) {
					cumulativeEntry = { value: 0 }
					cumulativeMetrics[label] = cumulativeEntry
					hasCumulativeMetrics = true
				}

				cumulativeEntry.value += entry.value

				const entryByLabel = entry['by-label']
				if (entryByLabel === undefined) continue
				const cumulativeByLabel = cumulativeEntry['by-label'] ?? (cumulativeEntry['by-label'] = {})
				for (const breakdownLabel in entryByLabel) {
					const value = entryByLabel[breakdownLabel]
					if (value === undefined) continue
					cumulativeByLabel[breakdownLabel] = (cumulativeByLabel[breakdownLabel] ?? 0) + value
				}
			}
		}

		const cumulative: NormalizedIncomeStatementPeriods = {}
		if (hasCumulativeMetrics) {
			cumulative.cumulative = {
				timestamp: latestMonthlyTimestamp,
				values: cumulativeMetrics
			}
		}

		const finalLabelsByType: Record<string, Array<string>> = {}
		for (const label in labelsByType) {
			const labels = labelsByType[label]
			if (labels) finalLabelsByType[label] = Array.from(labels)
		}

		const { methodology, breakdownMethodology } = buildIncomeStatementMethodologies(incomeStatement)

		methodology['Earnings'] = 'Gross Profit minus Incentives'

		return {
			data: { ...aggregates, cumulative },
			labelsByType: finalLabelsByType,
			methodology: methodology,
			breakdownMethodology: breakdownMethodology,
			hasOtherTokenHolderFlows: metricTypes.has('Others Token Holder Flows'),
			hasTokenHolderNetIncome: metricTypes.has('Token Holder Net Income'),
			...(incomeStatement.components === undefined ? {} : { components: incomeStatement.components })
		}
	} catch (err) {
		if (typeof window === 'undefined') {
			throw err
		}
		return null
	}
}

type NormalizedIncomeStatementMetric = {
	value: number
	'by-label'?: Record<string, number>
}
type NormalizedIncomeStatementPeriod = {
	timestamp: number
	values: Record<string, NormalizedIncomeStatementMetric>
}
type NormalizedIncomeStatementPeriods = Record<string, NormalizedIncomeStatementPeriod>

const getIncomeStatementPeriodTimestamp = (period: string): number => {
	if (!period.includes('Q')) return new Date(period.length === 4 ? `${period}-01-01` : period).getTime()
	const [year = '', quarterLabel = ''] = period.split('-')
	const month = ((parseInt(quarterLabel.replace('Q', '')) - 1) * 3 + 1).toString().padStart(2, '0')
	return new Date(`${year}-${month}`).getTime()
}

const normalizeIncomeStatementPeriods = (periods: IncomeStatementPeriods): NormalizedIncomeStatementPeriods => {
	const normalized: NormalizedIncomeStatementPeriods = {}
	for (const period in periods) {
		const rawPeriod: IncomeStatementPeriod | undefined = periods[period]
		if (rawPeriod === undefined) continue
		const metrics: Record<string, NormalizedIncomeStatementMetric> = {}
		for (const label in rawPeriod) {
			const metric: IncomeStatementMetric | undefined = rawPeriod[label]
			if (metric === undefined) continue
			const byLabel = metric['by-label']
			metrics[label] = {
				value: metric.value,
				...(byLabel === undefined ? {} : { 'by-label': { ...byLabel } })
			}
		}
		normalized[period] = {
			timestamp: getIncomeStatementPeriodTimestamp(period),
			values: metrics
		}
	}
	return normalized
}

export const normalizeIncomeStatementAggregates = (aggregates: IIncomeStatementApiResponse['aggregates']) => ({
	monthly: normalizeIncomeStatementPeriods(aggregates.monthly),
	quarterly: normalizeIncomeStatementPeriods(aggregates.quarterly),
	yearly: normalizeIncomeStatementPeriods(aggregates.yearly)
})
