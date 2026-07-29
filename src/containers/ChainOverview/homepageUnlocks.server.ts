import { DATASETS_SERVER_URL } from '~/constants'
import { fetchJson, getFastJsonTimeoutMs } from '~/utils/async'
import type { IChainOverviewData } from './types'

export type HomepageUnlocksSummary = {
	schemaVersion: 1
	generatedAtSec: number
	windowDays: number
	chart: NonNullable<IChainOverviewData['unlocks']>['chart']
	total14d: number
}

const HOMEPAGE_UNLOCKS_SUMMARY_URL = `${DATASETS_SERVER_URL}/homepage/unlocks-summary.json`

export function projectHomepageUnlocksSummary(
	value: HomepageUnlocksSummary
): NonNullable<IChainOverviewData['unlocks']> {
	return {
		chart: value.chart,
		total14d: value.total14d
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
