import type { RWAOverviewFiltersProps } from '../Filters'

/* The Assets filter strip props of a chain page with every option unfiltered. */

const actions = {
	setDefiActiveTvlToOnChainMcapPctRange: () => {},
	setActiveMcapToOnChainMcapPctRange: () => {},
	setDefiActiveTvlToActiveMcapPctRange: () => {}
}

export const baseProps: RWAOverviewFiltersProps = {
	enabled: true,
	defaultInclusion: { includeStablecoins: false, includeGovernance: false },
	modes: {
		mode: 'chain',
		isChainMode: true,
		isCategoryMode: false,
		isPlatformMode: false,
		isAssetGroupMode: false
	},
	options: {
		assetNames: ['USDY', 'USTB'],
		typeOptions: [
			{ key: 'Asset', name: 'Asset' },
			{ key: 'Platform', name: 'Platform' },
			{ key: 'Wrapper', name: 'Wrapper' }
		],
		categoriesOptions: [
			{ key: 'Treasuries', name: 'Treasuries' },
			{ key: 'Private Credit', name: 'Private Credit' }
		],
		platforms: ['Ondo', 'Maple', 'Centrifuge'],
		assetGroups: ['Bonds', 'Private Credit'],
		assetClassOptions: [
			{ key: 'Debt', name: 'Debt' },
			{ key: 'Fund', name: 'Fund' }
		],
		rwaClassificationOptions: [
			{ key: 'Tokenized Asset', name: 'Tokenized Asset' },
			{ key: 'Synthetic', name: 'Synthetic' }
		],
		accessModelOptions: [
			{ key: 'Permissioned', name: 'Permissioned' },
			{ key: 'Permissionless', name: 'Permissionless' }
		],
		issuers: ['Issuer One', 'Issuer Two'],
		chainSlug: null,
		categorySlug: null,
		platformSlug: null,
		assetGroupSlug: null
	},
	selections: {
		selectedAssetNames: ['USDY', 'USTB'],
		selectedTypes: ['Asset', 'Platform', 'Wrapper'],
		selectedCategories: ['Treasuries', 'Private Credit'],
		selectedPlatforms: ['Ondo', 'Maple', 'Centrifuge'],
		selectedAssetGroups: ['Bonds', 'Private Credit'],
		selectedAssetClasses: ['Debt', 'Fund'],
		selectedRwaClassifications: ['Tokenized Asset', 'Synthetic'],
		selectedAccessModels: ['Permissioned', 'Permissionless'],
		selectedIssuers: ['Issuer One', 'Issuer Two'],
		selectedRedeemableStates: ['yes', 'no', 'unknown'],
		selectedAttestationsStates: ['yes', 'no', 'unknown'],
		selectedCexListedStates: ['yes', 'no', 'unknown'],
		selectedKycForMintRedeemStates: ['yes', 'no', 'unknown'],
		selectedKycAllowlistedWhitelistedToTransferHoldStates: ['yes', 'no', 'unknown'],
		selectedTransferableStates: ['yes', 'no', 'unknown'],
		selectedSelfCustodyStates: ['yes', 'no', 'unknown'],
		minDefiActiveTvlToOnChainMcapPct: null,
		maxDefiActiveTvlToOnChainMcapPct: null,
		minActiveMcapToOnChainMcapPct: null,
		maxActiveMcapToOnChainMcapPct: null,
		minDefiActiveTvlToActiveMcapPct: null,
		maxDefiActiveTvlToActiveMcapPct: null,
		includeStablecoins: false,
		includeGovernance: false,
		includeBridgeTvl: true,
		includeWrappers: false
	},
	actions,
	inlineFilters: [],
	showIncludeInTvl: true
}

export function makeProps(overrides: Record<string, unknown> = {}) {
	return {
		...baseProps,
		...overrides,
		options: { ...baseProps.options, ...(overrides.options as Record<string, unknown> | undefined) },
		selections: { ...baseProps.selections, ...(overrides.selections as Record<string, unknown> | undefined) },
		modes: { ...baseProps.modes, ...(overrides.modes as Record<string, unknown> | undefined) }
	}
}
