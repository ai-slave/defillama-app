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
	protocols: Array<IProtocol>
	extraTvlsEnabled: Record<TvlSettingsKey, boolean>
	minTvl: number | null
	maxTvl: number | null
	suppressTvlStrike: boolean
}) {
	const adjusted = applyProtocolTvlSettings({ protocols, extraTvlsEnabled, minTvl, maxTvl })
	if (!suppressTvlStrike) return adjusted

	return adjusted.map((protocol) => {
		return {
			...protocol,
			strikeTvl: false,
			...(protocol.childProtocols
				? {
						childProtocols: protocol.childProtocols.map((child) => ({
							...child,
							strikeTvl: false
						}))
					}
				: {})
		}
	})
}
