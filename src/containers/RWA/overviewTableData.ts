import { formatUsd } from '~/utils/numberFormat'
import type { RWAStatsSegmented } from './api.types'

type RWAOverviewInclusion = { kind: 'base' } | { kind: 'stablecoins' } | { kind: 'governance' } | { kind: 'all' }

export function getRWAOverviewInclusion(includeStablecoins: boolean, includeGovernance: boolean): RWAOverviewInclusion {
	if (includeStablecoins && includeGovernance) return { kind: 'all' }
	if (includeStablecoins) return { kind: 'stablecoins' }
	if (includeGovernance) return { kind: 'governance' }
	return { kind: 'base' }
}

export function getRWAOverviewTableData(row: RWAStatsSegmented, inclusion: RWAOverviewInclusion) {
	const issuers = new Set<string>()
	let assetCount = 0
	let activeMcap = 0
	let onChainMcap = 0
	let defiActiveTvl = 0

	const addSlice = (slice: RWAStatsSegmented[keyof RWAStatsSegmented]) => {
		assetCount += slice.assetCount
		activeMcap += slice.activeMcap
		onChainMcap += slice.onChainMcap
		defiActiveTvl += slice.defiActiveTvl

		for (const issuer of slice.assetIssuers) {
			issuers.add(issuer)
		}
	}

	switch (inclusion.kind) {
		case 'base':
			addSlice(row.base)
			break
		case 'stablecoins':
			addSlice(row.base)
			addSlice(row.stablecoinsOnly)
			addSlice(row.stablecoinsAndGovernance)
			break
		case 'governance':
			addSlice(row.base)
			addSlice(row.governanceOnly)
			addSlice(row.stablecoinsAndGovernance)
			break
		case 'all':
			addSlice(row.base)
			addSlice(row.stablecoinsOnly)
			addSlice(row.governanceOnly)
			addSlice(row.stablecoinsAndGovernance)
			break
	}

	return {
		assetCount,
		activeMcap,
		onChainMcap,
		defiActiveTvl,
		assetIssuers: issuers.size
	}
}

export function getRWAOverviewAssetCount(row: RWAStatsSegmented) {
	return (
		row.base.assetCount +
		row.stablecoinsOnly.assetCount +
		row.governanceOnly.assetCount +
		row.stablecoinsAndGovernance.assetCount
	)
}

export function hasExcludedRWAOverviewAssets(
	row: RWAStatsSegmented,
	includeStablecoins: boolean,
	includeGovernance: boolean
) {
	return (
		(!includeStablecoins && row.stablecoinsOnly.assetCount > 0) ||
		(!includeGovernance && row.governanceOnly.assetCount > 0) ||
		(!includeStablecoins && !includeGovernance && row.stablecoinsAndGovernance.assetCount > 0)
	)
}

export function formatRWAOverviewUsd(value: number, hasExcludedAssets: boolean) {
	return value === 0 && hasExcludedAssets
		? '-'
		: formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

export function getRWAOverviewCsvFileName(prefix: string, inclusion: RWAOverviewInclusion) {
	switch (inclusion.kind) {
		case 'base':
			return prefix
		case 'stablecoins':
			return `${prefix}-stablecoins`
		case 'governance':
			return `${prefix}-governance`
		case 'all':
			return `${prefix}-stablecoins-governance`
	}
}
