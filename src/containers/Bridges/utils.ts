import { getPercentChange, getPrevVolumeFromChart, keepNeededProperties, slug } from '~/utils'
import { DAY_MS, getCompleteTimeSeriesDailyWindow, getUtcStartOfDay, toUnixMsTimestamp } from '~/utils/timeSeries'
import type { RawBridgeNetflowEntry } from './api.types'
import { BRIDGE_PROPERTIES_TO_KEEP } from './constants'

interface ITokenData {
	usdValue: number
	amount: number
	symbol: string
	decimals: number
}

interface IDailyBridgeStats {
	date: number
	totalTokensDeposited: {
		[token: string]: ITokenData
	}
	totalTokensWithdrawn: {
		[token: string]: ITokenData
	}
	totalAddressDeposited: {
		[address: string]: {
			usdValue: number
			txs: number
		}
	}
	totalAddressWithdrawn: {
		[address: string]: {
			usdValue: number
			txs: number
		}
	}
	name?: string
}

type BridgeDailyVolumePoint = {
	date: string | number
	volume?: number
	Deposits?: number
	Withdrawals?: number
}

function getBridgeDailyVolume(point: BridgeDailyVolumePoint, useDepositAndWithdrawalVolume: boolean): number | null {
	const value = useDepositAndWithdrawalVolume
		? Number(point.Deposits) - Number(point.Withdrawals)
		: Number(point.volume)
	return Number.isFinite(value) ? value : null
}

export function getCompletedBridgeVolumeTotal(
	chart: BridgeDailyVolumePoint[] | null | undefined,
	days: number,
	useDepositAndWithdrawalVolume = false,
	currentTimeMs: number = Date.now()
): number | null {
	const points = getCompleteTimeSeriesDailyWindow(chart, days, (point) => point.date, {
		currentTimeMs,
		currentDayOffset: 1
	})
	if (!points) return null

	let total = 0
	for (const point of points) {
		const value = getBridgeDailyVolume(point, useDepositAndWithdrawalVolume)
		if (value == null) return null
		total += value
	}
	return total
}

export function getCompletedBridgeVolumeTotals(
	chart: BridgeDailyVolumePoint[] | null | undefined,
	days: readonly number[],
	useDepositAndWithdrawalVolume = false,
	currentTimeMs: number = Date.now()
): Map<number, number | null> {
	return getCompletedBridgeVolumeSummary(chart, days, useDepositAndWithdrawalVolume, currentTimeMs).totals
}

function getCompletedBridgeVolumeSummary(
	chart: BridgeDailyVolumePoint[] | null | undefined,
	days: readonly number[],
	useDepositAndWithdrawalVolume: boolean,
	currentTimeMs: number
): { pair: { current: number; previous: number } | null; totals: Map<number, number | null> } {
	const totals = new Map<number, number | null>()
	let maxDays = 0
	for (const periodDays of days) {
		totals.set(periodDays, null)
		if (Number.isInteger(periodDays) && periodDays > maxDays) maxDays = periodDays
	}
	if (!chart?.length) return { pair: null, totals }

	const latestPointByDay = new Map<number, { point: BridgeDailyVolumePoint; timestamp: number }>()
	for (const point of chart) {
		const timestamp = toUnixMsTimestamp(point.date)
		if (!Number.isFinite(timestamp)) continue
		const dayStart = getUtcStartOfDay(timestamp)
		const existing = latestPointByDay.get(dayStart)
		if (!existing || timestamp > existing.timestamp) latestPointByDay.set(dayStart, { point, timestamp })
	}

	const latestCompletedDay = getUtcStartOfDay(currentTimeMs) - DAY_MS
	let runningTotal = 0
	let isComplete = true
	let current: number | null = null
	let previous: number | null = null
	for (let dayOffset = 0; dayOffset < Math.max(maxDays, 2); dayOffset++) {
		const point = latestPointByDay.get(latestCompletedDay - dayOffset * DAY_MS)?.point
		const value = point ? getBridgeDailyVolume(point, useDepositAndWithdrawalVolume) : null
		if (dayOffset === 0) current = value
		if (dayOffset === 1) previous = value
		if (value == null) isComplete = false
		if (isComplete) runningTotal += value as number

		const periodDays = dayOffset + 1
		if (totals.has(periodDays)) totals.set(periodDays, isComplete ? runningTotal : null)
	}

	return { pair: current == null || previous == null ? null : { current, previous }, totals }
}

export function getCompletedBridgeVolumePair(
	chart: BridgeDailyVolumePoint[] | null | undefined,
	currentTimeMs: number = Date.now()
): { current: number; previous: number } | null {
	return getCompletedBridgeVolumeSummary(chart, [], false, currentTimeMs).pair
}

