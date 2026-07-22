import { buildProtocolValueChartQueryKey } from '~/containers/ProtocolOverview/valueChartSources'
import type { TvlSettingsKey } from '~/contexts/LocalStorage'
import { slug } from '~/utils'

export const COMPARE_PROTOCOL_TVL_KEYS = ['pool2', 'staking', 'borrowed', 'vesting'] as const
export type CompareProtocolTvlKey = (typeof COMPARE_PROTOCOL_TVL_KEYS)[number]

export function getCompareProtocolTvlSettings(
	extraTvlEnabled: Record<string, boolean>
): Record<TvlSettingsKey, boolean> {
	return {
		borrowed: !!extraTvlEnabled.borrowed,
		doublecounted: false,
		govtokens: false,
		liquidstaking: false,
		pool2: !!extraTvlEnabled.pool2,
		staking: !!extraTvlEnabled.staking,
		vesting: !!extraTvlEnabled.vesting
	}
}

export function getCompareProtocolExtraTvlKeys(extraTvlEnabled: Record<string, boolean>) {
	return COMPARE_PROTOCOL_TVL_KEYS.filter((key) => extraTvlEnabled[key])
}

export function buildCompareProtocolTvlRequestPlan(protocol: string, key?: CompareProtocolTvlKey) {
	const protocolSlug = slug(protocol)
	return {
		protocolSlug,
		queryKey: buildProtocolValueChartQueryKey({ source: 'tvl', protocol: protocolSlug, key })
	}
}
