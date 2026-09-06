import { DATASETS_SERVER_URL } from '~/constants'
import { fetchJson, getFastJsonTimeoutMs } from '~/utils/async'
import type { HomepageUnlockChartEntry, IChainOverviewData } from './types'

type LegacyHomepageUnlocksSummary = {
	schemaVersion: 1
	generatedAtSec: number
	windowDays: number
	chart: Array<{ date: number; total: number; breakdown: Array<{ token: string; value: number; pct: string }> }>
	total14d: number
}

type HomepageUnlocksSummaryV2 = {
	schemaVersion: 2
	generatedAtSec: number
	priceSnapshotAtSec: number
	windowDays: number
	chart: Array<{
		date: number
		cliff: number
		linear: number
		total: number
		unknownEventCount: number
		missingPriceProtocolCount: number
		breakdown: Array<{
			token: string
			value: number
			cliff: number
			linear: number
			pct: string
		}>
	}>
	totals: {
		cliff: number
		linear: number
		total: number
		unknownEventCount: number
		missingPriceProtocolCount: number
	}
	total14d: number
}

export type HomepageUnlocksSummary = LegacyHomepageUnlocksSummary | HomepageUnlocksSummaryV2

const HOMEPAGE_UNLOCKS_SUMMARY_URL = `${DATASETS_SERVER_URL}/homepage/unlocks-summary.json`

export function projectHomepageUnlocksSummary(
	value: HomepageUnlocksSummary
): NonNullable<IChainOverviewData['unlocks']> {
	if (value.schemaVersion === 1) {
		const chart: Array<HomepageUnlockChartEntry> = value.chart.map((day) => ({
			...day,
			cliff: null,
			linear: null,
			unknownEventCount: null,
			missingPriceProtocolCount: null,
			breakdown: day.breakdown.map((item) => ({ ...item, cliff: null, linear: null }))
		}))
		return {
			chart,
			total14d: value.total14d,
			cliff14d: null,
			linear14d: null,
			unknownEventCount: null,
			missingPriceProtocolCount: null,
			generatedAtSec: value.generatedAtSec,
			priceSnapshotAtSec: null
		}
	}

	return {
		chart: value.chart,
		total14d: value.total14d,
		cliff14d: value.totals.cliff,
		linear14d: value.totals.linear,
		unknownEventCount: value.totals.unknownEventCount,
		missingPriceProtocolCount: value.totals.missingPriceProtocolCount,
		generatedAtSec: value.generatedAtSec,
		priceSnapshotAtSec: value.priceSnapshotAtSec
	}
}

export async function fetchHomepageUnlocksSummary(): Promise<IChainOverviewData['unlocks']> {
	try {
		const summary = await fetchJson<HomepageUnlocksSummary>(HOMEPAGE_UNLOCKS_SUMMARY_URL, {
			timeout: getFastJsonTimeoutMs()
		})
		return projectHomepageUnlocksSummary(summary)
	} catch (error) {
		console.error('Failed to fetch homepage unlocks summary:', error)
		return null
	}
}