export const formatBridgesData = ({
	chain = '',
	bridges = [],
	chartDataByBridge = [],
	bridgeNameToChartDataIndex = {},
	bridgeProps = [...BRIDGE_PROPERTIES_TO_KEEP],
	currentTimeMs = Date.now()
}) => {
	let filteredBridges = [...bridges]

	if (chain) {
		const sluggedChain = slug(chain)
		filteredBridges = filteredBridges.filter(({ chains = [] }) => chains.some((c) => slug(c) === sluggedChain))
	}

	filteredBridges = filteredBridges.map((bridge) => {
		const chartIndex = bridgeNameToChartDataIndex[bridge.displayName]
		const chart = chartDataByBridge[chartIndex] ?? null

		const completedVolumeSummary = getCompletedBridgeVolumeSummary(chart, chain ? [7, 30] : [], false, currentTimeMs)
		const completedVolumePair = completedVolumeSummary.pair
		if (chain) {
			bridge.lastDailyVolume = completedVolumePair?.current ?? null
			bridge.dayBeforeLastVolume = completedVolumePair?.previous ?? null
			bridge.weeklyVolume = completedVolumeSummary.totals.get(7) ?? null
			bridge.monthlyVolume = completedVolumeSummary.totals.get(30) ?? null
			bridge.last24hVolume = bridge.lastDailyVolume
		}

		// Global volume fields are rolling backend metrics; only the daily change comes from exact chart endpoints.
		bridge.change_1d = getPercentChange(completedVolumePair?.current, completedVolumePair?.previous)
		if (bridge.txsPrevDay == null) {
			bridge.txsPrevDay = getPrevVolumeFromChart(chart, 0, true) ?? null
			if (bridge.name === 'layerzero' && bridge.txsPrevDay < 1000) {
				bridge.txsPrevDay = getPrevVolumeFromChart(chart, 1, true) ?? null
			}
		}
		bridge.lastDailyVolume = bridge.last24hVolume

		return keepNeededProperties(bridge, bridgeProps)
	})
	const messagingProtocols = ['layerzero', 'wormhole', 'circle', 'hyperlane', 'ccip', 'hyperbridge']
	const regularBridges = filteredBridges.filter((bridge) => !messagingProtocols.includes(bridge.name?.toLowerCase()))
	const messagingProtocolsBridges = filteredBridges.filter((bridge) =>
		messagingProtocols.includes(bridge.name?.toLowerCase())
	)

	const sortedRegularBridges = regularBridges.sort((a, b) => (b.lastDailyVolume ?? 0) - (a.lastDailyVolume ?? 0))
	const sortedMessagingProtocols = messagingProtocolsBridges.sort(
		(a, b) => (b.lastDailyVolume ?? 0) - (a.lastDailyVolume ?? 0)
	)

	return {
		bridges: sortedRegularBridges,
		messagingProtocols: sortedMessagingProtocols
	}
}

