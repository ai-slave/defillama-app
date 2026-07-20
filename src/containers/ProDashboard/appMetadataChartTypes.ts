import type { IChainMetadata } from '~/utils/metadata/types'
import { getChainChartTypes } from './types'

export function getAvailableChainChartTypes(flags: IChainMetadata | undefined, opts?: { hasGeckoId?: boolean }) {
	if (!flags) return []
	const types = new Set<string>()
	types.add('tvl')
	if (flags.dexs) types.add('volume')
	if (flags.fees) {
		types.add('fees')
		types.add('bribes')
		types.add('tokenTax')
	}
	if (flags.revenue) types.add('revenue')
	if (flags.dexAggregators) types.add('aggregators')
	if (flags.perps) types.add('perps')
	if (flags.bridgeAggregators) types.add('bridgeAggregators')
	if (flags.perpsAggregators) types.add('perpsAggregators')
	if (flags.optionsPremiumVolume) types.add('optionsPremium')
	if (flags.optionsNotionalVolume) types.add('optionsNotional')
	if (flags.chainActiveUsers) {
		types.add('activeUsers')
		types.add('users')
	}
	if (flags.chainNewUsers) types.add('newUsers')
	if (flags.txCount) types.add('txs')
	if (flags.gasUsed) types.add('gasUsed')
	if (flags.chainAssets) types.add('bridgedTvl')
	if (flags.stablecoins) types.add('stablecoins')
	if (flags.inflows) types.add('stablecoinInflows')
	if (flags.chainFees) types.add('chainFees')
	if (flags.chainRevenue) types.add('chainRevenue')
	if (opts?.hasGeckoId || flags.gecko_id) {
		types.add('chainMcap')
		types.add('chainPrice')
	}
	const allowed = new Set(getChainChartTypes())
	return Array.from(types).filter((type) => allowed.has(type))
}
