import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import type { BridgePieChartSlice, BridgeVolumeChartPoint } from './types'

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
	chainVolumeData: BridgeVolumeChartPoint[]
	bridgeStatsCurrentDay?: BridgeDailyTokenStats | null
}): BridgeOverviewActiveChart {
	if (selectedChain === 'All' || chartType === 'Volumes' || chartType === 'Bridge Volume') return null

	if (chartType === 'Net Flow') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: chainVolumeData.map(({ date, Deposited, Withdrawn }) => ({
					timestamp: date * 1e3,
					'Net Flow': Deposited + Withdrawn
				}))
			}
		}
	}

	if (chartType === 'Net Flow (%)') {
		return {
			kind: chartType,
			dataset: {
				dimensions: ['timestamp', 'Inflows', 'Outflows'],
				source: chainVolumeData.map(({ date, Deposited, Withdrawn }) => {
					const volume = Deposited + Math.abs(Withdrawn)
					return {
						timestamp: date * 1e3,
						Inflows: (Deposited / volume) * 100 || 0,
						Outflows: (Math.abs(Withdrawn) / volume) * 100 || 0
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
				source: chainVolumeData.map(({ date, Deposited, Withdrawn }) => ({
					timestamp: date * 1e3,
					Deposits: Deposited ?? 0,
					Withdrawals: Withdrawn ?? 0
				}))
			}
		}
	}

	const tokensDeposited = bridgeStatsCurrentDay?.totalTokensDeposited
	const tokensWithdrawn = bridgeStatsCurrentDay?.totalTokensWithdrawn
	const tokens = chartType === '24h Tokens Deposited' ? tokensDeposited : tokensWithdrawn
	return { kind: chartType, data: tokens ? buildTokenPieData(tokens) : [] }
}
