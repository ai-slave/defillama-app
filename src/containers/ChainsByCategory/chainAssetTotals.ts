import type { ChainAssetTotals } from '~/containers/BridgedTVL/api.types'
import { CHAIN_ASSET_OPTIONAL_CATEGORIES } from '~/containers/BridgedTVL/api.types'

export function mergeChainAssetTotals(
	current: ChainAssetTotals | null,
	next: ChainAssetTotals | null
): ChainAssetTotals | null {
	if (!current) return next
	if (!next) return current

	const merged: ChainAssetTotals = {
		total: { total: current.total.total + next.total.total },
		canonical: { total: current.canonical.total + next.canonical.total },
		thirdParty: { total: current.thirdParty.total + next.thirdParty.total }
	}
	// a section present on either side survives the merge, so summing a chain that reports the
	// eight-section split with one that reports five does not silently drop the extra sections
	for (const category of CHAIN_ASSET_OPTIONAL_CATEGORIES) {
		if (current[category] === undefined && next[category] === undefined) continue
		merged[category] = { total: (current[category]?.total ?? 0) + (next[category]?.total ?? 0) }
	}
	return merged
}
