import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import type { BridgeOverviewVolumeChartPoint, BridgePieChartSlice } from './types'
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
	| { kind: 'Net Flow'; dataset: MultiSeriesChart2Dataset }
	| { kind: 'Net Flow (%)'; dataset: MultiSeriesChart2Dataset }
	| { kind: 'Inflows'; dataset: MultiSeriesChart2Dataset }
	| { kind: '24h Tokens Deposited'; data: BridgePieChartSlice[] }
	| { kind: '24h Tokens Withdrawn'; data: BridgePieChartSlice[] }
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

function buildTokenPieData(tokens: Record<string, BridgeTokenData>): BridgePieChartSlice[] {
	const totalsBySymbol: Record<string, number> = Object.create(null)
	for (const token in tokens) {
		const { symbol, usdValue } = tokens[token]
		const name = symbol || 'Unknown'
		totalsBySymbol[name] = (totalsBySymbol[name] ?? 0) + usdValue
	}

	const sorted: BridgePieChartSlice[] = []
	for (const name of Object.keys(totalsBySymbol)) sorted.push({ name, value: totalsBySymbol[name] })
	sorted.sort((a, b) => b.value - a.value)
	if (sorted.length <= 10 && !sorted.some((slice) => slice.name === 'Others')) return sorted

	const mainSlices = sorted.slice(0, 10)
	let othersValue = 0
	let writeIndex = 0
	for (const slice of mainSlices) {
		if (slice.name === 'Others') {
			othersValue += slice.value
		} else {
			mainSlices[writeIndex++] = slice
		}
	}
	mainSlices.length = writeIndex
	for (let index = 10; index < sorted.length; index++) othersValue += sorted[index].value
	if (othersValue > 0) mainSlices.push({ name: 'Others', value: othersValue })
	return mainSlices
}

export function buildBridgeOverviewActiveChart({
	selectedChain,
	chartType,
	chainVolumeData,
	bridgeStatsCurrentDay
}: {
	selectedChain: string
	chartType: BridgeOverviewChartType
	chainVolumeData: BridgeOverviewVolumeChartPoint[]
	bridgeStatsCurrentDay?: BridgeDailyTokenStats | null
}): BridgeOverviewActiveChart {
	if (selectedChain === 'All' || chartType === 'Volumes' || chartType === 'Bridge Volume') return null

	if (chartType === 'Net Flow') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: chainVolumeData.map(({ date, Deposits, Withdrawals }) => ({
					timestamp: Number(date) * 1e3,
					'Net Flow': Deposits + Withdrawals
				}))
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
					return {
						timestamp: Number(date) * 1e3,
						Inflows: (Deposits / volume) * 100 || 0,
						Outflows: (Math.abs(Withdrawals) / volume) * 100 || 0
					}
				})
			}
		}
	}

	if (chartType === 'Inflows') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Deposits', 'Withdrawals'],
				source: chainVolumeData.map(({ date, Deposits, Withdrawals }) => ({
					timestamp: Number(date) * 1e3,
					Deposits,
					Withdrawals
				}))
			}
		}
	}

	const tokensDeposited = bridgeStatsCurrentDay?.totalTokensDeposited
	const tokensWithdrawn = bridgeStatsCurrentDay?.totalTokensWithdrawn
	const tokens = chartType === '24h Tokens Deposited' ? tokensDeposited : tokensWithdrawn
	return { kind: chartType, data: tokens ? buildTokenPieData(tokens) : [] }
}