export const formatChainsData = ({
	chains = [],
	chartDataByChain = [],
	chainToChartDataIndex = {},
	prevDayDataByChain = [] as IDailyBridgeStats[],
	netflowsDataDay = null,
	netflowsDataWeek = null
}) => {
	const prevDayDataByName = new Map<string, IDailyBridgeStats>()
	for (const item of prevDayDataByChain ?? []) {
		if (item.name != null && !prevDayDataByName.has(item.name)) prevDayDataByName.set(item.name, item)
	}
	const netflowsDayByChain = indexBridgeNetflows(netflowsDataDay)
	const netflowsWeekByChain = indexBridgeNetflows(netflowsDataWeek)
	let filteredChains = [...chains]

	filteredChains = filteredChains.map((chain) => {
		const name = chain.name
		const chartIndex = chainToChartDataIndex[name]
		const charts = chartDataByChain[chartIndex] ?? null

		const prevDayData = prevDayDataByName.get(chain.name) ?? null
		const prevDayChart = charts?.[charts.length - 1]
		const totalTokensDeposited = prevDayData?.totalTokensDeposited
		const totalTokensWithdrawn = prevDayData?.totalTokensWithdrawn

		let prevDayUsdDeposits, prevDayUsdWithdrawals, prevDayNetFlow
		if (netflowsDataDay && Array.isArray(netflowsDataDay)) {
			const chainNetflowDay = netflowsDayByChain.get(name.toLowerCase())
			if (chainNetflowDay) {
				prevDayUsdDeposits =
					chainNetflowDay.depositedUsd !== undefined ? chainNetflowDay.depositedUsd : prevDayChart?.depositUSD
				prevDayUsdWithdrawals =
					chainNetflowDay.withdrawnUsd !== undefined ? chainNetflowDay.withdrawnUsd : prevDayChart?.withdrawUSD
				prevDayNetFlow =
					chainNetflowDay.netFlow !== undefined
						? chainNetflowDay.netFlow
						: (prevDayUsdDeposits ?? 0) - (prevDayUsdWithdrawals ?? 0)
			} else {
				prevDayUsdDeposits = prevDayChart?.depositUSD
				prevDayUsdWithdrawals = prevDayChart?.withdrawUSD
				prevDayNetFlow = (prevDayUsdDeposits ?? 0) - (prevDayUsdWithdrawals ?? 0)
			}
		} else {
			prevDayUsdDeposits = prevDayChart?.depositUSD
			prevDayUsdWithdrawals = prevDayChart?.withdrawUSD
			prevDayNetFlow = (prevDayUsdDeposits ?? 0) - (prevDayUsdWithdrawals ?? 0)
		}

		let prevWeekUsdDeposits, prevWeekUsdWithdrawals, prevWeekNetFlow
		if (netflowsDataWeek && Array.isArray(netflowsDataWeek)) {
			const chainNetflowWeek = netflowsWeekByChain.get(name.toLowerCase())
			if (chainNetflowWeek) {
				prevWeekUsdDeposits = chainNetflowWeek.depositedUsd !== undefined ? chainNetflowWeek.depositedUsd : 0
				prevWeekUsdWithdrawals = chainNetflowWeek.withdrawnUsd !== undefined ? chainNetflowWeek.withdrawnUsd : 0
				prevWeekNetFlow =
					chainNetflowWeek.netFlow !== undefined
						? chainNetflowWeek.netFlow
						: prevWeekUsdDeposits - prevWeekUsdWithdrawals
			} else {
				const prevWeekCharts = chartDataByChain[chartIndex].slice(-8, -1)
				prevWeekUsdDeposits = 0
				prevWeekUsdWithdrawals = 0
				for (const chart of prevWeekCharts) {
					prevWeekUsdDeposits += chart.depositUSD ?? 0
					prevWeekUsdWithdrawals += chart.withdrawUSD ?? 0
				}
				prevWeekNetFlow = prevWeekUsdDeposits - prevWeekUsdWithdrawals
			}
		} else {
			const prevWeekCharts = chartDataByChain[chartIndex].slice(-8, -1)
			prevWeekUsdDeposits = 0
			prevWeekUsdWithdrawals = 0
			for (const chart of prevWeekCharts) {
				prevWeekUsdDeposits += chart.depositUSD ?? 0
				prevWeekUsdWithdrawals += chart.withdrawUSD ?? 0
			}
			prevWeekNetFlow = prevWeekUsdDeposits - prevWeekUsdWithdrawals
		}

		const topTokenDeposited = getTopTokenByUsd(totalTokensDeposited)
		const topTokenWithdrawn = getTopTokenByUsd(totalTokensWithdrawn)

		return {
			name: name,
			prevDayUsdDeposits: prevDayUsdDeposits ?? 0,
			prevDayUsdWithdrawals: prevDayUsdWithdrawals ?? 0,
			prevWeekUsdDeposits: prevWeekUsdDeposits ?? 0,
			prevWeekUsdWithdrawals: prevWeekUsdWithdrawals ?? 0,
			topTokenDepositedSymbol: topTokenDeposited.symbol,
			topTokenDepositedUsd: topTokenDeposited.usdValue,
			topTokenWithdrawnSymbol: topTokenWithdrawn.symbol,
			topTokenWithdrawnUsd: topTokenWithdrawn.usdValue,
			prevDayNetFlow: prevDayNetFlow ?? 0,
			prevWeekNetFlow: prevWeekNetFlow ?? 0
		}
	})
	return filteredChains
}

type IndexedBridgeNetflow = {
	depositedUsd?: number
	withdrawnUsd?: number
	netFlow?: number
}

function indexBridgeNetflows(data: Array<Partial<RawBridgeNetflowEntry>> | null): Map<string, IndexedBridgeNetflow> {
	const indexed = new Map<string, IndexedBridgeNetflow>()
	if (!data) return indexed

	for (const item of data) {
		if (!item.chain) continue
		const key = item.chain.toLowerCase()
		// Array.find used the first duplicate, so indexing must not overwrite it.
		if (indexed.has(key)) continue
		indexed.set(key, {
			depositedUsd: item.deposited_usd !== undefined ? Number(item.deposited_usd) : undefined,
			withdrawnUsd: item.withdrawn_usd !== undefined ? Number(item.withdrawn_usd) : undefined,
			netFlow: item.net_flow !== undefined ? Number(item.net_flow) : undefined
		})
	}

	return indexed
}

const getTopTokenByUsd = (tokens?: Record<string, ITokenData>) => {
	if (!tokens) {
		return { symbol: null, usdValue: 0 }
	}

	let topSymbol: string | null = null
	let topUsdValue = 0
	for (const key in tokens) {
		const usdValue = tokens[key]?.usdValue ?? 0
		if (topSymbol === null || usdValue > topUsdValue) {
			topSymbol = tokens[key]?.symbol ?? null
			topUsdValue = usdValue
		}
	}

	return { symbol: topSymbol, usdValue: topUsdValue }
}
