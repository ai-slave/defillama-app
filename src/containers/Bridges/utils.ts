import { getPercentChange, keepNeededProperties, slug } from '~/utils'
import { DAY_MS, getUtcStartOfDay, toUnixMsTimestamp } from '~/utils/timeSeries'
import type { BridgeDayStats, BridgeNetflowEntry, BridgeNetflowsResponse, BridgeVolumePoint } from './api.types'
import { BRIDGE_PROPERTIES_TO_KEEP } from './constants'

interface IDailyBridgeStats extends BridgeDayStats {
	name?: string
}

export interface BridgeChainTableRow {
	name: string
	prevDayNetFlow: number | null
	prevDayUsdDeposits: number | null
	prevDayUsdWithdrawals: number | null
	prevWeekNetFlow: number | null
	prevWeekUsdDeposits: number | null
	prevWeekUsdWithdrawals: number | null
	topTokenDepositedSymbol: string | null
	topTokenDepositedUsd: number | null
	topTokenWithdrawnSymbol: string | null
	topTokenWithdrawnUsd: number | null
	deprecated?: boolean
}

type BridgeSummaryChartPoint = { date: string | number; volume?: number | null; txs?: number | null }

interface BridgeForFormatting {
	displayName: string
	name: string
	chains: Array<string>
	symbol?: string
	icon?: string | null
	last24hVolume?: number | null
	lastDailyVolume?: number | null
	dayBeforeLastVolume?: number | null
	weeklyVolume?: number | null
	monthlyVolume?: number | null
	txsPrevDay?: number | null
	change_1d?: number | null
	change_7d?: number | null
	change_1m?: number | null
}

function getPriorBridgeTransactionCount(
	chart: ReadonlyArray<BridgeSummaryChartPoint> | null | undefined,
	daysBefore: number,
	currentTimeMs: number
): number | null {
	if (chart == null) return null
	const targetDay = getUtcStartOfDay(currentTimeMs) - (daysBefore + 1) * DAY_MS
	let latestTimestamp = Number.NEGATIVE_INFINITY
	let transactionCount: number | null = 0
	for (const point of chart) {
		const timestamp = toUnixMsTimestamp(point.date)
		if (getUtcStartOfDay(timestamp) !== targetDay || timestamp <= latestTimestamp) continue
		latestTimestamp = timestamp
		transactionCount = point.txs ?? null
	}
	return transactionCount
}

type BridgeDailyVolumePoint = {
	date: string | number
	volume?: number | null
	Deposits?: number | null
	Withdrawals?: number | null
}

function getBridgeDailyVolume(point: BridgeDailyVolumePoint, useDepositAndWithdrawalVolume: boolean): number | null {
	let value: number
	if (useDepositAndWithdrawalVolume) {
		if (point.Deposits == null || point.Withdrawals == null) return null
		value = point.Deposits - point.Withdrawals
	} else {
		if (point.volume == null) return null
		value = point.volume
	}
	return Number.isFinite(value) ? value : null
}

export function getCompletedBridgeVolumeTotal(
	chart: Array<BridgeDailyVolumePoint> | null | undefined,
	days: number,
	useDepositAndWithdrawalVolume = false,
	currentTimeMs: number = Date.now()
): number | null {
	if (!Number.isInteger(days) || days <= 0) return null
	return (
		getCompletedBridgeVolumeSummary(chart, [days], useDepositAndWithdrawalVolume, currentTimeMs).totals.get(days) ??
		null
	)
}

export function getCompletedBridgeVolumeTotals(
	chart: Array<BridgeDailyVolumePoint> | null | undefined,
	days: ReadonlyArray<number>,
	useDepositAndWithdrawalVolume = false,
	currentTimeMs: number = Date.now()
): Map<number, number | null> {
	return getCompletedBridgeVolumeSummary(chart, days, useDepositAndWithdrawalVolume, currentTimeMs).totals
}

