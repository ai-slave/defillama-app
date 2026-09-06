import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { prepareRuntimePieChartData, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import type { BridgeDayStats } from './api.types'
import type { BridgeOverviewVolumeChartPoint } from './types'
import { getCompletedBridgeVolumeTotals } from './utils'

export type BridgeOverviewChartType =
	| 'Volumes'
	| 'Bridge Volume'
	| 'Net Flow'
	| 'Net Flow (%)'
	| 'Inflows'
	| '24h Tokens Deposited'
	| '24h Tokens Withdrawn'

interface BridgeTokenData {
	symbol: string
	usdValue: number | null
}

type BridgeDailyTokenStats = Pick<BridgeDayStats, 'totalTokensDeposited' | 'totalTokensWithdrawn'>

export type BridgeOverviewActiveChart =
	| { kind: 'Net Flow'; dataset: MultiSeriesChartDataset }
	| { kind: 'Net Flow (%)'; dataset: MultiSeriesChartDataset }
	| { kind: 'Inflows'; dataset: MultiSeriesChartDataset }
	| { kind: '24h Tokens Deposited'; series: RuntimePieChartData }
	| { kind: '24h Tokens Withdrawn'; series: RuntimePieChartData }
	| null

const BRIDGE_OVERVIEW_SUMMARY_PERIODS = [
	{ field: 'lastDailyVolume', days: 1, total: 'dayTotalVolume' },
	{ field: 'weeklyVolume', days: 7, total: 'weekTotalVolume' },
	{ field: 'monthlyVolume', days: 30, total: 'monthTotalVolume' }
] as const

type BridgeOverviewSummaryField = (typeof BRIDGE_OVERVIEW_SUMMARY_PERIODS)[number]['field']
type BridgeOverviewSummaryRow = Partial<Record<BridgeOverviewSummaryField, number | null>>
type BridgeOverviewSummaryTotals = Record<(typeof BRIDGE_OVERVIEW_SUMMARY_PERIODS)[number]['total'], number | null>

export function getBridgeOverviewSummaryTotals({
	selectedChain,
	bridges,
	chainVolumeData,
	currentTimeMs
}: {
	selectedChain: string
	bridges: Array<BridgeOverviewSummaryRow> | null | undefined
	chainVolumeData: Array<BridgeOverviewVolumeChartPoint>
	currentTimeMs?: number
}): BridgeOverviewSummaryTotals {
	if (selectedChain !== 'All') {
		const aggregateTotals = getCompletedBridgeVolumeTotals(
			chainVolumeData,
			BRIDGE_OVERVIEW_SUMMARY_PERIODS.map((period) => period.days),
			true,
			currentTimeMs
		)
		const chainTotals: BridgeOverviewSummaryTotals = {
			dayTotalVolume: null,
			weekTotalVolume: null,
			monthTotalVolume: null
		}
		for (const period of BRIDGE_OVERVIEW_SUMMARY_PERIODS) {
			const grossVolume = aggregateTotals.get(period.days)
			chainTotals[period.total] = grossVolume == null ? null : grossVolume / 2
		}
		return chainTotals
	}

	const rowTotals: BridgeOverviewSummaryTotals = {
		dayTotalVolume: bridges?.length ? 0 : null,
		weekTotalVolume: bridges?.length ? 0 : null,
		monthTotalVolume: bridges?.length ? 0 : null
	}

	for (const bridge of bridges ?? []) {
		for (const period of BRIDGE_OVERVIEW_SUMMARY_PERIODS) {
			const currentTotal = rowTotals[period.total]
			if (currentTotal == null) continue
			const value = bridge[period.field]
			rowTotals[period.total] = value == null ? null : currentTotal + value
		}
	}

	return rowTotals
}

export function buildBridgeOverviewTokenPieSeries(tokens: Record<string, BridgeTokenData>): RuntimePieChartData | null {
	const symbolCounts: Record<string, number> = {}
	for (const token in tokens) {
		const tokenData = tokens[token]
		if (tokenData === undefined) continue
		const { symbol } = tokenData
		const name = symbol || 'Unknown'
		symbolCounts[name] = (symbolCounts[name] ?? 0) + 1
	}

	const totalsByToken: Record<string, number> = {}
	for (const token in tokens) {
		const tokenData = tokens[token]
		if (tokenData === undefined) continue
		const { symbol, usdValue } = tokenData
		if (usdValue === null) return null
		const name = symbol || 'Unknown'
		const displayName = symbolCounts[name] === 1 ? name : `${name} · ${token}`
		totalsByToken[displayName] = usdValue
	}

	return prepareRuntimePieChartData({
		data: totalsByToken,
		limit: 10,
		comparePeers: (a, b) => {
			const valueDifference = b.value - a.value
			if (valueDifference !== 0) return valueDifference
			const aIndex = /^(0|[1-9]\d*)$/.test(a.name) ? Number(a.name) : null
			const bIndex = /^(0|[1-9]\d*)$/.test(b.name) ? Number(b.name) : null
			if (aIndex !== null && bIndex !== null) return aIndex - bIndex
			if (aIndex !== null) return -1
			if (bIndex !== null) return 1
			return 0
		}
	})
}

export function buildBridgeOverviewActiveChart({
	selectedChain,
	chartType,
	chainVolumeData,
	bridgeStatsCurrentDay,
	tokenPieSeries
}: {
	selectedChain: string
	chartType: BridgeOverviewChartType
	chainVolumeData: Array<BridgeOverviewVolumeChartPoint>
	bridgeStatsCurrentDay?: BridgeDailyTokenStats | null
	tokenPieSeries?: RuntimePieChartData | null
}): BridgeOverviewActiveChart {
	if (selectedChain === 'All' || chartType === 'Volumes' || chartType === 'Bridge Volume') return null

	if (chartType === 'Net Flow') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: chainVolumeData.map(({ date, Deposits, Withdrawals }) => [
					date * 1e3,
					Deposits == null || Withdrawals == null ? null : Deposits + Withdrawals
				])
			}
		}
	}

	if (chartType === 'Net Flow (%)') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Inflows', 'Outflows'],
				source: chainVolumeData.map(({ date, Deposits, Withdrawals }) => {
					if (Deposits == null || Withdrawals == null) return [date * 1e3, null, null]
					const volume = Deposits + Math.abs(Withdrawals)
					return volume === 0
						? [date * 1e3, null, null]
						: [date * 1e3, (Deposits / volume) * 100, (Math.abs(Withdrawals) / volume) * 100]
				})
			}
		}
	}

	if (chartType === 'Inflows') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Deposits', 'Withdrawals'],
				source: chainVolumeData.map(({ date, Deposits, Withdrawals }) => [date * 1e3, Deposits, Withdrawals])
			}
		}
	}

	if (tokenPieSeries !== undefined) return tokenPieSeries ? { kind: chartType, series: tokenPieSeries } : null
	if (!bridgeStatsCurrentDay) return null

	const tokensDeposited = bridgeStatsCurrentDay.totalTokensDeposited
	const tokensWithdrawn = bridgeStatsCurrentDay.totalTokensWithdrawn
	const tokens = chartType === '24h Tokens Deposited' ? tokensDeposited : tokensWithdrawn
	const series = buildBridgeOverviewTokenPieSeries(tokens)
	return series ? { kind: chartType, series } : null
}
