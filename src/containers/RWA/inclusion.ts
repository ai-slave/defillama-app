import type { RWAOverviewInclusionDefaults } from './constants'

/** Scope toggles shared by the Include in TVL dropdown and the dialog. */
export type RWAInclusionKey = 'includeStablecoins' | 'includeGovernance' | 'includeWrappers' | 'includeBridgeTvl'

export const RWA_INCLUSION_OPTIONS: ReadonlyArray<{ key: RWAInclusionKey; name: string }> = [
	{ key: 'includeStablecoins', name: 'Stablecoins' },
	{ key: 'includeGovernance', name: 'Governance Tokens' },
	{ key: 'includeWrappers', name: 'Wrappers' },
	{ key: 'includeBridgeTvl', name: 'Bridge/Interop TVL' }
]

/** Page default for one toggle: bridge on and wrappers off unless the page says otherwise. */
export function getRwaInclusionDefault(defaults: RWAOverviewInclusionDefaults, key: RWAInclusionKey): boolean {
	switch (key) {
		case 'includeStablecoins':
			return defaults.includeStablecoins
		case 'includeGovernance':
			return defaults.includeGovernance
		case 'includeWrappers':
			return defaults.includeWrappers ?? false
		case 'includeBridgeTvl':
			return defaults.includeBridgeTvl ?? true
	}
}
