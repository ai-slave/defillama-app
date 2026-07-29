import type { LlamaConfigResponse } from '~/api/types'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesTimeSeriesRow
} from '~/components/ECharts/MultiSeriesChart/types'
import { prepareRuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { CONFIG_API } from '~/constants'
import { CHART_COLORS } from '~/constants/colors'
import { slug } from '~/utils'
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
	BridgeVolumePoint,
	BridgeDayStats,
	BridgeDayTokenStats,
	BridgeDayAddressStats,
	BridgeNetflowsResponse,
	RawBridgeLargeTransactionsResponse
} from './api.types'
import { formatBridgeOverviewVolumeData, getBridgeNetFlow } from './bridgeOverviewVolumeData'
import type {
	BridgeNetflowChartData,
	BridgeNetflowChartPoint,
	BridgePageData,
	BridgeTableData,
	BridgeVolumeChartPoint
} from './types'
import { formatBridgesData, formatChainsData } from './utils'

function prepareBridgeNetflowChartData(data: BridgeNetflowsResponse): BridgeNetflowChartPoint[] {
	const nonZeroData: BridgeNetflowChartPoint[] = []
	for (const item of data) {
		if (item.netFlow === 0) continue
		nonZeroData.push({ chain: item.chain, value: item.netFlow })
	}

	nonZeroData.sort((a, b) => Math.abs(a.value) - Math.abs(b.value))
	const topFlows = nonZeroData.slice(-15)
	topFlows.sort((a, b) => a.value - b.value)
	return topFlows
}

type FetchFallbackOptions<T> = {
	context: string
} & (
	| { throwOnFailure: true; onFailureError?: () => Error; fallback?: never }
	| { fallback: T; throwOnFailure?: false; onFailureError?: never }
)

async function fetchOrFallback<T>(operation: () => Promise<T>, options: FetchFallbackOptions<T>): Promise<T> {
	try {
		return await operation()
	} catch (error) {
		console.log(`[bridges][fetch-failed] ${options.context}`, error)

		if (options.throwOnFailure) {
			throw options.onFailureError ? options.onFailureError() : new Error(`${options.context} failed`)
		}

		return options.fallback
	}
}

function addKnownBridgeLeg(left: number | null, right: number | null): number | null {
	return left == null || right == null ? null : left + right
}

function getSignedBridgeWithdrawal(withdrawUSD: number | null | undefined): number | null {
	if (withdrawUSD == null) return null
	return withdrawUSD === 0 ? 0 : -withdrawUSD
}

function getBridgeGrossVolume(point: Pick<BridgeVolumePoint, 'depositUSD' | 'withdrawUSD'>): number | null {
	return point.depositUSD == null || point.withdrawUSD == null ? null : (point.depositUSD + point.withdrawUSD) / 2
}

function getBridgeTransactionCount(point: Pick<BridgeVolumePoint, 'depositTxs' | 'withdrawTxs'>): number {
	return point.depositTxs + point.withdrawTxs
}

type TokenTableUnformattedRow = {
	symbol: string
	deposited: number | null
	withdrawn: number | null
	volume: number | null
}

type AddressTableUnformattedRow = {
	deposited: number | null
	withdrawn: number | null
	txs: number
}

function addNullableUsd(current: number | null | undefined, incoming: number | null): number | null {
	if (current === null || incoming === null) return null
	return (current ?? 0) + incoming
}

function getBridgeTokenPieName(symbol: string, token: string): string {
	return `${symbol} · ${token}`
}

