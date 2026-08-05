import type { ChainAssetTotals } from '~/containers/BridgedTVL/api.types'

export function mergeChainAssetTotals(
	current: ChainAssetTotals | null,
	next: ChainAssetTotals | null
): ChainAssetTotals | null {
	if (!current) return next
	if (!next) return current

	const nativeTotal =
		current.native !== undefined || next.native !== undefined
			? { native: { total: (current.native?.total ?? 0) + (next.native?.total ?? 0) } }
			: {}
	const ownTokensTotal =
		current.ownTokens !== undefined || next.ownTokens !== undefined
			? { ownTokens: { total: (current.ownTokens?.total ?? 0) + (next.ownTokens?.total ?? 0) } }
			: {}

	return {
		total: { total: current.total.total + next.total.total },
		canonical: { total: current.canonical.total + next.canonical.total },
		thirdParty: { total: current.thirdParty.total + next.thirdParty.total },
		...nativeTotal,
		...ownTokensTotal
	}
}
