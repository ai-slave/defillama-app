import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useState, type ReactNode } from 'react'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { ExcludeQueryKey, SelectValues } from '~/components/Select/types'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { parseNumberInput, pushShallowQuery, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { IRWAAssetsOverview } from './api.types'
import { getDefaultRWAOverviewInclusion, getDefaultSelectedTypes, type RWAOverviewMode } from './constants'
import { definitions } from './definitions'
import { hasActiveInclusionOverride, updateAttributeFilterStatesQueryValue } from './filterState'

const ATTRIBUTE_FILTER_STATES = ['yes', 'no', 'unknown'] as const
type RWAAttributeFilterState = (typeof ATTRIBUTE_FILTER_STATES)[number]
const ATTRIBUTE_FILTER_STATE_LABELS: Record<RWAAttributeFilterState, string> = {
	yes: 'Yes',
	no: 'No',
	unknown: 'Unknown'
}

const DIALOG_FILTER_QUERY_KEYS = [
	'assetNames',
	'excludeAssetNames',
	'types',
	'excludeTypes',
	'categories',
	'excludeCategories',
	'platforms',
	'excludePlatforms',
	'assetGroups',
	'excludeAssetGroups',
	'assetClasses',
	'excludeAssetClasses',
	'rwaClassifications',
	'excludeRwaClassifications',
	'accessModels',
	'excludeAccessModels',
	'issuers',
	'excludeIssuers',
	'minDefiActiveTvlToOnChainMcapPct',
	'maxDefiActiveTvlToOnChainMcapPct',
	'minActiveMcapToOnChainMcapPct',
	'maxActiveMcapToOnChainMcapPct',
	'minDefiActiveTvlToActiveMcapPct',
	'maxDefiActiveTvlToActiveMcapPct',
	'redeemableStates',
	'attestationsStates',
	'cexListedStates',
	'kycForMintRedeemStates',
	'kycAllowlistedWhitelistedToTransferHoldStates',
	'transferableStates',
	'selfCustodyStates'
] as const

const FILTER_QUERY_KEYS = [
	...DIALOG_FILTER_QUERY_KEYS,
	'includeStablecoins',
	'includeGovernance',
	'includeRwaPerps'
] as const

const CHART_QUERY_KEYS = [
	'chartType',
	'chartView',
	'timeSeriesChartBreakdown',
	'nonTimeSeriesChartBreakdown',
	'treemapNestedBy',
	// Legacy key kept for cleanup when present in shared links/bookmarks.
	'pieChartBreakdown'
] as const

const RESETTABLE_QUERY_KEYS = [...FILTER_QUERY_KEYS, ...CHART_QUERY_KEYS] as const

const formatPercentRange = (minPercent: number | null, maxPercent: number | null) => {
	const minLabel = minPercent != null ? `${minPercent.toLocaleString()}%` : 'no min'
	const maxLabel = maxPercent != null ? `${maxPercent.toLocaleString()}%` : 'no max'
	return `${minLabel} - ${maxLabel}`
}

const formatActiveFilterValues = (values: readonly string[]) => {
	if (values.length === 0) return 'None'
	if (values.length <= 2) return values.join(', ')
	return `${values[0]}, ${values[1]} + ${values.length - 2}`
}

type RWAFilterModes = {
	mode: RWAOverviewMode
	isChainMode: boolean
	isCategoryMode: boolean
	isPlatformMode: boolean
	isAssetGroupMode: boolean
}

type RWAFilterOptions = {
	assetNames: IRWAAssetsOverview['assetNames']
	typeOptions: IRWAAssetsOverview['typeOptions']
	categoriesOptions: IRWAAssetsOverview['categoriesOptions']
	platforms: IRWAAssetsOverview['platforms']
	assetGroups: IRWAAssetsOverview['assetGroups']
	assetClassOptions: IRWAAssetsOverview['assetClassOptions']
	rwaClassificationOptions: IRWAAssetsOverview['rwaClassificationOptions']
	accessModelOptions: IRWAAssetsOverview['accessModelOptions']
	issuers: IRWAAssetsOverview['issuers']
	chainSlug: IRWAAssetsOverview['chainSlug']
	categorySlug: IRWAAssetsOverview['categorySlug']
	platformSlug: IRWAAssetsOverview['platformSlug']
	assetGroupSlug: IRWAAssetsOverview['assetGroupSlug']
}

type RWAFilterSelections = {
	selectedAssetNames: string[]
	selectedTypes: string[]
	selectedCategories: string[]
	selectedPlatforms: string[]
	selectedAssetGroups: string[]
	selectedAssetClasses: string[]
	selectedRwaClassifications: string[]
	selectedAccessModels: string[]
	selectedIssuers: string[]
	selectedRedeemableStates: RWAAttributeFilterState[]
	selectedAttestationsStates: RWAAttributeFilterState[]
	selectedCexListedStates: RWAAttributeFilterState[]
	selectedKycForMintRedeemStates: RWAAttributeFilterState[]
	selectedKycAllowlistedWhitelistedToTransferHoldStates: RWAAttributeFilterState[]
	selectedTransferableStates: RWAAttributeFilterState[]
	selectedSelfCustodyStates: RWAAttributeFilterState[]
	minDefiActiveTvlToOnChainMcapPct: number | null
	maxDefiActiveTvlToOnChainMcapPct: number | null
	minActiveMcapToOnChainMcapPct: number | null
	maxActiveMcapToOnChainMcapPct: number | null
	minDefiActiveTvlToActiveMcapPct: number | null
	maxDefiActiveTvlToActiveMcapPct: number | null
	includeStablecoins: boolean
	includeGovernance: boolean
	includeRwaPerps: boolean
}

type RWAFilterActions = {
	setDefiActiveTvlToOnChainMcapPctRange: (minValue: string | number | null, maxValue: string | number | null) => void
	setActiveMcapToOnChainMcapPctRange: (minValue: string | number | null, maxValue: string | number | null) => void
	setDefiActiveTvlToActiveMcapPctRange: (minValue: string | number | null, maxValue: string | number | null) => void
	setIncludeStablecoins: (value: boolean) => void
	setIncludeGovernance: (value: boolean) => void
	setIncludeRwaPerps: (value: boolean) => void
	setRedeemableStates: (values: RWAAttributeFilterState[]) => void
	setAttestationsStates: (values: RWAAttributeFilterState[]) => void
	setCexListedStates: (values: RWAAttributeFilterState[]) => void
	setKycForMintRedeemStates: (values: RWAAttributeFilterState[]) => void
	setKycAllowlistedWhitelistedToTransferHoldStates: (values: RWAAttributeFilterState[]) => void
	setTransferableStates: (values: RWAAttributeFilterState[]) => void
	setSelfCustodyStates: (values: RWAAttributeFilterState[]) => void
}

type RWAOverviewFiltersProps = {
	enabled: boolean
	modes: RWAFilterModes
	options: RWAFilterOptions
	selections: RWAFilterSelections
	actions: RWAFilterActions
}

type RWAAttributeFilterConfig = {
	queryKey: string
	label: string
	selectedStates: RWAAttributeFilterState[]
}

type RWASelectFilterConfig = {
	enabled: boolean
	allValues: SelectValues
	selectedValues: string[]
	includeQueryKey: string
	excludeQueryKey: ExcludeQueryKey
	label: string
	defaultSelectedValues?: string[]
}

type RWARangeFilterConfig = {
	name: string
	label: string
	min: number | null
	max: number | null
	minQueryKey: string
	maxQueryKey: string
	onSubmitRange: (minValue: string | number | null, maxValue: string | number | null) => void
}

type RWAActiveFilterPill = {
	id: string
	label: string
	onRemove: () => void
}

type RWAInclusionFilterConfig = {
	id: 'includeStablecoins' | 'includeGovernance' | 'includeRwaPerps'
	label: string
	value: boolean
	defaultValue: boolean
}

type RWAFilterDefinition =
	| { id: string; kind: 'select'; label: string; group: 'Classification'; config: RWASelectFilterConfig }
	| { id: string; kind: 'range'; label: string; group: 'Ratios'; config: RWARangeFilterConfig }
	| { id: string; kind: 'attribute'; label: string; group: 'Attributes'; config: RWAAttributeFilterConfig }

type RWARangeDraft = {
	min: string
	max: string
}

type RWAFilterDraft = {
	activeIds: string[]
	selectValues: Record<string, string[]>
	ranges: Record<string, RWARangeDraft>
	attributeStates: Record<string, RWAAttributeFilterState[]>
}

const toggleAttributeFilterState = (
	selectedStates: RWAAttributeFilterState[],
	state: RWAAttributeFilterState
): RWAAttributeFilterState[] => {
	const selectedSet = new Set(selectedStates)
	if (selectedSet.has(state)) {
		selectedSet.delete(state)
	} else {
		selectedSet.add(state)
	}
	return ATTRIBUTE_FILTER_STATES.filter((value) => selectedSet.has(value))
}

function getRwaSelectFilters({
	modes,
	options,
	selections
}: Pick<RWAOverviewFiltersProps, 'modes' | 'options' | 'selections'>): RWASelectFilterConfig[] {
	const defaultSelectedTypes = getDefaultSelectedTypes(
		options.typeOptions.map((o) => o.key),
		modes.mode,
		options.categorySlug
	)

	return [
		{
			enabled: options.typeOptions.length > 1,
			allValues: options.typeOptions,
			selectedValues: selections.selectedTypes,
			includeQueryKey: 'types',
			excludeQueryKey: 'excludeTypes',
			label: 'Types',
			defaultSelectedValues: defaultSelectedTypes
		},
		{
			enabled: modes.isPlatformMode && options.assetNames.length > 1,
			allValues: options.assetNames,
			selectedValues: selections.selectedAssetNames,
			includeQueryKey: 'assetNames',
			excludeQueryKey: 'excludeAssetNames',
			label: 'Asset Names'
		},
		{
			enabled: options.assetGroups.length > 1,
			allValues: options.assetGroups,
			selectedValues: selections.selectedAssetGroups,
			includeQueryKey: 'assetGroups',
			excludeQueryKey: 'excludeAssetGroups',
			label: 'Asset Groups'
		},
		{
			enabled: (modes.isChainMode || modes.isPlatformMode) && options.categoriesOptions.length > 1,
			allValues: options.categoriesOptions,
			selectedValues: selections.selectedCategories,
			includeQueryKey: 'categories',
			excludeQueryKey: 'excludeCategories',
			label: 'Categories'
		},
		{
			enabled: (modes.isChainMode || modes.isCategoryMode) && options.platforms.length > 1,
			allValues: options.platforms,
			selectedValues: selections.selectedPlatforms,
			includeQueryKey: 'platforms',
			excludeQueryKey: 'excludePlatforms',
			label: 'Platforms'
		},
		{
			enabled: options.assetClassOptions.length > 1,
			allValues: options.assetClassOptions,
			selectedValues: selections.selectedAssetClasses,
			includeQueryKey: 'assetClasses',
			excludeQueryKey: 'excludeAssetClasses',
			label: 'Asset Classes'
		},
		{
			enabled: options.rwaClassificationOptions.length > 1,
			allValues: options.rwaClassificationOptions,
			selectedValues: selections.selectedRwaClassifications,
			includeQueryKey: 'rwaClassifications',
			excludeQueryKey: 'excludeRwaClassifications',
			label: 'RWA Classification'
		},
		{
			enabled: options.accessModelOptions.length > 1,
			allValues: options.accessModelOptions,
			selectedValues: selections.selectedAccessModels,
			includeQueryKey: 'accessModels',
			excludeQueryKey: 'excludeAccessModels',
			label: 'Access Model'
		},
		{
			enabled: options.issuers.length > 1,
			allValues: options.issuers,
			selectedValues: selections.selectedIssuers,
			includeQueryKey: 'issuers',
			excludeQueryKey: 'excludeIssuers',
			label: 'Issuers'
		}
	]
}

function getRwaRangeFilters({ selections, actions }: Pick<RWAOverviewFiltersProps, 'selections' | 'actions'>) {
	return [
		{
			name: 'DeFi TVL / Onchain %',
			label: 'DeFi TVL / Onchain',
			min: selections.minDefiActiveTvlToOnChainMcapPct,
			max: selections.maxDefiActiveTvlToOnChainMcapPct,
			minQueryKey: 'minDefiActiveTvlToOnChainMcapPct',
			maxQueryKey: 'maxDefiActiveTvlToOnChainMcapPct',
			onSubmitRange: actions.setDefiActiveTvlToOnChainMcapPctRange
		},
		{
			name: 'Active Marketcap / Onchain %',
			label: 'Active Marketcap / Onchain',
			min: selections.minActiveMcapToOnChainMcapPct,
			max: selections.maxActiveMcapToOnChainMcapPct,
			minQueryKey: 'minActiveMcapToOnChainMcapPct',
			maxQueryKey: 'maxActiveMcapToOnChainMcapPct',
			onSubmitRange: actions.setActiveMcapToOnChainMcapPctRange
		},
		{
			name: 'DeFi TVL / Active Marketcap %',
			label: 'DeFi TVL / Active Marketcap',
			min: selections.minDefiActiveTvlToActiveMcapPct,
			max: selections.maxDefiActiveTvlToActiveMcapPct,
			minQueryKey: 'minDefiActiveTvlToActiveMcapPct',
			maxQueryKey: 'maxDefiActiveTvlToActiveMcapPct',
			onSubmitRange: actions.setDefiActiveTvlToActiveMcapPctRange
		}
	] satisfies RWARangeFilterConfig[]
}

function getRwaAttributeFilters({
	selections
}: Pick<RWAOverviewFiltersProps, 'selections'>): RWAAttributeFilterConfig[] {
	return [
		{
			queryKey: 'redeemableStates',
			label: definitions.redeemable.label,
			selectedStates: selections.selectedRedeemableStates
		},
		{
			queryKey: 'attestationsStates',
			label: definitions.attestations.label,
			selectedStates: selections.selectedAttestationsStates
		},
		{
			queryKey: 'cexListedStates',
			label: definitions.cexListed.label,
			selectedStates: selections.selectedCexListedStates
		},
		{
			queryKey: 'kycForMintRedeemStates',
			label: definitions.kycForMintRedeem.label,
			selectedStates: selections.selectedKycForMintRedeemStates
		},
		{
			queryKey: 'kycAllowlistedWhitelistedToTransferHoldStates',
			label: definitions.kycAllowlistedWhitelistedToTransferHold.label,
			selectedStates: selections.selectedKycAllowlistedWhitelistedToTransferHoldStates
		},
		{
			queryKey: 'transferableStates',
			label: definitions.transferable.label,
			selectedStates: selections.selectedTransferableStates
		},
		{
			queryKey: 'selfCustodyStates',
			label: definitions.selfCustody.label,
			selectedStates: selections.selectedSelfCustodyStates
		}
	]
}

function clearRwaFilterQueryKeys(router: ReturnType<typeof useRouter>, keys: readonly string[]) {
	const resetUpdates: Record<string, undefined> = {}
	for (const key of keys) {
		resetUpdates[key] = undefined
	}
	void pushShallowQuery(router, resetUpdates)
}

function getSelectOptionKeys(values: SelectValues): string[] {
	return values.map((value) => (typeof value === 'string' ? value : value.key))
}

function getDefaultSelectValues(config: RWASelectFilterConfig): string[] {
	const allKeys = getSelectOptionKeys(config.allValues)
	const validSet = new Set(allKeys)
	return config.defaultSelectedValues?.filter((value) => validSet.has(value)) ?? allKeys
}

function isDefaultSelectSelection(config: RWASelectFilterConfig, values: string[]): boolean {
	const defaultSelected = getDefaultSelectValues(config)
	const validSet = new Set(getSelectOptionKeys(config.allValues))
	const selected = values.filter((value) => validSet.has(value))
	const defaultSet = new Set(defaultSelected)
	return selected.length === defaultSelected.length && selected.every((value) => defaultSet.has(value))
}

function isAllSelectSelection(config: RWASelectFilterConfig, values: string[]): boolean {
	const allKeys = getSelectOptionKeys(config.allValues)
	const validSet = new Set(allKeys)
	const selected = values.filter((value) => validSet.has(value))
	const selectedSet = new Set(selected)
	return selected.length === allKeys.length && allKeys.every((value) => selectedSet.has(value))
}

function isDialogSelectFilterActive(config: RWASelectFilterConfig, values: string[]): boolean {
	return !isAllSelectSelection(config, values) || !isAllSelectSelection(config, getDefaultSelectValues(config))
}

function hasResettableRwaQueryParam(query: ReturnType<typeof useRouter>['query']): boolean {
	for (const key of RESETTABLE_QUERY_KEYS) {
		if (query[key] != null) return true
	}
	return false
}

function getRwaDefaultInclusion(props: RWAOverviewFiltersProps) {
	return getDefaultRWAOverviewInclusion({
		mode: props.modes.mode,
		chainSlug: props.options.chainSlug,
		categorySlug: props.options.categorySlug,
		platformSlug: props.options.platformSlug,
		assetGroupSlug: props.options.assetGroupSlug
	})
}

function getRwaInclusionFilters(props: RWAOverviewFiltersProps): RWAInclusionFilterConfig[] {
	const defaultInclusion = getRwaDefaultInclusion(props)

	return [
		{
			id: 'includeStablecoins',
			label: 'Stablecoins',
			value: props.selections.includeStablecoins,
			defaultValue: defaultInclusion.includeStablecoins
		},
		{
			id: 'includeGovernance',
			label: 'Governance Tokens',
			value: props.selections.includeGovernance,
			defaultValue: defaultInclusion.includeGovernance
		},
		{
			id: 'includeRwaPerps',
			label: 'RWA Perps',
			value: props.selections.includeRwaPerps,
			defaultValue: defaultInclusion.includeRwaPerps
		}
	]
}

function getRwaFilterDefinitions(props: RWAOverviewFiltersProps): RWAFilterDefinition[] {
	const filterDefinitions: RWAFilterDefinition[] = []

	for (const config of getRwaSelectFilters(props)) {
		if (config.enabled) {
			filterDefinitions.push({
				id: config.includeQueryKey,
				kind: 'select',
				label: config.label,
				group: 'Classification',
				config
			})
		}
	}

	for (const config of getRwaRangeFilters(props)) {
		filterDefinitions.push({ id: config.minQueryKey, kind: 'range', label: config.name, group: 'Ratios', config })
	}

	for (const config of getRwaAttributeFilters(props)) {
		filterDefinitions.push({ id: config.queryKey, kind: 'attribute', label: config.label, group: 'Attributes', config })
	}

	return filterDefinitions
}

function numberToDraftInput(value: number | null): string {
	return value == null ? '' : String(value)
}

function createRwaFilterDraft(props: RWAOverviewFiltersProps): RWAFilterDraft {
	const activeIds: string[] = []
	const selectValues: Record<string, string[]> = {}
	const ranges: Record<string, RWARangeDraft> = {}
	const attributeStates: Record<string, RWAAttributeFilterState[]> = {}

	const pushActiveId = (id: string) => {
		if (!activeIds.includes(id)) activeIds.push(id)
	}

	for (const config of getRwaSelectFilters(props)) {
		if (!config.enabled) continue
		selectValues[config.includeQueryKey] = config.selectedValues.slice()
		if (isDialogSelectFilterActive(config, config.selectedValues)) pushActiveId(config.includeQueryKey)
	}

	for (const config of getRwaRangeFilters(props)) {
		ranges[config.minQueryKey] = {
			min: numberToDraftInput(config.min),
			max: numberToDraftInput(config.max)
		}
		if (config.min != null || config.max != null) pushActiveId(config.minQueryKey)
	}

	for (const config of getRwaAttributeFilters(props)) {
		attributeStates[config.queryKey] = config.selectedStates.slice()
		if (config.selectedStates.length !== ATTRIBUTE_FILTER_STATES.length) pushActiveId(config.queryKey)
	}

	return { activeIds, selectValues, ranges, attributeStates }
}

function getSelectDraftQueryUpdates(
	config: RWASelectFilterConfig,
	values: string[]
): Record<string, string | string[] | undefined> {
	return getQueryUpdatesFromSelected(
		config.includeQueryKey,
		config.excludeQueryKey,
		getSelectOptionKeys(config.allValues),
		values,
		config.defaultSelectedValues
	)
}

function serializeRwaFilterDraft(
	filterDefinitions: RWAFilterDefinition[],
	draft: RWAFilterDraft
): Record<string, string | string[] | undefined> {
	const updates: Record<string, string | string[] | undefined> = {}
	for (const key of DIALOG_FILTER_QUERY_KEYS) {
		updates[key] = undefined
	}

	const activeIds = new Set(draft.activeIds)
	for (const definition of filterDefinitions) {
		if (definition.kind === 'select') {
			if (!activeIds.has(definition.id)) {
				if (isDialogSelectFilterActive(definition.config, getDefaultSelectValues(definition.config))) {
					Object.assign(
						updates,
						getSelectDraftQueryUpdates(definition.config, getSelectOptionKeys(definition.config.allValues))
					)
				}
				continue
			}
			Object.assign(updates, getSelectDraftQueryUpdates(definition.config, draft.selectValues[definition.id] ?? []))
		} else if (definition.kind === 'range') {
			if (!activeIds.has(definition.id)) continue
			const range = draft.ranges[definition.id] ?? { min: '', max: '' }
			const min = parseNumberInput(range.min)
			const max = parseNumberInput(range.max)
			updates[definition.config.minQueryKey] = min == null ? undefined : String(min)
			updates[definition.config.maxQueryKey] = max == null ? undefined : String(max)
		} else if (definition.kind === 'attribute') {
			if (!activeIds.has(definition.id)) continue
			updates[definition.config.queryKey] = updateAttributeFilterStatesQueryValue(
				draft.attributeStates[definition.id] ?? []
			)
		}
	}

	return updates
}

function getActiveSelectFilterPill(
	config: RWASelectFilterConfig,
	query: ReturnType<typeof useRouter>['query'],
	onRemove: () => void
): RWAActiveFilterPill | null {
	if (!config.enabled) return null

	const includeQuery = query[config.includeQueryKey]
	const excludeQuery = query[config.excludeQueryKey]
	if (includeQuery == null && excludeQuery == null) return null

	if (excludeQuery != null) {
		const validValues = new Set(getSelectOptionKeys(config.allValues))
		const excludedValues = toNonEmptyArrayParam(excludeQuery).filter((value) => validValues.has(value))
		if (excludedValues.length === 0 || isDefaultSelectSelection(config, config.selectedValues)) return null
		return {
			id: config.excludeQueryKey,
			label: `${config.label} excludes ${formatActiveFilterValues(excludedValues)}`,
			onRemove
		}
	}

	if (isDefaultSelectSelection(config, config.selectedValues)) return null

	return {
		id: config.includeQueryKey,
		label: `${config.label}: ${formatActiveFilterValues(config.selectedValues)}`,
		onRemove
	}
}

function getRwaActiveFilterPills(
	props: RWAOverviewFiltersProps,
	router: ReturnType<typeof useRouter>
): RWAActiveFilterPill[] {
	const activeFilters: RWAActiveFilterPill[] = []

	for (const config of getRwaSelectFilters(props)) {
		const pill = getActiveSelectFilterPill(config, router.query, () =>
			clearRwaFilterQueryKeys(router, [config.includeQueryKey, config.excludeQueryKey])
		)
		if (pill) activeFilters.push(pill)
	}

	for (const config of getRwaRangeFilters(props)) {
		if (config.min == null && config.max == null) continue
		activeFilters.push({
			id: `${config.minQueryKey}-${config.maxQueryKey}`,
			label: `${config.label}: ${formatPercentRange(config.min, config.max)}`,
			onRemove: () => config.onSubmitRange(null, null)
		})
	}

	for (const config of getRwaAttributeFilters(props)) {
		if (config.selectedStates.length === ATTRIBUTE_FILTER_STATES.length) continue
		const stateLabels = config.selectedStates.map((state) => ATTRIBUTE_FILTER_STATE_LABELS[state])
		activeFilters.push({
			id: config.queryKey,
			label: `${config.label}: ${formatActiveFilterValues(stateLabels)}`,
			onRemove: () => clearRwaFilterQueryKeys(router, [config.queryKey])
		})
	}

	return activeFilters
}

function hasActiveRwaInclusionOverride(props: RWAOverviewFiltersProps, router: ReturnType<typeof useRouter>): boolean {
	for (const config of getRwaInclusionFilters(props)) {
		if (hasActiveInclusionOverride(router.query[config.id], config.defaultValue)) return true
	}
	return false
}

function RWAActiveFilterPills({ pills }: { pills: RWAActiveFilterPill[] }) {
	if (pills.length === 0) return null

	return (
		<div className="flex flex-wrap gap-1">
			{pills.map((pill) => (
				<button
					key={pill.id}
					type="button"
					onClick={pill.onRemove}
					className="hover-wash group flex items-center gap-1 rounded-full border border-brand bg-brand-muted px-2 py-0.5 label-sm text-primary"
				>
					<span>{pill.label}</span>
					<Icon name="x" className="size-3 text-secondary group-hover:text-primary" />
				</button>
			))}
		</div>
	)
}

function RWAInclusionToggles({ selections, actions }: Pick<RWAOverviewFiltersProps, 'selections' | 'actions'>) {
	return (
		<>
			<Checkbox
				variant="filter"
				value="includeStablecoins"
				checked={selections.includeStablecoins}
				onChange={() => actions.setIncludeStablecoins(!selections.includeStablecoins)}
			>
				<span className="whitespace-nowrap">Stablecoins</span>
			</Checkbox>
			<Checkbox
				variant="filter"
				value="includeGovernance"
				checked={selections.includeGovernance}
				onChange={() => actions.setIncludeGovernance(!selections.includeGovernance)}
			>
				<span className="whitespace-nowrap">Governance Tokens</span>
			</Checkbox>
			<Checkbox
				variant="filter"
				value="includeRwaPerps"
				checked={selections.includeRwaPerps}
				onChange={() => actions.setIncludeRwaPerps(!selections.includeRwaPerps)}
			>
				<span className="whitespace-nowrap">RWA Perps</span>
			</Checkbox>
		</>
	)
}

export function RWAOverviewFilters(props: RWAOverviewFiltersProps) {
	const router = useRouter()

	if (!props.enabled) return null

	const activeFilterPills = getRwaActiveFilterPills(props, router)
	const hasActiveFilters = hasResettableRwaQueryParam(router.query) || hasActiveRwaInclusionOverride(props, router)
	const selectedFilterCount = createRwaFilterDraft(props).activeIds.length

	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
				<RWAActiveFilterPills pills={activeFilterPills} />
				<RWAFiltersDialog
					{...props}
					selectedFilterCount={selectedFilterCount}
					hasActiveFilterPills={activeFilterPills.length > 0}
				/>
				<RWAInclusionToggles selections={props.selections} actions={props.actions} />
				<Button
					type="button"
					size="md"
					onClick={() => clearRwaFilterQueryKeys(router, RESETTABLE_QUERY_KEYS)}
					disabled={!hasActiveFilters}
				>
					Reset filters
				</Button>
				<Button
					as={BasicLink}
					href="https://forms.defillama.com/rwa-submission"
					target="_blank"
					rel="noopener noreferrer"
					size="md"
				>
					<Icon name="external-link" height={14} width={14} />
					<span>List Your Assets</span>
				</Button>
				<Button
					as={BasicLink}
					href="https://docs.llama.fi/real-world-assets/real-world-assets"
					target="_blank"
					rel="noopener noreferrer"
					size="md"
				>
					<Icon name="external-link" height={14} width={14} />
					<span>Docs</span>
				</Button>
			</div>
		</Card>
	)
}

