/** Current coverage counts; weekly additions are protocol listings in the trailing seven days. */
export type SubscriptionCoverageData = {
	protocols: number
	protocolsAddedThisWeek: number
	chains: number
	yieldPools: number
	rwaAssets: number
}
