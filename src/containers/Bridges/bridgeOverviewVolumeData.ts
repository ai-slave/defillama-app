import type { RawBridgeVolumePoint } from './api.types'
import type { BridgeOverviewVolumeChartPoint } from './types'

export function formatBridgeOverviewVolumeData(
	chart: readonly RawBridgeVolumePoint[]
): BridgeOverviewVolumeChartPoint[] {
	return chart.map((point) => ({
		date: point.date,
		Deposits: point.depositUSD ?? 0,
		Withdrawals: -(point.withdrawUSD ?? 0)
	}))
}
