export function hasVisibleChainAssetTotal(total: number | null | undefined): boolean {
	return total != null && total > 0
}
