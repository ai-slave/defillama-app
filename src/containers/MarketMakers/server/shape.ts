import { THRESHOLD_TO_BUCKET, type Threshold } from '../constants'
import type { LeaderboardRow, Metric, RankOnly } from '../types'

const IDENTITY_KEYS = new Set(['marketMakerId', 'marketMakerName', 'marketMakerImageUrl', 'rank'])

function asMetric(v: unknown): Metric | null {
	if (v == null || typeof v !== 'object') return null
	const o = v as Record<string, unknown>
	return {
		value: typeof o.value === 'number' ? o.value : null,
		percentile: typeof o.percentile === 'number' ? o.percentile : null,
		rank: typeof o.rank === 'number' ? o.rank : null
	}
}

export function toBoardRows(payload: unknown[]): LeaderboardRow[] {
	if (!Array.isArray(payload)) return []
	return payload.map((raw) => {
		const o = (raw ?? {}) as Record<string, unknown>
		const metrics: Record<string, Metric | null> = {}
		for (const [key, value] of Object.entries(o)) {
			if (IDENTITY_KEYS.has(key)) continue
			metrics[key] = asMetric(value)
		}
		const rank = o.rank && typeof o.rank === 'object' ? (o.rank as RankOnly) : null
		return {
			marketMakerId: String(o.marketMakerId ?? ''),
			marketMakerName: String(o.marketMakerName ?? ''),
			marketMakerImageUrl: typeof o.marketMakerImageUrl === 'string' ? o.marketMakerImageUrl : null,
			rank,
			metrics
		}
	})
}

export function selectDepthBucket(payload: unknown, threshold: Threshold): LeaderboardRow[] {
	const bucket = THRESHOLD_TO_BUCKET[threshold]
	const o = (payload ?? {}) as Record<string, unknown>
	const arr = o[bucket]
	return toBoardRows(Array.isArray(arr) ? arr : [])
}