function getCompletedBridgeVolumeSummary(
	chart: Array<BridgeDailyVolumePoint> | null | undefined,
	days: ReadonlyArray<number>,
	useDepositAndWithdrawalVolume: boolean,
	currentTimeMs: number
): { pair: { current: number; previous: number } | null; totals: Map<number, number | null> } {
	const totals = new Map<number, number | null>()
	let maxDays = 0
	for (const periodDays of days) {
		totals.set(periodDays, null)
		if (Number.isInteger(periodDays) && periodDays > maxDays) maxDays = periodDays
	}
	if (chart == null) return { pair: null, totals }

	const latestPointByDay = new Map<number, { point: BridgeDailyVolumePoint; timestamp: number }>()
	for (const point of chart) {
		const timestamp = toUnixMsTimestamp(point.date)
		const dayStart = getUtcStartOfDay(timestamp)
		const existing = latestPointByDay.get(dayStart)
		if (!existing || timestamp > existing.timestamp) latestPointByDay.set(dayStart, { point, timestamp })
	}

	const currentDay = getUtcStartOfDay(currentTimeMs)
	const latestCompletedDay = currentDay - DAY_MS
	let runningTotal = 0
	let isComplete = true
	let current: number | null = null
	let previous: number | null = null
	for (let dayOffset = 0; dayOffset < Math.max(maxDays, 2); dayOffset++) {
		const point = latestPointByDay.get(latestCompletedDay - dayOffset * DAY_MS)?.point
		// The producer emits sparse daily rows: an omitted date is a known zero-activity day.
		const value = point ? getBridgeDailyVolume(point, useDepositAndWithdrawalVolume) : 0
		if (dayOffset === 0) current = value
		if (dayOffset === 1) previous = value
		if (value == null) isComplete = false
		if (isComplete && value != null) runningTotal += value

		const periodDays = dayOffset + 1
		if (totals.has(periodDays)) totals.set(periodDays, isComplete ? runningTotal : null)
	}

	return { pair: current == null || previous == null ? null : { current, previous }, totals }
}

export function getCompletedBridgeVolumePair(
	chart: Array<BridgeDailyVolumePoint> | null | undefined,
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
}: {
	chain?: string
	bridges?: Array<BridgeForFormatting>
	chartDataByBridge?: Array<Array<BridgeSummaryChartPoint> | null>
	bridgeNameToChartDataIndex?: Record<string, number>
	bridgeProps?: ReadonlyArray<keyof BridgeForFormatting & string>
	currentTimeMs?: number
}) => {
	let filteredBridges = [...bridges]

	if (chain) {
		const sluggedChain = slug(chain)
		filteredBridges = filteredBridges.filter(({ chains = [] }) => chains.some((c) => slug(c) === sluggedChain))
	}

	filteredBridges = filteredBridges.map((inputBridge) => {
		const bridge = { ...inputBridge }
		const chartIndex = bridgeNameToChartDataIndex[bridge.displayName]
		const chart = chartIndex === undefined ? null : (chartDataByBridge[chartIndex] ?? null)

		const completedVolumeSummary = getCompletedBridgeVolumeSummary(chart, [7, 30], false, currentTimeMs)
		const completedVolumePair = completedVolumeSummary.pair
		bridge.lastDailyVolume = completedVolumePair?.current ?? null
		bridge.dayBeforeLastVolume = completedVolumePair?.previous ?? null
		bridge.weeklyVolume = completedVolumeSummary.totals.get(7) ?? null
		bridge.monthlyVolume = completedVolumeSummary.totals.get(30) ?? null

		bridge.change_1d = getPercentChange(completedVolumePair?.current, completedVolumePair?.previous)
		if (bridge.txsPrevDay == null) {
			bridge.txsPrevDay = getPriorBridgeTransactionCount(chart, 0, currentTimeMs)
			if (bridge.name === 'layerzero' && (bridge.txsPrevDay ?? Number.POSITIVE_INFINITY) < 1000) {
				bridge.txsPrevDay = getPriorBridgeTransactionCount(chart, 1, currentTimeMs)
			}
		}
		return keepNeededProperties(bridge, bridgeProps)
	})
	const messagingProtocols = new Set(['layerzero', 'wormhole', 'circle', 'hyperlane', 'ccip', 'hyperbridge'])
	const regularBridges = filteredBridges.filter((bridge) => !messagingProtocols.has(bridge.name?.toLowerCase() ?? ''))
	const messagingProtocolsBridges = filteredBridges.filter((bridge) =>
		messagingProtocols.has(bridge.name?.toLowerCase() ?? '')
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
	prevDayDataByChain = [],
	netflowsDataDay = null,
	netflowsDataWeek = null,
	currentTimeMs = Date.now()
}: {
	chains?: Array<{ name: string }>
	chartDataByChain?: Array<Array<
		Pick<BridgeVolumePoint, 'depositUSD' | 'withdrawUSD'> & { date: string | number }
	> | null>
	chainToChartDataIndex?: Record<string, number>
	prevDayDataByChain?: Array<IDailyBridgeStats>
	netflowsDataDay?: BridgeNetflowsResponse | null
	netflowsDataWeek?: BridgeNetflowsResponse | null
	currentTimeMs?: number
}): Array<BridgeChainTableRow> => {
	const prevDayDataByName = new Map<string, IDailyBridgeStats>()
	for (const item of prevDayDataByChain ?? []) {
		if (item.name != null && !prevDayDataByName.has(item.name)) prevDayDataByName.set(item.name, item)
	}
	const netflowsDayByChain = indexBridgeNetflows(netflowsDataDay)
	const netflowsWeekByChain = indexBridgeNetflows(netflowsDataWeek)
	const filteredChains = chains.map((chain) => {
		const name = chain.name
		const chartIndex = chainToChartDataIndex[name]
		const charts = chartIndex === undefined ? null : (chartDataByChain[chartIndex] ?? null)

		const prevDayData = prevDayDataByName.get(chain.name) ?? null
		const totalTokensDeposited = prevDayData?.totalTokensDeposited
		const totalTokensWithdrawn = prevDayData?.totalTokensWithdrawn

		const chainNetflowDay = netflowsDayByChain.get(name.toLowerCase())
		const prevDayUsdDeposits = chainNetflowDay?.depositedUsd ?? null
		const prevDayUsdWithdrawals = chainNetflowDay?.withdrawnUsd ?? null
		const prevDayNetFlow = chainNetflowDay?.netFlow ?? null

		const chainNetflowWeek = netflowsWeekByChain.get(name.toLowerCase())
		const completedWeek = chainNetflowWeek ? null : getCompletedBridgeLegTotals(charts, 7, currentTimeMs)
		const prevWeekUsdDeposits = chainNetflowWeek?.depositedUsd ?? completedWeek?.depositedUsd ?? null
		const prevWeekUsdWithdrawals = chainNetflowWeek?.withdrawnUsd ?? completedWeek?.withdrawnUsd ?? null
		const prevWeekNetFlow = chainNetflowWeek?.netFlow ?? completedWeek?.netFlow ?? null

		const topTokenDeposited = getTopTokenByUsd(totalTokensDeposited)
		const topTokenWithdrawn = getTopTokenByUsd(totalTokensWithdrawn)

		return {
			name,
			prevDayUsdDeposits,
			prevDayUsdWithdrawals,
			prevWeekUsdDeposits,
			prevWeekUsdWithdrawals,
			topTokenDepositedSymbol: topTokenDeposited.symbol,
			topTokenDepositedUsd: topTokenDeposited.usdValue,
			topTokenWithdrawnSymbol: topTokenWithdrawn.symbol,
			topTokenWithdrawnUsd: topTokenWithdrawn.usdValue,
			prevDayNetFlow,
			prevWeekNetFlow
		}
	})
	return filteredChains
}

