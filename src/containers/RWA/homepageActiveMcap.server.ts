import { fetchRWAChartMetricDataByAsset, fetchRWACurrentListing } from './api'
import type { IFetchedRWAProject, IRWAChartMetricRows } from './api.types'
import { isCategoryIncludedInStandardRwaOverview } from './constants'
import { RWA_WRAPPER_TYPE } from './wrappers'

const HOMEPAGE_CHART_POINTS = 14

type HomepageRwaActiveMcap = {
	total: number
	chart: Array<[number, number]>
}

function isIncludedOnDefaultRwaOverview(asset: IFetchedRWAProject): boolean {
	return (
		Boolean(asset.assetName) &&
		!(asset.category ?? []).some((category) => !isCategoryIncludedInStandardRwaOverview(category)) &&
		!asset.stablecoin &&
		!asset.governance &&
		asset.suspicious !== true &&
		asset.type !== RWA_WRAPPER_TYPE
	)
}

export function buildHomepageRwaActiveMcap(
	assets: Array<IFetchedRWAProject>,
	rows: IRWAChartMetricRows | null
): HomepageRwaActiveMcap {
	const includedAssets = assets.filter(isIncludedOnDefaultRwaOverview)
	const includedMarketIds = new Set(includedAssets.map((asset) => asset.canonicalMarketId))
	let total = 0

	for (const asset of includedAssets) {
		for (const value of Object.values(asset.activeMcap ?? {})) total += value
	}

	const chart: Array<[number, number]> = []
	for (const row of rows ?? []) {
		let rowTotal = 0
		let hasValue = false
		for (const marketId of includedMarketIds) {
			const value = row[marketId]
			if (typeof value !== 'number') continue
			rowTotal += value
			hasValue = true
		}
		if (hasValue) chart.push([row.timestamp, rowTotal])
	}

	chart.sort((a, b) => a[0] - b[0])
	return { total, chart: chart.slice(-HOMEPAGE_CHART_POINTS) }
}

export async function getHomepageRwaActiveMcap(): Promise<HomepageRwaActiveMcap> {
	const [assets, rows] = await Promise.all([
		fetchRWACurrentListing(),
		fetchRWAChartMetricDataByAsset({
			target: { kind: 'all' },
			metric: 'activeMcap',
			includeStablecoins: false,
			includeGovernance: false
		})
	])

	return buildHomepageRwaActiveMcap(assets, rows)
}
