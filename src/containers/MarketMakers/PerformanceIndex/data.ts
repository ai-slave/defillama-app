import { DEFAULT_TIMEFRAME, timeframeToRange } from '../timeframe'
import type { Metric } from '../types'
import type { PerformanceRow } from './types'

export type AggregatedMetrics = {
	marketMakerId: string
	marketMakerName: string
	marketMakerImageUrl: string | null
	bidAskDepth: Metric | null
	topOfBookSpread: Metric | null
	dailyFillVolume: Metric | null
	combinedUptime: Metric | null
}

export type PerformanceIndexProps = {
	performanceRows: PerformanceRow[]
	aggregated: Record<string, AggregatedMetrics>
}

function asNum(v: unknown): number | null {
	return typeof v === 'number' ? v : null
}

function asStr(v: unknown): string {
	return typeof v === 'string' ? v : ''
}

function asMetric(v: unknown): Metric | null {
	if (v == null || typeof v !== 'object') return null
	const o = v as Record<string, unknown>
	return {
		value: asNum(o.value),
		percentile: asNum(o.percentile),
		rank: asNum(o.rank)
	}
}

function toPerformanceRow(raw: Record<string, unknown>): PerformanceRow {
	const score = (key: string) => {
		const v = raw[key]
		if (typeof v === 'number') return v
		if (v != null && typeof v === 'object') return asNum((v as Record<string, unknown>).value)
		return null
	}
	return {
		marketMakerId: asStr(raw.marketMakerId),
		marketMakerName: asStr(raw.marketMakerName),
		marketMakerImageUrl: typeof raw.marketMakerImageUrl === 'string' ? raw.marketMakerImageUrl : null,
		composite: score('composite'),
		grade: typeof raw.grade === 'string' && raw.grade.length > 0 ? raw.grade : null,
		tradingKpis: score('tradingKpis'),
		trustIntegration: score('trustIntegration'),
		coverageCapabilities: score('coverageCapabilities'),
		uptime: score('uptime'),
		integrationLevel: score('integrationLevel'),
		integrationStatus: typeof raw.integrationStatus === 'string' ? raw.integrationStatus : 'none',
		activeEngagementsCount: asNum(raw.activeEngagementsCount),
		medianEngagementsFdv: asNum(raw.medianEngagementsFdv)
	}
}

function toAggregated(raw: Record<string, unknown>): AggregatedMetrics {
	return {
		marketMakerId: asStr(raw.marketMakerId),
		marketMakerName: asStr(raw.marketMakerName),
		marketMakerImageUrl: typeof raw.marketMakerImageUrl === 'string' ? raw.marketMakerImageUrl : null,
		bidAskDepth: asMetric(raw.bidAskDepth),
		topOfBookSpread: asMetric(raw.topOfBookSpread),
		dailyFillVolume: asMetric(raw.dailyFillVolume),
		combinedUptime: asMetric(raw.combinedUptime)
	}
}

function asArray(payload: unknown): Record<string, unknown>[] {
	if (!Array.isArray(payload)) return []
	return payload.map((row) => (row && typeof row === 'object' ? (row as Record<string, unknown>) : {}))
}

export function mergePerformanceIndex(performancePayload: unknown, aggregatedPayload: unknown): PerformanceIndexProps {
	const performanceRows = asArray(performancePayload).map(toPerformanceRow)

	const aggregated: Record<string, AggregatedMetrics> = {}
	for (const row of asArray(aggregatedPayload)) {
		const merged = toAggregated(row)
		if (merged.marketMakerId) aggregated[merged.marketMakerId] = merged
	}

	return { performanceRows, aggregated }
}

export async function getPerformanceIndexProps(
	forgdFetch: <T = unknown>(path: string, query?: Record<string, string | number | undefined>) => Promise<T>
): Promise<PerformanceIndexProps> {
	const range = timeframeToRange(DEFAULT_TIMEFRAME, new Date())
	const [performancePayload, aggregatedPayload] = await Promise.all([
		forgdFetch('/market-maker/leaderboard/performance', range),
		forgdFetch('/market-maker/leaderboard/aggregated', range)
	])
	return mergePerformanceIndex(performancePayload, aggregatedPayload)
}