function getCompletedBridgeLegTotals(
	chart: Array<{ date: string | number; depositUSD?: number | null; withdrawUSD?: number | null }> | null,
	days: number,
	currentTimeMs: number
): Pick<BridgeNetflowEntry, 'depositedUsd' | 'withdrawnUsd' | 'netFlow'> | null {
	if (!chart) return null
	const latestPointByDay = new Map<
		number,
		{ timestamp: number; point: { depositUSD?: number | null; withdrawUSD?: number | null } }
	>()
	for (const point of chart) {
		const timestamp = toUnixMsTimestamp(point.date)
		const utcDay = getUtcStartOfDay(timestamp)
		const current = latestPointByDay.get(utcDay)
		if (!current || timestamp > current.timestamp) latestPointByDay.set(utcDay, { timestamp, point })
	}

	let depositedUsd = 0
	let withdrawnUsd = 0
	const latestCompletedDay = getUtcStartOfDay(currentTimeMs) - DAY_MS
	for (let dayOffset = 0; dayOffset < days; dayOffset++) {
		const point = latestPointByDay.get(latestCompletedDay - dayOffset * DAY_MS)?.point
		// A missing row in a successful sparse daily response is a known zero-activity day.
		if (!point) continue
		if (point.depositUSD == null || point.withdrawUSD == null) return null
		depositedUsd += point.depositUSD
		withdrawnUsd += point.withdrawUSD
	}
	return { depositedUsd, withdrawnUsd, netFlow: depositedUsd - withdrawnUsd }
}

function indexBridgeNetflows(data: Array<BridgeNetflowEntry> | null): Map<string, BridgeNetflowEntry> {
	const indexed = new Map<string, BridgeNetflowEntry>()
	if (!data) return indexed

	for (const item of data) {
		const key = item.chain.toLowerCase()
		// Array.find used the first duplicate, so indexing must not overwrite it.
		if (indexed.has(key)) continue
		indexed.set(key, item)
	}

	return indexed
}

const getTopTokenByUsd = (tokens?: Record<string, BridgeDayStats['totalTokensDeposited'][string]>) => {
	if (!tokens) {
		return { symbol: null, usdValue: null }
	}

	let topSymbol: string | null = null
	let topUsdValue = 0
	for (const key in tokens) {
		const usdValue = tokens[key]?.usdValue
		if (usdValue == null) return { symbol: null, usdValue: null }
		if (topSymbol === null || usdValue > topUsdValue) {
			topSymbol = tokens[key]?.symbol ?? null
			topUsdValue = usdValue
		}
	}

	return { symbol: topSymbol, usdValue: topUsdValue }
}
