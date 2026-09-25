import { PROTOCOL_LIST_ADDITIVE_TVL_KEYS, type ProtocolListAdditiveTvlKey } from '~/containers/ProtocolLists/api.types'
import { fetchProtocolTvlChart } from '~/containers/ProtocolOverview/api'
import { buildProtocolValueChartQueryKey } from '~/containers/ProtocolOverview/valueChartSources'
import type { TvlSettingsKey } from '~/contexts/LocalStorage'
import { slug } from '~/utils'

export function getCompareProtocolTvlSettings(
	extraTvlEnabled: Partial<Record<TvlSettingsKey, boolean>>
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

export function getCompareProtocolExtraTvlKeys(extraTvlEnabled: Partial<Record<TvlSettingsKey, boolean>>) {
	return PROTOCOL_LIST_ADDITIVE_TVL_KEYS.filter((key) => extraTvlEnabled[key])
}

export function normalizeCompareProtocolSelection(
	protocolQuery: string | Array<string> | undefined,
	protocolNameBySlug: ReadonlyMap<string, string>
): Array<string> {
	const values = typeof protocolQuery === 'string' ? [protocolQuery] : (protocolQuery ?? [])
	const selected: Array<string> = []
	const seen = new Set<string>()
	for (const value of values) {
		const protocol = value.trim()
		if (!protocol) continue
		const protocolSlug = slug(protocol)
		if (!protocolSlug || seen.has(protocolSlug)) continue
		seen.add(protocolSlug)
		selected.push(protocolNameBySlug.get(protocolSlug) ?? protocol)
	}
	return selected
}

export function buildCompareProtocolTvlQuery(protocol: string, key?: ProtocolListAdditiveTvlKey) {
	const protocolSlug = slug(protocol)
	return {
		queryKey: buildProtocolValueChartQueryKey({
			source: 'tvl',
			protocol: protocolSlug,
			...(key ? { key } : {})
		}),
		queryFn: () => fetchProtocolTvlChart({ protocol: protocolSlug, ...(key ? { key } : {}) })
	}
}
