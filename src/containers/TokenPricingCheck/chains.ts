const CHAIN_NAMES: Record<string, string> = {
	arbitrum_nova: 'Arbitrum Nova',
	avax: 'Avalanche',
	bsc: 'BSC',
	bitcoincash: 'Bitcoin Cash',
	doge: 'Dogecoin',
	ethereumclassic: 'Ethereum Classic'
}

export function pricingChainName(chain: string, chainDisplayNames: Record<string, string>): string {
	return (
		chainDisplayNames[chain] ??
		CHAIN_NAMES[chain] ??
		chain.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
	)
}