function mergeAggregateTokenMapInto(
	current: Record<string, BridgeDayTokenStats>,
	next: Record<string, BridgeDayTokenStats>
): void {
	for (const token in next) {
		const incoming = next[token]
		if (incoming === undefined) continue
		const existing = current[token]
		if (!existing) {
			current[token] = { symbol: incoming.symbol, usdValue: incoming.usdValue }
			continue
		}
		const existingSymbol = existing.symbol.trim()
		const incomingSymbol = incoming.symbol.trim()
		if (existingSymbol && incomingSymbol && existingSymbol !== incomingSymbol) {
			throw new Error(`Conflicting symbols for bridge token ${token}: ${existing.symbol} and ${incoming.symbol}`)
		}
		current[token] = {
			symbol: existingSymbol ? existing.symbol : incoming.symbol,
			usdValue: addNullableUsd(existing.usdValue, incoming.usdValue)
		}
	}
}

function mergeAggregateAddressMapInto(
	current: Record<string, BridgeDayAddressStats>,
	next: Record<string, BridgeDayAddressStats>
): void {
	for (const address in next) {
		const incoming = next[address]
		if (incoming === undefined) continue
		const existing = current[address]
		current[address] = existing
			? { usdValue: addNullableUsd(existing.usdValue, incoming.usdValue), txs: existing.txs + incoming.txs }
			: { usdValue: incoming.usdValue, txs: incoming.txs }
	}
}

