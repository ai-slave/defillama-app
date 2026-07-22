import type { LlamaConfigResponse } from '~/api/types'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import { CONFIG_API } from '~/constants'
import { CHART_COLORS } from '~/constants/colors'
import { getNDistinctColors, slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { isDeprecatedChain } from '~/utils/metadata/deprecatedChains'
import { getFreshTimeSeriesCurrentPoint } from '~/utils/timeSeries'
import {
	fetchBridgeDayStats,
	fetchBridges,
	fetchBridgeLargeTransactions,
	fetchBridgeNetflows,
	fetchBridgeTxCounts,
	fetchBridgeVolumeAll,
	fetchBridgeVolumeByChain
} from './api'
import type {
	RawBridgeDayStats,
	RawBridgeDayStatsResponse,
	RawBridgeLargeTransactionsResponse,
	RawBridgeNetflowsResponse,
	RawBridgeVolumePoint
} from './api.types'
import { formatBridgeOverviewVolumeData } from './bridgeOverviewVolumeData'
import type {
	BridgeNetflowChartData,
	BridgeNetflowChartPoint,
	BridgePageData,
	BridgeTableData,
	BridgeVolumeChartPoint
} from './types'
import { formatBridgesData, formatChainsData } from './utils'

const EMPTY_DAY_STATS: RawBridgeDayStats = {
	date: 0,
	totalDepositedUSD: 0,
	totalWithdrawnUSD: 0,
	totalDepositTxs: 0,
	totalWithdrawalTxs: 0,
	totalTokensDeposited: {},
	totalTokensWithdrawn: {},
	totalAddressDeposited: {},
	totalAddressWithdrawn: {}
}

function prepareBridgeNetflowChartData(data: RawBridgeNetflowsResponse): BridgeNetflowChartPoint[] {
	const nonZeroData: BridgeNetflowChartPoint[] = []
	for (const item of data) {
		if (item.net_flow === '0') continue
		nonZeroData.push({ chain: item.chain, value: Number(item.net_flow) })
	}

	nonZeroData.sort((a, b) => Math.abs(a.value) - Math.abs(b.value))
	const topFlows = nonZeroData.slice(-15)
	topFlows.sort((a, b) => a.value - b.value)
	return topFlows
}

const isBridgeDayStatsResponse = (value: RawBridgeDayStatsResponse): value is RawBridgeDayStats => {
	return (
		typeof value === 'object' &&
		value !== null &&
		'date' in value &&
		'totalTokensDeposited' in value &&
		'totalTokensWithdrawn' in value &&
		'totalAddressDeposited' in value &&
		'totalAddressWithdrawn' in value
	)
}

const asBridgeDayStats = (value: RawBridgeDayStatsResponse): RawBridgeDayStats => {
	return isBridgeDayStatsResponse(value) ? value : EMPTY_DAY_STATS
}

type FetchFallbackOptions<T> = {
	fallback?: T
	context: string
	throwOnFailure?: boolean
	onFailureError?: () => Error
}

async function fetchOrFallback<T>(operation: () => Promise<T>, options: FetchFallbackOptions<T>): Promise<T> {
	const { fallback, context, throwOnFailure = false, onFailureError } = options
	try {
		return await operation()
	} catch (error) {
		console.log(`[bridges][fetch-failed] ${context}`, error)

		if (throwOnFailure) {
			throw onFailureError ? onFailureError() : new Error(`${context} failed`)
		}

		return fallback as T
	}
}

type VolumeByDate = {
	[date: number]: BridgeVolumeChartPoint
}

type TokenTableUnformattedRow = {
	deposited?: number
	withdrawn?: number
	volume?: number
}

type AddressTableUnformattedRow = {
	deposited?: number
	withdrawn?: number
	txs?: number
}

type TokenMapValue = {
	symbol: string
	usdValue: number
}

type AddressMapValue = {
	txs: number
	usdValue: number
}

export function buildVolumeDataByChain({
	volume,
	chains,
	destinationChain
}: {
	volume: RawBridgeVolumePoint[][]
	chains: string[]
	destinationChain: string
}): BridgePageData['volumeDataByChain'] {
	const volumeDataByChain: BridgePageData['volumeDataByChain'] = {}
	const volumeOnAllChains: VolumeByDate = {}
	const normalizeDailyBridgePoints = (points: BridgeVolumeChartPoint[]): BridgeVolumeChartPoint[] => {
		const normalized: BridgeVolumeChartPoint[] = []
		for (const point of points) {
			const utcDay = Math.floor(point.date / 86400) * 86400
			const last = normalized[normalized.length - 1]
			if (last?.date === utcDay) {
				last.Deposited += point.Deposited
				last.Withdrawn += point.Withdrawn
			} else {
				normalized.push({
					date: utcDay,
					Deposited: point.Deposited,
					Withdrawn: point.Withdrawn
				})
			}
		}
		return normalized
	}

	for (let index = 0; index < volume.length; index++) {
		const chainVolume = volume[index]
		const chartData: BridgeVolumeChartPoint[] = []

		for (const item of chainVolume) {
			const date = Number(item.date)
			chartData.push({ date, Deposited: item.depositUSD ?? 0, Withdrawn: -(item.withdrawUSD ?? 0) })

			if (!volumeOnAllChains[date]) {
				volumeOnAllChains[date] = { date, Deposited: 0, Withdrawn: 0 }
			}

			volumeOnAllChains[date] = {
				date,
				Deposited: volumeOnAllChains[date].Deposited + (item.depositUSD || 0),
				Withdrawn: volumeOnAllChains[date].Withdrawn - (item.withdrawUSD || 0)
			}
		}

		volumeDataByChain[chains[index]] = normalizeDailyBridgePoints(chartData)
	}

	const destinationChainVolume = volumeDataByChain[destinationChain] ?? []
	volumeDataByChain['All Chains'] =
		destinationChain !== 'false' && destinationChainVolume.length > 0
			? normalizeDailyBridgePoints(destinationChainVolume)
			: normalizeDailyBridgePoints(Object.values(volumeOnAllChains))

	return volumeDataByChain
}

function buildPrevDayDataByChain({
	statsOnPrevDay,
	chains,
	destinationChain
}: {
	statsOnPrevDay: RawBridgeDayStats[]
	chains: string[]
	destinationChain: string
}): Record<string, RawBridgeDayStats> {
	const prevDayDataByChain: Record<string, RawBridgeDayStats> = {}

	for (let index = 0; index < statsOnPrevDay.length; index++) {
		const data = statsOnPrevDay[index]
		const allChainsData = prevDayDataByChain['All Chains']
		prevDayDataByChain['All Chains'] = {
			date: Math.max(allChainsData?.date ?? 0, data.date),
			totalDepositedUSD:
				allChainsData?.totalDepositedUSD == null && data.totalDepositedUSD == null
					? undefined
					: (allChainsData?.totalDepositedUSD ?? 0) + (data.totalDepositedUSD ?? 0),
			totalWithdrawnUSD:
				allChainsData?.totalWithdrawnUSD == null && data.totalWithdrawnUSD == null
					? undefined
					: (allChainsData?.totalWithdrawnUSD ?? 0) + (data.totalWithdrawnUSD ?? 0),
			totalDepositTxs:
				allChainsData?.totalDepositTxs == null && data.totalDepositTxs == null
					? undefined
					: (allChainsData?.totalDepositTxs ?? 0) + (data.totalDepositTxs ?? 0),
			totalWithdrawalTxs:
				allChainsData?.totalWithdrawalTxs == null && data.totalWithdrawalTxs == null
					? undefined
					: (allChainsData?.totalWithdrawalTxs ?? 0) + (data.totalWithdrawalTxs ?? 0),
			totalTokensDeposited: {
				...(allChainsData?.totalTokensDeposited ?? {}),
				...data.totalTokensDeposited
			},
			totalTokensWithdrawn: {
				...(allChainsData?.totalTokensWithdrawn ?? {}),
				...data.totalTokensWithdrawn
			},
			totalAddressDeposited: {
				...(allChainsData?.totalAddressDeposited ?? {}),
				...data.totalAddressDeposited
			},
			totalAddressWithdrawn: {
				...(allChainsData?.totalAddressWithdrawn ?? {}),
				...data.totalAddressWithdrawn
			}
		}

		prevDayDataByChain[chains[index]] = data
	}

	if (destinationChain !== 'false') {
		prevDayDataByChain[destinationChain] = prevDayDataByChain['All Chains']
	}

	return prevDayDataByChain
}

function buildTableDataByChain({
	prevDayDataByChain,
	chainsList
}: {
	prevDayDataByChain: Record<string, RawBridgeDayStats>
	chainsList: string[]
}): BridgePageData['tableDataByChain'] {
	const tableDataByChain: BridgePageData['tableDataByChain'] = {}

	for (const currentChain of chainsList) {
		const prevDayData = prevDayDataByChain[currentChain]
		let tokensTableData: BridgeTableData['tokensTableData'] = []
		let addressesTableData: BridgeTableData['addressesTableData'] = []
		let tokenDeposits: BridgeTableData['tokenDeposits'] = []
		let tokenWithdrawals: BridgeTableData['tokenWithdrawals'] = []
		let tokenColor: BridgeTableData['tokenColor'] = {}

		if (prevDayData) {
			const totalTokensDeposited = prevDayData.totalTokensDeposited
			const totalTokensWithdrawn = prevDayData.totalTokensWithdrawn
			const tokensTableUnformatted: Record<string, TokenTableUnformattedRow> = {}

			for (const token in totalTokensDeposited) {
				const tokenData = totalTokensDeposited[token] as TokenMapValue
				const symbol = tokenData.symbol == null || tokenData.symbol === '' ? 'unknown' : tokenData.symbol
				const usdValue = tokenData.usdValue
				const key = `${symbol}#${token}`
				tokensTableUnformatted[key] = tokensTableUnformatted[key] || {}
				tokensTableUnformatted[key].deposited = (tokensTableUnformatted[key].deposited ?? 0) + usdValue
				tokensTableUnformatted[key].volume = (tokensTableUnformatted[key].volume ?? 0) + usdValue
				// ensure there are no undefined values for deposited/withdrawn so table can be sorted
				tokensTableUnformatted[key].withdrawn = 0
			}
			for (const token in totalTokensWithdrawn) {
				const tokenData = totalTokensWithdrawn[token] as TokenMapValue
				const symbol = tokenData.symbol == null || tokenData.symbol === '' ? 'unknown' : tokenData.symbol
				const usdValue = tokenData.usdValue ?? 0
				const key = `${symbol}#${token}`
				tokensTableUnformatted[key] = tokensTableUnformatted[key] || {}
				tokensTableUnformatted[key].withdrawn = (tokensTableUnformatted[key].withdrawn ?? 0) + usdValue
				tokensTableUnformatted[key].volume = (tokensTableUnformatted[key].volume ?? 0) + usdValue
				if (!tokensTableUnformatted[key].deposited) {
					tokensTableUnformatted[key].deposited = 0
				}
			}

			tokensTableData = []
			for (const symbol in tokensTableUnformatted) {
				const volumeData = tokensTableUnformatted[symbol]
				if ((volumeData.volume ?? 0) === 0) continue
				tokensTableData.push({
					symbol,
					deposited: volumeData.deposited ?? 0,
					withdrawn: volumeData.withdrawn ?? 0,
					volume: volumeData.volume ?? 0
				})
			}

			let fullTokenDeposits: { name: string; value: number }[] = []
			for (const key in totalTokensDeposited) {
				const tokenData = totalTokensDeposited[key] as TokenMapValue
				fullTokenDeposits.push({ name: tokenData.symbol, value: tokenData.usdValue })
			}
			let fullTokenWithdrawals: { name: string; value: number }[] = []
			for (const key in totalTokensWithdrawn) {
				const tokenData = totalTokensWithdrawn[key] as TokenMapValue
				fullTokenWithdrawals.push({ name: tokenData.symbol, value: tokenData.usdValue })
			}

			if (currentChain === 'All Chains') {
				// Use for..in instead of Object.values() and Set for deduplication
				const symbolToDeposits = new Map<string, number>()
				for (const key in totalTokensDeposited) {
					const tokenData = totalTokensDeposited[key] as TokenMapValue
					const existing = symbolToDeposits.get(tokenData.symbol) ?? 0
					symbolToDeposits.set(tokenData.symbol, existing + tokenData.usdValue)
				}
				fullTokenDeposits = []
				for (const [symbol, value] of symbolToDeposits) {
					fullTokenDeposits.push({ name: symbol, value })
				}

				const symbolToWithdrawals = new Map<string, number>()
				for (const key in totalTokensWithdrawn) {
					const tokenData = totalTokensWithdrawn[key] as TokenMapValue
					const existing = symbolToWithdrawals.get(tokenData.symbol) ?? 0
					symbolToWithdrawals.set(tokenData.symbol, existing + tokenData.usdValue)
				}
				fullTokenWithdrawals = []
				for (const [symbol, value] of symbolToWithdrawals) {
					fullTokenWithdrawals.push({ name: symbol, value })
				}
			}

			tokenDeposits = preparePieChartData({
				data: fullTokenDeposits,
				limit: 15
			})
			tokenWithdrawals = preparePieChartData({
				data: fullTokenWithdrawals,
				limit: 15
			})

			const colors = getNDistinctColors(tokenDeposits.length + tokenWithdrawals.length)

			tokenColor = Object.fromEntries(
				[...tokenDeposits, ...tokenWithdrawals, 'Others'].map((token, i) => {
					return typeof token === 'string' ? ['-', colors[i] ?? '#AAAAAA'] : [token.name, colors[i] ?? '#AAAAAA']
				})
			)
			const totalAddressesDeposited = prevDayData.totalAddressDeposited
			const totalAddressesWithdrawn = prevDayData.totalAddressWithdrawn
			const addressesTableUnformatted: Record<string, AddressTableUnformattedRow> = {}
			for (const address in totalAddressesDeposited) {
				const addressData = totalAddressesDeposited[address] as AddressMapValue
				const txs = addressData.txs
				const usdValue = addressData.usdValue
				addressesTableUnformatted[address] = addressesTableUnformatted[address] || {}
				addressesTableUnformatted[address].deposited = (addressesTableUnformatted[address].deposited ?? 0) + usdValue
				addressesTableUnformatted[address].txs = (addressesTableUnformatted[address].txs ?? 0) + txs
			}
			for (const address in totalAddressesWithdrawn) {
				const addressData = totalAddressesWithdrawn[address] as AddressMapValue
				const txs = addressData.txs
				const usdValue = addressData.usdValue
				addressesTableUnformatted[address] = addressesTableUnformatted[address] || {}
				addressesTableUnformatted[address].withdrawn = (addressesTableUnformatted[address].withdrawn ?? 0) + usdValue
				addressesTableUnformatted[address].txs = (addressesTableUnformatted[address].txs ?? 0) + txs
			}
			addressesTableData = []
			for (const address in addressesTableUnformatted) {
				const addressData = addressesTableUnformatted[address]
				if ((addressData.txs ?? 0) === 0) continue
				addressesTableData.push({
					address,
					deposited: addressData.deposited ?? 0,
					withdrawn: addressData.withdrawn ?? 0,
					txs: addressData.txs ?? 0
				})
			}
		}

		tableDataByChain[currentChain] = {
			tokensTableData,
			addressesTableData,
			tokenDeposits,
			tokenWithdrawals,
			tokenColor,
			totalDepositedUSD: prevDayData?.totalDepositedUSD,
			totalWithdrawnUSD: prevDayData?.totalWithdrawnUSD,
			totalDepositTxs: prevDayData?.totalDepositTxs,
			totalWithdrawalTxs: prevDayData?.totalWithdrawalTxs,
			dataTimestamp: prevDayData?.date
		}
	}

	return tableDataByChain
}

export const getBridges = () => fetchBridges(true).then(({ bridges, chains }) => ({ bridges, chains }))

const getChainVolumeData = async (chain: string, chainCoingeckoIds: LlamaConfigResponse['chainCoingeckoIds']) => {
	if (chain) {
		if (chainCoingeckoIds[chain]) {
			const chart: RawBridgeVolumePoint[] = await fetchOrFallback(() => fetchBridgeVolumeByChain(chain), {
				context: `fetchBridgeVolumeByChain(${chain})`,
				throwOnFailure: true,
				onFailureError: () => new Error(`bridge volume for chain ${chain} is broken`)
			})
			// This is confusing, stats from the endpoint use "deposit" to mean deposit in bridge contract,
			// i.e., a withdrawal from the chain. Will eventually change that.
			const formattedChart = formatBridgeOverviewVolumeData(chart)
			return { formatted: formattedChart, raw: chart }
		} else return { formatted: null, raw: [] }
	} else {
		const chart: RawBridgeVolumePoint[] = await fetchBridgeVolumeAll()
		const formattedChart = chart.map((point) => {
			return {
				date: point.date,
				volume: ((point.withdrawUSD ?? 0) + (point.depositUSD ?? 0)) / 2,
				txs: (point.depositTxs ?? 0) + (point.withdrawTxs ?? 0)
			}
		})
		return { formatted: formattedChart, raw: chart }
	}
}

export const getBridgeChainNetInflows = async (
	chain: string,
	currentTimeMs: number = Date.now()
): Promise<{ netInflows: number | null } | null> => {
	const { chainCoingeckoIds } = await fetchJson<LlamaConfigResponse>(CONFIG_API)
	if (!chainCoingeckoIds[chain]) return null

	const chart = await fetchOrFallback(() => fetchBridgeVolumeByChain(chain), {
		context: `fetchBridgeVolumeByChain(${chain})`,
		throwOnFailure: true,
		onFailureError: () => new Error(`bridge volume for chain ${chain} is broken`)
	})
	const currentPoint = getFreshTimeSeriesCurrentPoint(chart, (point) => point.date, { currentTimeMs })
	const netInflows = currentPoint?.depositUSD ?? null

	if (netInflows === 0) {
		return null
	}

	return { netInflows }
}

const getLargeTransactionsData = async (chain: string, startTimestamp: number, endTimestamp: number) => {
	return fetchOrFallback(() => fetchBridgeLargeTransactions(startTimestamp, endTimestamp, chain || undefined), {
		context: `fetchBridgeLargeTransactions(${chain || 'all'})`,
		fallback: [] as RawBridgeLargeTransactionsResponse
	})
}

const getBridgeTxCounts = async (chain?: string) => {
	return fetchOrFallback(() => fetchBridgeTxCounts(chain || undefined), {
		context: `fetchBridgeTxCounts(${chain || 'all'})`,
		fallback: { bridges: [] }
	})
}

export async function getBridgeOverviewPageData(chain, options: { includeBridgeTxCounts?: boolean } = {}) {
	const includeBridgeTxCounts = options.includeBridgeTxCounts ?? false
	const [{ bridges, chains }, { chainCoingeckoIds }, bridgeTxCountsResponse] = await Promise.all([
		getBridges(),
		fetchJson<LlamaConfigResponse>(CONFIG_API),
		includeBridgeTxCounts ? getBridgeTxCounts(chain) : Promise.resolve({ bridges: [] })
	])
	const bridgeTxCountsById = new Map(
		(bridgeTxCountsResponse.bridges ?? []).map((bridge) => [Number(bridge.id), bridge.txsPrevDay ?? null])
	)
	const bridgesWithTxCounts = bridges.map((bridge) => ({
		...bridge,
		txsPrevDay: bridgeTxCountsById.get(Number(bridge.id)) ?? null
	}))

	const bridgeFetchTargets = chain
		? bridgesWithTxCounts.filter((bridge) => bridge.chains.some((bridgeChain) => slug(bridgeChain) === slug(chain)))
		: bridgesWithTxCounts
	const bridgeNames = bridgeFetchTargets.map((bridge) => bridge.displayName)
	const bridgeNameToChartDataIndex = Object.fromEntries(bridgeNames.map((name, index) => [name, index]))
	const chartDataByBridge: Array<Array<{ date: string; volume: number; txs: number }>> = await Promise.all(
		bridgeFetchTargets.map(async (elem) => {
			const charts: RawBridgeVolumePoint[] = await fetchOrFallback(
				() => (!chain ? fetchBridgeVolumeAll(elem.id) : fetchBridgeVolumeByChain(chain, elem.id)),
				{
					context: `fetchBridgeVolumeByBridge(${elem.id})`,
					fallback: [] as RawBridgeVolumePoint[]
				}
			)
			return charts.map((chart) => ({
				date: chart.date,
				volume: ((chart.withdrawUSD ?? 0) + (chart.depositUSD ?? 0)) / 2,
				txs: (chart.depositTxs ?? 0) + (chart.withdrawTxs ?? 0)
			}))
		})
	)

	// order of chains will update every 24 hrs, can consider changing metric sorted by here
	const chainList = chains
		.sort((a, b) => {
			return b.lastDailyVolume - a.lastDailyVolume
		})
		.map((chainItem) => chainItem.name)

	const chainVolumePromise = getChainVolumeData(chain, chainCoingeckoIds)

	const currentTimestamp = Math.floor(new Date().getTime() / 1000 / 3600) * 3600
	// 25 hours behind current time, gives 1 hour for BRIDGEDAYSTATS to update, may change this
	const prevDayTimestamp = currentTimestamp
	const bridgeStatsPromise = chain
		? (async () => {
				return fetchOrFallback(() => fetchBridgeDayStats(prevDayTimestamp, chain), {
					context: `fetchBridgeDayStats(${chain})`,
					fallback: {}
				})
			})()
		: Promise.resolve({})

	const numberOfDaysForLargeTx = chain ? 7 : 1
	const secondsInDay = 3600 * 24
	const largeTxsPromise = getLargeTransactionsData(
		chain,
		currentTimestamp - numberOfDaysForLargeTx * secondsInDay,
		currentTimestamp
	)

	const netflowsPromise = !chain
		? Promise.all([
				fetchBridgeNetflows('day')
					.then(prepareBridgeNetflowChartData)
					.catch(() => []),
				fetchBridgeNetflows('week')
					.then(prepareBridgeNetflowChartData)
					.catch(() => []),
				fetchBridgeNetflows('month')
					.then(prepareBridgeNetflowChartData)
					.catch(() => [])
			]).then(([day, week, month]): BridgeNetflowChartData => ({ day, week, month }))
		: Promise.resolve(null)

	const [chainVolumeResult, bridgeStatsCurrentDay, unformattedLargeTxsData, netflowsData] = await Promise.all([
		chainVolumePromise,
		bridgeStatsPromise,
		largeTxsPromise,
		netflowsPromise
	])
	const chainVolumeData = chainVolumeResult?.formatted ?? []
	const rawBridgeVolumeData = chainVolumeResult?.raw ?? []
	const largeTxsData = Array.isArray(unformattedLargeTxsData)
		? unformattedLargeTxsData.map((transaction) => {
				const { token, symbol, isDeposit, chain: txChain } = transaction
				const symbolAndTokenForExplorer = `${symbol}#${token}`
				let correctedIsDeposit = isDeposit
				if (chain) {
					correctedIsDeposit = chain.toLowerCase() === txChain.toLowerCase() ? isDeposit : !isDeposit
				}
				return { ...transaction, isDeposit: correctedIsDeposit, symbol: symbolAndTokenForExplorer }
			})
		: []

	const { bridges: filteredBridges, messagingProtocols } = formatBridgesData({
		bridges: bridgesWithTxCounts,
		chartDataByBridge,
		bridgeNameToChartDataIndex,
		chain
	})

	return {
		chains: chainList,
		filteredBridges,
		messagingProtocols,
		bridgeNames,
		bridgeNameToChartDataIndex,
		chartDataByBridge,
		chainVolumeData: chainVolumeData ?? [],
		rawBridgeVolumeData,
		netflowsData,
		bridgeStatsCurrentDay,
		largeTxsData,
		chain: chain ?? 'All'
	}
}

export async function getBridgeChainsPageData() {
	const [{ chains }, metadataCache] = await Promise.all([
		getBridges(),
		import('~/utils/metadata').then((m) => m.default)
	])

	let chartDataByChain: RawBridgeVolumePoint[][] = []
	const chainToChartDataIndex: Record<string, number> = {}
	chartDataByChain = await Promise.all(
		chains.map(async (chain, i) => {
			chainToChartDataIndex[chain.name] = i
			return fetchOrFallback(() => fetchBridgeVolumeByChain(chain.name), {
				context: `fetchBridgeVolumeByChain(${chain.name})`,
				fallback: [] as RawBridgeVolumePoint[]
			})
		})
	)

	const chartRows = buildBridgeChainsChartRows({ chains, chartDataByChain })

	// order of chains will update every 24 hrs, can consider changing metric sorted by here
	const chainList = chains
		.sort((a, b) => {
			return b.volumePrevDay - a.volumePrevDay
		})
		.map((chain) => chain.name)

	const currentTimestamp = Math.floor(new Date().getTime() / 1000 / 3600) * 3600
	// 25 hours behind current time, gives 1 hour for BRIDGEDAYSTATS to update, may change this
	const prevDayTimestamp = currentTimestamp - 86400 - 3600

	let netflowsDataDay = null
	let netflowsDataWeek = null
	try {
		;[netflowsDataDay, netflowsDataWeek] = await Promise.all([
			fetchBridgeNetflows('day').catch(() => null),
			fetchBridgeNetflows('week').catch(() => null)
		])
	} catch (e) {
		console.log('Failed to fetch netflows data:', e)
	}

	let prevDayDataByChain = []
	prevDayDataByChain = (
		await Promise.all(
			chains.map(async (chain) => {
				const stats = await fetchOrFallback(() => fetchBridgeDayStats(prevDayTimestamp, chain.name), {
					context: `fetchBridgeDayStats(${chain.name})`,
					fallback: null
				})
				if (stats === null) return undefined
				return { ...asBridgeDayStats(stats), name: chain.name }
				//throw new Error(`bridgedaystats for ${chain.name} is broken`)
			})
		)
	).filter((t) => t !== undefined)

	const filteredChains = formatChainsData({
		chains,
		chartDataByChain,
		chainToChartDataIndex,
		prevDayDataByChain,
		netflowsDataDay,
		netflowsDataWeek
	}).map((chain) => ({
		...chain,
		...(isDeprecatedChain(metadataCache.chainMetadata, chain.name) ? { deprecated: true } : {})
	}))

	const chart = buildBridgeChainsMultiSeriesChart({ chartRows, chains: chainList })

	return {
		allChains: chainList,
		tableData: filteredChains,
		chart
	}
}

export function buildBridgeChainsChartRows({
	chains,
	chartDataByChain
}: {
	chains: Array<{ name: string }>
	chartDataByChain: RawBridgeVolumePoint[][]
}): Map<number, Map<string, number>> {
	const chartData = new Map<number, Map<string, number>>()

	for (let i = 0; i < chains.length; i++) {
		const chain = chains[i]
		const charts = chartDataByChain[i] ?? []
		for (const chart of charts) {
			const date = Number(chart.date)
			if (!Number.isFinite(date)) continue
			let values = chartData.get(date)
			if (!values) {
				values = new Map()
				chartData.set(date, values)
			}
			values.set(chain.name, (chart.depositUSD ?? 0) - (chart.withdrawUSD ?? 0))
		}
	}

	return chartData
}

export function buildBridgeChainsMultiSeriesChart({
	chartRows,
	chains
}: {
	chartRows: Map<number, Map<string, number>>
	chains: string[]
}): {
	dataset: MultiSeriesChartDataset
	charts: NonNullable<IMultiSeriesChartProps['charts']>
} {
	const source = new Array<number[]>(chartRows.size)
	let rowIndex = 0
	for (const [date, values] of chartRows) {
		const row = new Array<number>(chains.length + 1)
		row[0] = date * 1e3
		for (let chainIndex = 0; chainIndex < chains.length; chainIndex++) {
			const value = values.get(chains[chainIndex])
			if (value != null) row[chainIndex + 1] = value
		}
		source[rowIndex++] = row
	}
	// Each chain is an independent ascending API stream, so their merged timeline
	// must be ordered once after materializing the shared rows.
	source.sort((a, b) => a[0] - b[0])

	const dimensions = ['timestamp', ...(chains ?? [])]

	const charts = (chains ?? []).map((name, i) => ({
		type: 'bar' as const,
		name,
		encode: { x: 0, y: i + 1 },
		// Use per-series stacks so selected chains render as clustered bars (not stacked).
		stack: name,
		color: CHART_COLORS[i % CHART_COLORS.length],
		large: false
	}))

	return {
		dataset: { source, dimensions } satisfies MultiSeriesChartDataset,
		charts
	}
}

export async function getBridgePageData(bridge: string): Promise<BridgePageData | null> {
	// fetch list of all bridges
	const { bridges } = await getBridges()

	// find data of bridge
	const bridgeData = bridges.find((obj) => slug(obj.displayName) === slug(bridge) || slug(obj.slug) === slug(bridge))

	if (!bridgeData) {
		return null
	}

	const { id, chains, icon, displayName, destinationChain, name } = bridgeData

	const [iconType, iconName] = icon.split(':')
	// get logo based on icon type (chain or protocol)
	const logo = iconType === 'chain' ? chainIconUrl(iconName) : tokenIconUrl(iconName)
	const volume = await Promise.all(
		chains.map(async (chain) => {
			return fetchOrFallback(() => fetchBridgeVolumeByChain(chain, id), {
				context: `fetchBridgeVolumeByChain(${chain},${id})`,
				throwOnFailure: true,
				onFailureError: () => new Error(`bridge volume for chain ${chain} is broken`)
			})
		})
	)
	const volumeDataByChain = buildVolumeDataByChain({ volume, chains, destinationChain })

	const currentTimestamp = Math.floor(new Date().getTime() / 1000 / 3600) * 3600
	const rollingHours = name === 'wormhole' ? 28 : 24

	const statsOnPrevDay: RawBridgeDayStats[] = await Promise.all(
		chains.map(async (chain) => {
			const stats = await fetchOrFallback(() => fetchBridgeDayStats(currentTimestamp, chain, { id, rollingHours }), {
				context: `fetchBridgeDayStats(${chain},${id})`,
				throwOnFailure: true,
				onFailureError: () => new Error(`bridgedaystats for chain ${chain} is broken`)
			})
			return asBridgeDayStats(stats)
		})
	)
	const prevDayDataByChain = buildPrevDayDataByChain({ statsOnPrevDay, chains, destinationChain })
	const chainsList = ['All Chains', ...chains, destinationChain !== 'false' ? destinationChain : null].filter(
		(chain): chain is string => Boolean(chain)
	)
	const tableDataByChain = buildTableDataByChain({
		prevDayDataByChain,
		chainsList
	})

	return {
		displayName,
		logo,
		chains: ['All Chains', ...chains],
		defaultChain: 'All Chains',
		volumeDataByChain,
		tableDataByChain,
		config: bridgeData
	} as BridgePageData
}

export const getBridgePageDatanew = getBridgePageData
