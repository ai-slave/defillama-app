const EQUITY_TABS = ['financials', 'overview', 'filings', 'tokens', 'markets', 'unlocks'] as const

export type EquityTab = (typeof EQUITY_TABS)[number]

export function getAvailableEquityTabs({
	hasFilings,
	hasOnchain,
	hasUnlocks
}: {
	hasFilings: boolean
	hasOnchain: boolean
	hasUnlocks: boolean
}): EquityTab[] {
	return EQUITY_TABS.filter((tab) => {
		if (tab === 'unlocks') return hasUnlocks
		if (tab === 'filings') return hasFilings
		if (tab === 'tokens' || tab === 'markets') return hasOnchain
		return true
	})
}