export function buildVolumeDataByChain({
	volume,
	chains,
	destinationChain
}: {
	volume: BridgeVolumePoint[][]
	chains: string[]
	destinationChain: string
}): BridgePageData['volumeDataByChain'] {
	const volumeDataByChain: BridgePageData['volumeDataByChain'] = {}
	const volumeOnAllChains = new Map<number, BridgeVolumeChartPoint>()
	const normalizeDailyBridgePoints = (points: BridgeVolumeChartPoint[]): BridgeVolumeChartPoint[] => {
		const normalized: BridgeVolumeChartPoint[] = []
		for (const point of points) {
			const utcDay = Math.floor(point.date / 86400) * 86400
			const last = normalized[normalized.length - 1]
			if (last?.date === utcDay) {
				last.Deposited = addKnownBridgeLeg(last.Deposited, point.Deposited)
				last.Withdrawn = addKnownBridgeLeg(last.Withdrawn, point.Withdrawn)
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

	if (volume.length !== chains.length) throw new Error('Bridge volume responses must align with requested chains')
	for (let index = 0; index < chains.length; index++) {
		const chain = chains[index]
		if (chain === undefined) continue
		const chainVolume = volume[index]
		if (!chainVolume) throw new Error(`Missing bridge volume response for ${chain}`)
		const chartData: BridgeVolumeChartPoint[] = []

		for (const item of chainVolume) {
			const date = item.date
			const point: BridgeVolumeChartPoint = {
				date,
				Deposited: item.depositUSD ?? null,
				Withdrawn: getSignedBridgeWithdrawal(item.withdrawUSD)
			}
			chartData.push(point)

			const currentAllChainsPoint = volumeOnAllChains.get(date)
			volumeOnAllChains.set(
				date,
				currentAllChainsPoint
					? {
							date,
							Deposited: addKnownBridgeLeg(currentAllChainsPoint.Deposited, point.Deposited),
							Withdrawn: addKnownBridgeLeg(currentAllChainsPoint.Withdrawn, point.Withdrawn)
						}
					: point
			)
		}

		volumeDataByChain[chain] = normalizeDailyBridgePoints(chartData)
	}

	const destinationChainVolume = volumeDataByChain[destinationChain] ?? []
	const allChainPoints = Array.from(volumeOnAllChains.values())
	allChainPoints.sort((a, b) => a.date - b.date)
	volumeDataByChain['All Chains'] =
		destinationChain !== 'false' && destinationChainVolume.length > 0
			? normalizeDailyBridgePoints(destinationChainVolume)
			: normalizeDailyBridgePoints(allChainPoints)

	return volumeDataByChain
}

export function buildPrevDayDataByChain({
	statsOnPrevDay,
	destinationChain
}: {
	statsOnPrevDay: Array<{ chain: string; stats: BridgeDayStats }>
	destinationChain: string
}): Record<string, BridgeDayStats> {
	const prevDayDataByChain: Record<string, BridgeDayStats> = {}
	const allChainsData: BridgeDayStats = {
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

	for (const { chain, stats: data } of statsOnPrevDay) {
		allChainsData.date = Math.max(allChainsData.date, data.date)
		allChainsData.totalDepositedUSD = addNullableUsd(allChainsData.totalDepositedUSD, data.totalDepositedUSD)
		allChainsData.totalWithdrawnUSD = addNullableUsd(allChainsData.totalWithdrawnUSD, data.totalWithdrawnUSD)
		allChainsData.totalDepositTxs += data.totalDepositTxs
		allChainsData.totalWithdrawalTxs += data.totalWithdrawalTxs
		mergeAggregateTokenMapInto(allChainsData.totalTokensDeposited, data.totalTokensDeposited)
		mergeAggregateTokenMapInto(allChainsData.totalTokensWithdrawn, data.totalTokensWithdrawn)
		mergeAggregateAddressMapInto(allChainsData.totalAddressDeposited, data.totalAddressDeposited)
		mergeAggregateAddressMapInto(allChainsData.totalAddressWithdrawn, data.totalAddressWithdrawn)

		prevDayDataByChain[chain] = data
	}

	if (statsOnPrevDay.length > 0) prevDayDataByChain['All Chains'] = allChainsData
	if (destinationChain !== 'false' && statsOnPrevDay.length > 0) {
		prevDayDataByChain[destinationChain] = allChainsData
	}

	return prevDayDataByChain
}

export function buildTableDataByChain({
	prevDayDataByChain,
	chainsList
}: {
	prevDayDataByChain: Record<string, BridgeDayStats>
	chainsList: string[]
}): BridgePageData['tableDataByChain'] {
	const tableDataByChain: BridgePageData['tableDataByChain'] = {}

	for (const currentChain of chainsList) {
		const prevDayData = prevDayDataByChain[currentChain]
		if (!prevDayData) continue
		let tokensTableData: BridgeTableData['tokensTableData'] = []
		let addressesTableData: BridgeTableData['addressesTableData'] = []
		let tokenDeposits: BridgeTableData['tokenDeposits']
		let tokenWithdrawals: BridgeTableData['tokenWithdrawals']

		{
			const totalTokensDeposited = prevDayData.totalTokensDeposited
			const totalTokensWithdrawn = prevDayData.totalTokensWithdrawn
			const tokensTableUnformatted = new Map<string, TokenTableUnformattedRow>()
			const depositValuesByToken = new Map<string, number>()
			const withdrawalValuesByToken = new Map<string, number>()
			let hasUnknownDepositValue = false
			let hasUnknownWithdrawalValue = false

			for (const token in totalTokensDeposited) {
				const tokenData = totalTokensDeposited[token]
				if (tokenData === undefined) continue
				const symbol = tokenData.symbol === '' ? 'unknown' : tokenData.symbol
				const usdValue = tokenData.usdValue
				const current = tokensTableUnformatted.get(token)
				tokensTableUnformatted.set(token, {
					symbol,
					deposited: addNullableUsd(current?.deposited, usdValue),
					withdrawn: current ? current.withdrawn : 0,
					volume: addNullableUsd(current?.volume, usdValue)
				})
				if (usdValue === null) hasUnknownDepositValue = true
				else {
					const pieName = getBridgeTokenPieName(symbol, token)
					depositValuesByToken.set(pieName, (depositValuesByToken.get(pieName) ?? 0) + usdValue)
				}
			}
			for (const token in totalTokensWithdrawn) {
				const tokenData = totalTokensWithdrawn[token]
				if (tokenData === undefined) continue
				const symbol = tokenData.symbol === '' ? 'unknown' : tokenData.symbol
				const usdValue = tokenData.usdValue
				const current = tokensTableUnformatted.get(token)
				if (current && current.symbol !== 'unknown' && symbol !== 'unknown' && current.symbol !== symbol) {
					throw new Error(`Conflicting symbols for bridge token ${token}: ${current.symbol} and ${symbol}`)
				}
				tokensTableUnformatted.set(token, {
					symbol: current?.symbol === 'unknown' ? symbol : (current?.symbol ?? symbol),
					deposited: current ? current.deposited : 0,
					withdrawn: addNullableUsd(current?.withdrawn, usdValue),
					volume: addNullableUsd(current?.volume, usdValue)
				})
				if (usdValue === null) hasUnknownWithdrawalValue = true
				else {
					const pieName = getBridgeTokenPieName(symbol, token)
					withdrawalValuesByToken.set(pieName, (withdrawalValuesByToken.get(pieName) ?? 0) + usdValue)
				}
			}

			tokensTableData = []
			for (const [token, volumeData] of tokensTableUnformatted) {
				if (volumeData.volume === 0) continue
				tokensTableData.push({
					symbol: volumeData.symbol,
					token,
					deposited: volumeData.deposited,
					withdrawn: volumeData.withdrawn,
					volume: volumeData.volume
				})
			}

			tokenDeposits = hasUnknownDepositValue
				? null
				: prepareRuntimePieChartData({ data: depositValuesByToken, limit: 15 })
			tokenWithdrawals = hasUnknownWithdrawalValue
				? null
				: prepareRuntimePieChartData({ data: withdrawalValuesByToken, limit: 15 })
			const totalAddressesDeposited = prevDayData.totalAddressDeposited
			const totalAddressesWithdrawn = prevDayData.totalAddressWithdrawn
			const addressesTableUnformatted = new Map<string, AddressTableUnformattedRow>()
			for (const address in totalAddressesDeposited) {
				const addressData = totalAddressesDeposited[address]
				if (addressData === undefined) continue
				const txs = addressData.txs
				const usdValue = addressData.usdValue
				const current = addressesTableUnformatted.get(address)
				addressesTableUnformatted.set(address, {
					deposited: addNullableUsd(current?.deposited, usdValue),
					withdrawn: current ? current.withdrawn : 0,
					txs: (current?.txs ?? 0) + txs
				})
			}
			for (const address in totalAddressesWithdrawn) {
				const addressData = totalAddressesWithdrawn[address]
				if (addressData === undefined) continue
				const txs = addressData.txs
				const usdValue = addressData.usdValue
				const current = addressesTableUnformatted.get(address)
				addressesTableUnformatted.set(address, {
					deposited: current ? current.deposited : 0,
					withdrawn: addNullableUsd(current?.withdrawn, usdValue),
					txs: (current?.txs ?? 0) + txs
				})
			}
			addressesTableData = []
			for (const [address, addressData] of addressesTableUnformatted) {
				if (addressData.txs === 0) continue
				addressesTableData.push({
					address,
					deposited: addressData.deposited,
					withdrawn: addressData.withdrawn,
					txs: addressData.txs
				})
			}
		}

		tableDataByChain[currentChain] = {
			tokensTableData,
			addressesTableData,
			tokenDeposits,
			tokenWithdrawals,
			totalDepositedUSD: prevDayData.totalDepositedUSD,
			totalWithdrawnUSD: prevDayData.totalWithdrawnUSD,
			totalDepositTxs: prevDayData.totalDepositTxs,
			totalWithdrawalTxs: prevDayData.totalWithdrawalTxs,
			dataTimestamp: prevDayData.date
		}
	}

	return tableDataByChain
}

export const getBridges = () => fetchBridges(true).then(({ bridges, chains }) => ({ bridges, chains }))

const getChainVolumeData = async (chain: string, chainCoingeckoIds: LlamaConfigResponse['chainCoingeckoIds']) => {
	if (chain) {
		if (chainCoingeckoIds[chain]) {
			const chart: BridgeVolumePoint[] = await fetchOrFallback(() => fetchBridgeVolumeByChain(chain), {
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
		const chart: BridgeVolumePoint[] = await fetchBridgeVolumeAll()
		// The chart renders the raw response; summary cards consume only this lightweight projection.
		return {
			formatted: chart.map((point) => ({
				date: point.date,
				volume: getBridgeGrossVolume(point),
				Deposits: null,
				Withdrawals: null
			})),
			raw: chart
		}
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
	const currentPoint = getFreshTimeSeriesCurrentPoint(chart, (point) => point.date, {
		currentTimeMs,
		currentDayOffset: 1
	})
	return { netInflows: currentPoint ? getBridgeNetFlow(currentPoint) : 0 }
}

const getLargeTransactionsData = async (chain: string, startTimestamp: number, endTimestamp: number) => {
	return fetchOrFallback<RawBridgeLargeTransactionsResponse>(
		() => fetchBridgeLargeTransactions(startTimestamp, endTimestamp, chain || undefined),
		{
			context: `fetchBridgeLargeTransactions(${chain || 'all'})`,
			fallback: []
		}
	)
}

const getBridgeTxCounts = async (chain?: string) => {
	return fetchOrFallback(() => fetchBridgeTxCounts(chain || undefined), {
		context: `fetchBridgeTxCounts(${chain || 'all'})`,
		fallback: { bridges: [] }
	})
}

export async function getBridgeOverviewPageData(chain: string, options: { includeBridgeTxCounts?: boolean } = {}) {
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
	const bridgeNameToChartDataIndex: Record<string, number> = {}
	for (let index = 0; index < bridgeNames.length; index++) {
		const name = bridgeNames[index]
		if (name !== undefined) bridgeNameToChartDataIndex[name] = index
	}
	const chartDataByBridge: Array<Array<{ date: number; volume: number | null; txs: number | null }> | null> =
		await Promise.all(
			bridgeFetchTargets.map(async (elem) => {
				const charts = await fetchOrFallback(
					() => (!chain ? fetchBridgeVolumeAll(elem.id) : fetchBridgeVolumeByChain(chain, elem.id)),
					{
						context: `fetchBridgeVolumeByBridge(${elem.id})`,
						fallback: null
					}
				)
				if (!charts) return null
				return charts.map((chart) => ({
					date: chart.date,
					volume: getBridgeGrossVolume(chart),
					txs: getBridgeTransactionCount(chart)
				}))
			})
		)

	// order of chains will update every 24 hrs, can consider changing metric sorted by here
	const chainList = chains.map((chainItem) => chainItem.name)

	const chainVolumePromise = getChainVolumeData(chain, chainCoingeckoIds)

	const currentTimestamp = Math.floor(new Date().getTime() / 1000 / 3600) * 3600
	// 25 hours behind current time, gives 1 hour for BRIDGEDAYSTATS to update, may change this
	const prevDayTimestamp = currentTimestamp
	const bridgeStatsPromise = chain
		? (async () => {
				const stats = await fetchOrFallback(() => fetchBridgeDayStats(prevDayTimestamp, chain, { rollingHours: 24 }), {
					context: `fetchBridgeDayStats(${chain})`,
					fallback: null
				})
				return stats
			})()
		: Promise.resolve(null)

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
	const largeTxsData = unformattedLargeTxsData.map((transaction) => {
		const { token, symbol, isDeposit, chain: txChain } = transaction
		const symbolAndTokenForExplorer = `${symbol}#${token}`
		let correctedIsDeposit = isDeposit
		if (chain) {
			correctedIsDeposit = chain.toLowerCase() === txChain.toLowerCase() ? isDeposit : !isDeposit
		}
		return { ...transaction, isDeposit: correctedIsDeposit, symbol: symbolAndTokenForExplorer }
	})

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

	let chartDataByChain: Array<BridgeVolumePoint[] | null> = []
	const chainToChartDataIndex: Record<string, number> = {}
	chartDataByChain = await Promise.all(
		chains.map(async (chain, i) => {
			chainToChartDataIndex[chain.name] = i
			return fetchOrFallback(() => fetchBridgeVolumeByChain(chain.name), {
				context: `fetchBridgeVolumeByChain(${chain.name})`,
				fallback: null
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

	let prevDayDataByChain: Array<BridgeDayStats & { name: string }> = []
	prevDayDataByChain = (
		await Promise.all(
			chains.map(async (chain) => {
				const stats = await fetchOrFallback(() => fetchBridgeDayStats(prevDayTimestamp, chain.name), {
					context: `fetchBridgeDayStats(${chain.name})`,
					fallback: null
				})
				if (stats === null) return undefined
				return { ...stats, name: chain.name }
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
	chartDataByChain: Array<Array<Pick<BridgeVolumePoint, 'date' | 'depositUSD' | 'withdrawUSD'>> | null>
}): Map<number, Map<string, number | null>> {
	if (chains.length !== chartDataByChain.length) {
		throw new Error(
			`Bridge chain/chart response count mismatch: ${chains.length} chains, ${chartDataByChain.length} charts`
		)
	}
	const chartData = new Map<number, Map<string, number | null>>()

	for (let i = 0; i < chains.length; i++) {
		const chain = chains[i]
		if (chain === undefined) continue
		const charts = chartDataByChain[i]
		if (!charts) continue
		for (const chart of charts) {
			const date = chart.date
			let values = chartData.get(date)
			if (!values) {
				values = new Map()
				chartData.set(date, values)
			}
			values.set(chain.name, getBridgeNetFlow(chart))
		}
	}

	return chartData
}

export function buildBridgeChainsMultiSeriesChart({
	chartRows,
	chains
}: {
	chartRows: Map<number, Map<string, number | null>>
	chains: string[]
}): {
	dataset: MultiSeriesChartDataset
	charts: NonNullable<IMultiSeriesChartProps['charts']>
} {
	const source = new Array<MultiSeriesTimeSeriesRow>(chartRows.size)
	let rowIndex = 0
	for (const [date, values] of chartRows) {
		const row: MultiSeriesTimeSeriesRow = [date * 1e3]
		row.length = chains.length + 1
		row.fill(null, 1)
		for (let chainIndex = 0; chainIndex < chains.length; chainIndex++) {
			const chain = chains[chainIndex]
			if (chain === undefined) continue
			const value = values.get(chain)
			if (value !== undefined) row[chainIndex + 1] = value
		}
		source[rowIndex++] = row
	}
	// Each chain is an independent ascending API stream, so their merged timeline
	// must be ordered once after materializing the shared rows.
	source.sort((a, b) => a[0] - b[0])

	const dimensions = ['timestamp', ...(chains ?? [])]

	const charts = (chains ?? []).map((name, i) => {
		const color = CHART_COLORS[i % CHART_COLORS.length]
		if (!color) throw new Error(`Missing bridge chart color at index ${i}`)
		return {
			type: 'bar' as const,
			name,
			encode: { x: 0, y: i + 1 },
			// Use per-series stacks so selected chains render as clustered bars (not stacked).
			stack: name,
			color,
			large: false
		}
	})

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

	const [iconType = 'protocol', iconName = displayName] = icon.split(':')
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

	const statsOnPrevDay = await Promise.all(
		chains.map(async (chain) => {
			const stats = await fetchOrFallback(() => fetchBridgeDayStats(currentTimestamp, chain, { id, rollingHours }), {
				context: `fetchBridgeDayStats(${chain},${id})`,
				throwOnFailure: true,
				onFailureError: () => new Error(`bridgedaystats for chain ${chain} is broken`)
			})
			return { chain, stats }
		})
	)
	const prevDayDataByChain = buildPrevDayDataByChain({ statsOnPrevDay, destinationChain })
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
	}
}

export const getBridgePageDatanew = getBridgePageData
