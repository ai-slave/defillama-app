import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { prepareRuntimePieChartData, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
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
	usdValue: number
}

interface BridgeDailyTokenStats {
	totalTokensDeposited?: Record<string, BridgeTokenData>
	totalTokensWithdrawn?: Record<string, BridgeTokenData>
}

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
	bridges: BridgeOverviewSummaryRow[] | null | undefined
	chainVolumeData: BridgeOverviewVolumeChartPoint[]
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
			if (rowTotals[period.total] == null) continue
			const value = bridge[period.field]
			rowTotals[period.total] = value == null ? null : rowTotals[period.total] + value
		}
	}

	return rowTotals
}

export function buildBridgeOverviewTokenPieSeries(tokens: Record<string, BridgeTokenData>): RuntimePieChartData {
	const totalsBySymbol = new Map<string, number>()
	for (const token in tokens) {
		const { symbol, usdValue } = tokens[token]
		const name = symbol || 'Unknown'
		totalsBySymbol.set(name, (totalsBySymbol.get(name) ?? 0) + usdValue)
	}

	return prepareRuntimePieChartData({
		data: totalsBySymbol,
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
	chainVolumeData: BridgeOverviewVolumeChartPoint[]
	bridgeStatsCurrentDay?: BridgeDailyTokenStats | null
	tokenPieSeries?: RuntimePieChartData
}): BridgeOverviewActiveChart {
	if (selectedChain === 'All' || chartType === 'Volumes' || chartType === 'Bridge Volume') return null

	if (chartType === 'Net Flow') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: chainVolumeData.map(({ date, Deposits, Withdrawals }) => [Number(date) * 1e3, Deposits + Withdrawals])
			}
		}
	}

	if (chartType === 'Net Flow (%)') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Inflows', 'Outflows'],
				source: chainVolumeData.map(({ date, Deposits, Withdrawals }) => {
					const volume = Deposits + Math.abs(Withdrawals)
					return [Number(date) * 1e3, (Deposits / volume) * 100 || 0, (Math.abs(Withdrawals) / volume) * 100 || 0]
				})
			}
		}
	}

	if (chartType === 'Inflows') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Deposits', 'Withdrawals'],
				source: chainVolumeData.map(({ date, Deposits, Withdrawals }) => [Number(date) * 1e3, Deposits, Withdrawals])
			}
		}
	}

	const tokensDeposited = bridgeStatsCurrentDay?.totalTokensDeposited
	const tokensWithdrawn = bridgeStatsCurrentDay?.totalTokensWithdrawn
	const tokens = chartType === '24h Tokens Deposited' ? tokensDeposited : tokensWithdrawn
	return { kind: chartType, series: tokenPieSeries ?? buildBridgeOverviewTokenPieSeries(tokens ?? {}) }
}
