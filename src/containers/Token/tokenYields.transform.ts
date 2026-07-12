import { matchesYieldPoolToken } from '~/containers/Yields/domain/tokenFilter'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'

const formatChain = (chain: string) => {
	if (chain.toLowerCase().includes('hyperliquid')) return 'Hyperliquid'
	return chain
}

export function filterTokenYieldRows(
	transformedPools: IYieldTableRow[],
	token: string,
	chains?: string | string[]
): IYieldTableRow[] {
	const chainList = (typeof chains === 'string' ? [chains] : chains || []).map(formatChain)
	const tokenFilter = token.trim()
	let filteredPools = transformedPools
	if (chainList.length > 0 && !chainList.includes('All')) {
		filteredPools = transformedPools.filter((pool) =>
			pool.chains.some((chain) => chainList.some((item) => item.toLowerCase() === chain.toLowerCase()))
		)
	}

	if (tokenFilter) {
		filteredPools = filteredPools.filter((pool) => matchesYieldPoolToken(pool.pool, tokenFilter))
	}

	return filteredPools.filter((pool) => (pool.tvl ?? 0) > 0).sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
}