function RWAFiltersDialog({
	selectedFilterCount,
	hasActiveFilterPills,
	...props
}: RWAOverviewFiltersProps & { selectedFilterCount: number; hasActiveFilterPills: boolean }) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [draft, setDraft] = useState<RWAFilterDraft>(() => createRwaFilterDraft(props))
	const filterDefinitions = getRwaFilterDefinitions(props)
	const draftSelectedCount = draft.activeIds.length

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraft(createRwaFilterDraft(props))
		}
		setOpen(nextOpen)
	}

	const saveDraft = () => {
		void pushShallowQuery(router, serializeRwaFilterDraft(filterDefinitions, draft))
		setOpen(false)
	}

	return (
		<Ariakit.DialogProvider open={open} setOpen={handleOpenChange}>
			<Ariakit.DialogDisclosure render={<Button type="button" size="md" />}>
				<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 text-[10px] leading-none">
					{selectedFilterCount}
				</span>
				<span>{hasActiveFilterPills ? 'Edit' : 'Filters'}</span>
				<Icon name="pencil" className="size-3 text-tertiary" />
			</Ariakit.DialogDisclosure>
			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:900px] sm:max-h-[min(760px,calc(100%-32px))]`}
				unmountOnHide
				portal
			>
				<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<div className="flex items-baseline gap-2.5">
						<DialogHeading>Filters</DialogHeading>
						<span className="label-sm text-tertiary tabular-nums">{draftSelectedCount} selected</span>
					</div>
					<DialogCloseButton />
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] sm:overflow-hidden">
					<RWAFilterBrowser filterDefinitions={filterDefinitions} draft={draft} onDraftChange={setDraft} />
					<RWAActiveDraftFilters filterDefinitions={filterDefinitions} draft={draft} onDraftChange={setDraft} />
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-subtle bg-surface px-4 py-3">
					{draft.activeIds.length > 0 ? (
						<Button
							type="button"
							variant="ghost"
							size="md"
							onClick={() => setDraft((current) => ({ ...current, activeIds: [] }))}
							className="mr-auto"
						>
							Clear all
						</Button>
					) : (
						<span className="mr-auto label-sm text-tertiary">No filters selected</span>
					)}
					<Ariakit.DialogDismiss render={<Button size="md" />}>Cancel</Ariakit.DialogDismiss>
					<Button type="button" variant="primary" size="md" onClick={saveDraft}>
						Save filters
					</Button>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

function DialogPanelSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="label-xs tracking-wide text-tertiary uppercase">{title}</h3>
			{children}
		</section>
	)
}

function RWAFilterBrowser({
	filterDefinitions,
	draft,
	onDraftChange
}: {
	filterDefinitions: RWAFilterDefinition[]
	draft: RWAFilterDraft
	onDraftChange: (draft: RWAFilterDraft | ((current: RWAFilterDraft) => RWAFilterDraft)) => void
}) {
	const activeIds = new Set(draft.activeIds)
	const groups: Array<RWAFilterDefinition['group']> = ['Classification', 'Ratios', 'Attributes']

	return (
		<section className="order-2 flex min-h-0 flex-col border-t border-subtle max-sm:shrink-0 sm:order-1 sm:border-t-0 sm:border-r">
			<div className="border-b border-subtle px-4 py-2">
				<h3 className="label-sm text-secondary">Browse filters</h3>
			</div>
			<div className="flex thin-scrollbar flex-1 flex-col gap-5 overflow-y-auto p-4 max-sm:overflow-visible">
				{groups.map((group) => {
					const availableDefinitions = filterDefinitions.filter(
						(definition) => definition.group === group && !activeIds.has(definition.id)
					)
					if (availableDefinitions.length === 0) return null

					return (
						<DialogPanelSection key={group} title={group}>
							<div className="flex flex-wrap gap-1">
								{availableDefinitions.map((definition) => (
									<button
										key={definition.id}
										type="button"
										onClick={() => {
											onDraftChange((current) => addDraftFilter(current, definition))
										}}
										className="group flex items-center gap-1.5 rounded-full border border-subtle bg-transparent px-2.5 py-1 label-sm text-primary transition-[background-color,border-color,color] duration-150 ease-out hover:border-brand hover:bg-hover-row focus-visible:border-brand focus-visible:bg-hover-row"
									>
										<Icon name="plus" className="size-3 text-tertiary group-hover:text-link" />
										<span>{definition.label}</span>
									</button>
								))}
							</div>
						</DialogPanelSection>
					)
				})}
			</div>
		</section>
	)
}

function addDraftFilter(draft: RWAFilterDraft, definition: RWAFilterDefinition): RWAFilterDraft {
	if (draft.activeIds.includes(definition.id)) return draft

	const nextDraft = { ...draft, activeIds: draft.activeIds.concat(definition.id) }
	if (definition.kind === 'select' && !(definition.id in draft.selectValues)) {
		return {
			...nextDraft,
			selectValues: { ...draft.selectValues, [definition.id]: definition.config.selectedValues.slice() }
		}
	}
	if (definition.kind === 'range' && !(definition.id in draft.ranges)) {
		return {
			...nextDraft,
			ranges: {
				...draft.ranges,
				[definition.id]: {
					min: numberToDraftInput(definition.config.min),
					max: numberToDraftInput(definition.config.max)
				}
			}
		}
	}
	if (definition.kind === 'attribute' && !(definition.id in draft.attributeStates)) {
		return {
			...nextDraft,
			attributeStates: { ...draft.attributeStates, [definition.id]: definition.config.selectedStates.slice() }
		}
	}
	return nextDraft
}

function removeDraftFilter(draft: RWAFilterDraft, id: string): RWAFilterDraft {
	return { ...draft, activeIds: draft.activeIds.filter((activeId) => activeId !== id) }
}

function RWAActiveDraftFilters({
	filterDefinitions,
	draft,
	onDraftChange
}: {
	filterDefinitions: RWAFilterDefinition[]
	draft: RWAFilterDraft
	onDraftChange: (draft: RWAFilterDraft | ((current: RWAFilterDraft) => RWAFilterDraft)) => void
}) {
	const activeDefinitions = draft.activeIds
		.map((id) => filterDefinitions.find((definition) => definition.id === id))
		.filter((definition): definition is RWAFilterDefinition => Boolean(definition))

	return (
		<section className="order-1 flex min-h-0 flex-col max-sm:shrink-0 sm:order-2">
			<div className="border-b border-subtle px-4 py-2">
				<h3 className="label-sm text-secondary">Active filters</h3>
			</div>
			<div className="flex thin-scrollbar flex-1 flex-col gap-2 overflow-y-auto p-4 max-sm:overflow-visible">
				{activeDefinitions.length > 0 ? (
					activeDefinitions.map((definition) => (
						<RWADraftFilterEditor
							key={definition.id}
							definition={definition}
							draft={draft}
							onDraftChange={onDraftChange}
						/>
					))
				) : (
					<div className="rounded-md border border-dashed border-subtle bg-surface p-4 body-sm text-tertiary">
						Add filters from the list to narrow the table.
					</div>
				)}
			</div>
		</section>
	)
}

function RWADraftFilterEditor({
	definition,
	draft,
	onDraftChange
}: {
	definition: RWAFilterDefinition
	draft: RWAFilterDraft
	onDraftChange: (draft: RWAFilterDraft | ((current: RWAFilterDraft) => RWAFilterDraft)) => void
}) {
	const remove = () => onDraftChange((current) => removeDraftFilter(current, definition.id))

	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="truncate label-sm text-primary">{definition.label}</span>
					<span className="rounded-full bg-surface-elevated-2 px-1.5 py-0.5 label-sm text-secondary uppercase">
						{definition.group}
					</span>
				</div>
				<button
					type="button"
					onClick={remove}
					className="rounded p-1 text-tertiary hover:bg-hover-row hover:text-primary"
				>
					<Icon name="x" className="size-3.5" />
					<span className="sr-only">Remove {definition.label} filter</span>
				</button>
			</div>
			{definition.kind === 'select' ? (
				<RWASelectDraftEditor definition={definition} draft={draft} onDraftChange={onDraftChange} />
			) : definition.kind === 'range' ? (
				<RWARangeDraftEditor definition={definition} draft={draft} onDraftChange={onDraftChange} />
			) : (
				<RWAAttributeDraftEditor definition={definition} draft={draft} onDraftChange={onDraftChange} />
			)}
		</Card>
	)
}

function RWASelectDraftEditor({
	definition,
	draft,
	onDraftChange
}: {
	definition: Extract<RWAFilterDefinition, { kind: 'select' }>
	draft: RWAFilterDraft
	onDraftChange: (draft: RWAFilterDraft | ((current: RWAFilterDraft) => RWAFilterDraft)) => void
}) {
	const selectedValues = draft.selectValues[definition.id] ?? []

	return (
		<SelectWithCombobox
			allValues={definition.config.allValues}
			selectedValues={selectedValues}
			setSelectedValues={(values) =>
				onDraftChange((current) => ({
					...current,
					selectValues: { ...current.selectValues, [definition.id]: values }
				}))
			}
			label="Values"
			labelType="smol"
			variant="filter-responsive"
			size="sm"
			visibleOptionLimit={null}
			selectAllScope="matches"
			searchPlaceholder={`Search ${definition.label.toLowerCase()}...`}
			emptyLabel="No matches found"
			popoverClassName="z-100 max-sm:h-[88dvh]! max-sm:max-h-[88dvh] max-sm:w-full sm:min-w-[260px] sm:max-h-[min(360px,60dvh)]! lg:max-h-[min(360px,60dvh)]!"
			triggerProps={{
				'aria-label': `${definition.label} values`,
				className:
					'flex min-h-8 min-w-0 cursor-pointer items-center gap-1.5 hover-wash rounded-[8px] border border-medium bg-page px-3 py-1.5 label-sm text-primary outline-hidden focus:border-brand'
			}}
		/>
	)
}

function RWARangeDraftEditor({
	definition,
	draft,
	onDraftChange
}: {
	definition: Extract<RWAFilterDefinition, { kind: 'range' }>
	draft: RWAFilterDraft
	onDraftChange: (draft: RWAFilterDraft | ((current: RWAFilterDraft) => RWAFilterDraft)) => void
}) {
	const range = draft.ranges[definition.id] ?? { min: '', max: '' }

	const updateRange = (key: keyof RWARangeDraft, value: string) => {
		onDraftChange((current) => ({
			...current,
			ranges: {
				...current.ranges,
				[definition.id]: { ...(current.ranges[definition.id] ?? { min: '', max: '' }), [key]: value }
			}
		}))
	}

	return (
		<div className="flex items-center gap-2">
			<label className="flex min-h-8 min-w-0 flex-1 items-center gap-1 rounded-[8px] border border-medium bg-page px-3 py-1.5 label-sm text-primary focus-within:border-brand">
				<span className="text-tertiary">Min %</span>
				<input
					type="number"
					min={0}
					step="0.01"
					value={range.min}
					onChange={(event) => updateRange('min', event.currentTarget.value)}
					className="min-w-0 flex-1 bg-transparent text-right outline-hidden placeholder:text-tertiary"
				/>
			</label>
			<label className="flex min-h-8 min-w-0 flex-1 items-center gap-1 rounded-[8px] border border-medium bg-page px-3 py-1.5 label-sm text-primary focus-within:border-brand">
				<span className="text-tertiary">Max %</span>
				<input
					type="number"
					min={0}
					step="0.01"
					value={range.max}
					onChange={(event) => updateRange('max', event.currentTarget.value)}
					className="min-w-0 flex-1 bg-transparent text-right outline-hidden placeholder:text-tertiary"
				/>
			</label>
		</div>
	)
}

function RWAAttributeDraftEditor({
	definition,
	draft,
	onDraftChange
}: {
	definition: Extract<RWAFilterDefinition, { kind: 'attribute' }>
	draft: RWAFilterDraft
	onDraftChange: (draft: RWAFilterDraft | ((current: RWAFilterDraft) => RWAFilterDraft)) => void
}) {
	const selectedStates = draft.attributeStates[definition.id] ?? [...ATTRIBUTE_FILTER_STATES]

	return (
		<div className="flex flex-wrap gap-1">
			{ATTRIBUTE_FILTER_STATES.map((state) => {
				const isSelected = selectedStates.includes(state)
				return (
					<button
						key={state}
						type="button"
						aria-pressed={isSelected}
						data-active={isSelected}
						onClick={() =>
							onDraftChange((current) => {
								const currentStates = current.attributeStates[definition.id] ?? [...ATTRIBUTE_FILTER_STATES]
								return {
									...current,
									attributeStates: {
										...current.attributeStates,
										[definition.id]: toggleAttributeFilterState(currentStates, state)
									}
								}
							})
						}
						className="hover-wash rounded-full border border-medium px-2.5 py-1 label-sm text-primary data-[active=true]:border-brand data-[active=true]:bg-brand-muted"
					>
						{ATTRIBUTE_FILTER_STATE_LABELS[state]}
					</button>
				)
			})}
		</div>
	)
}

export const RWA_FILTERS_TEST_UTILS = {
	addDraftFilter,
	createRwaFilterDraft,
	getRwaActiveFilterPills,
	getRwaFilterDefinitions,
	hasResettableRwaQueryParam,
	removeDraftFilter,
	serializeRwaFilterDraft
}
