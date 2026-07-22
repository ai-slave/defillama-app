import { applyProtocolTvlSettings } from '~/containers/ProtocolLists/utils'
import type { TvlSettingsKey } from '~/contexts/LocalStorage'
import type { IProtocol } from './types'

export function prepareProtocolsForTable({
	protocols,
	extraTvlsEnabled,
	minTvl,
	maxTvl,
	suppressTvlStrike
}: {
	protocols: IProtocol[]
	extraTvlsEnabled: Record<TvlSettingsKey, boolean>
	minTvl: number | null
	maxTvl: number | null
	suppressTvlStrike: boolean
}) {
	const adjusted = applyProtocolTvlSettings({ protocols, extraTvlsEnabled, minTvl, maxTvl })
	if (!suppressTvlStrike) return adjusted

	const sourceBySlug = new Map(protocols.map((protocol) => [protocol.slug, protocol]))
	return adjusted.map((protocol) => {
		const source = sourceBySlug.get(protocol.slug)
		const sourceChildrenBySlug = new Map(source?.childProtocols?.map((child) => [child.slug, child]) ?? [])
		return {
			...protocol,
			strikeTvl: false,
			tvl:
				protocol.tvl && source?.tvl?.excludeParent
					? { ...protocol.tvl, excludeParent: source.tvl.excludeParent }
					: protocol.tvl,
			childProtocols: protocol.childProtocols?.map((child) => {
				const sourceChild = sourceChildrenBySlug.get(child.slug)
				return {
					...child,
					strikeTvl: false,
					tvl:
						child.tvl && sourceChild?.tvl?.excludeParent
							? { ...child.tvl, excludeParent: sourceChild.tvl.excludeParent }
							: child.tvl
				}
			})
		}
	})
}
