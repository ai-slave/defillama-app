import type { BridgeVolumePoint, BridgeVolumeResponse, RawBridgeVolumePoint } from './api.types'
import type { BridgeOverviewVolumeChartPoint } from './types'

export function getBridgeNetFlow({
	depositUSD,
	withdrawUSD
}: Pick<BridgeVolumePoint, 'depositUSD' | 'withdrawUSD'>): number | null {
	if (depositUSD == null || withdrawUSD == null) return null
	return depositUSD - withdrawUSD
}

export function normalizeBridgeVolumeResponse(chart: readonly RawBridgeVolumePoint[]): BridgeVolumeResponse {
	const normalized: BridgeVolumePoint[] = []
	for (const point of chart) {
		normalized.push({
			date: Number(point.date),
			depositUSD: point.depositUSD,
			withdrawUSD: point.withdrawUSD,
			depositTxs: point.depositTxs,
			withdrawTxs: point.withdrawTxs
		})
	}
	return normalized
}

export function formatBridgeOverviewVolumeData(chart: readonly BridgeVolumePoint[]): BridgeOverviewVolumeChartPoint[] {
	const formatted: BridgeOverviewVolumeChartPoint[] = []
	for (const point of chart) {
		const withdrawals = point.withdrawUSD
		formatted.push({
			date: point.date,
			Deposits: point.depositUSD ?? null,
			Withdrawals: withdrawals == null ? null : withdrawals === 0 ? 0 : -withdrawals
		})
	}
	return formatted
}
