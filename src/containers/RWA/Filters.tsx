import { useRouter } from 'next/router'
import { useState, type ReactNode } from 'react'
import {
	ActiveFilterCard,
	ActiveFilterPills,
	type ActiveFilterPill,
	FilterBrowser,
	FilterBuilderContent,
	FilterBuilderDialog,
	FilterNumberInput,
	NoActiveFilters
} from '~/components/FilterBuilderDialog'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { describeSelection, SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { ExcludeQueryKey, SelectValues } from '~/components/Select/types'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { formatPercent } from '~/utils/numberFormat'
import { parseNumberInput, pushShallowQuery } from '~/utils/routerQuery'
import type { IRWAAssetsOverview } from './api.types'
import type { RWAOverviewMode } from './constants'
import { definitions } from './definitions'
import {
	clearRwaFilterQueryKeys,
	getRwaExcludeQueryKey,
	getRwaInclusionQueryValue,
	hasActiveInclusionOverride,
	isRwaSelectFilterShown,
	RWA_ATTRIBUTE_FILTER_KEYS,
	RWA_ATTRIBUTE_FILTER_STATES,
	RWA_RATIO_FILTER_KEYS,
	RWA_SELECT_FILTER_KEYS,
	type RWAAttributeFilterKey,
	type RWAAttributeFilterState,
	type RWASelectFilterKey
} from './filterState'
import { RWAIncludeInTvlSelect } from './IncludeInTvl'
import { getRwaInclusionDefault, RWA_INCLUSION_OPTIONS, type RWAInclusionKey } from './inclusion'
import { RWAListYourAssetsButton } from './links'

/* inputStyles as a label shell: the wrapper carries the field chrome and
   focus-within lights the border while the inner input stays bare. */
const ATTRIBUTE_FILTER_STATE_LABELS: Record<RWAAttributeFilterState, string> = {
	yes: 'Yes',
	no: 'No',
	unknown: 'Unknown'
}
const ATTRIBUTE_FILTER_OPTIONS = RWA_ATTRIBUTE_FILTER_STATES.map((state) => ({
	key: state,
	name: ATTRIBUTE_FILTER_STATE_LABELS[state]
}))

const DIALOG_FILTER_QUERY_KEYS: Array<string> = [
	...RWA_SELECT_FILTER_KEYS.flatMap((key) => [key, getRwaExcludeQueryKey(key)]),
	...RWA_ATTRIBUTE_FILTER_KEYS.flatMap((key) => [key, getRwaExcludeQueryKey(key)]),
	...RWA_RATIO_FILTER_KEYS
]

const formatPercentRange = (minPercent: number | null, maxPercent: number | null) => {
	const minLabel = minPercent != null ? formatPercent(minPercent, { input: 'percent' }) : 'no min'
	const maxLabel = maxPercent != null ? formatPercent(maxPercent, { input: 'percent' }) : 'no max'
	return `${minLabel} - ${maxLabel}`
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
	selectedAssetNames: Array<string>
	selectedTypes: Array<string>
	selectedCategories: Array<string>
	selectedPlatforms: Array<string>
	selectedAssetGroups: Array<string>
	selectedAssetClasses: Array<string>
	selectedRwaClassifications: Array<string>
	selectedAccessModels: Array<string>
	selectedIssuers: Array<string>
	selectedRedeemableStates: Array<RWAAttributeFilterState>
	selectedAttestationsStates: Array<RWAAttributeFilterState>
	selectedCexListedStates: Array<RWAAttributeFilterState>
	selectedKycForMintRedeemStates: Array<RWAAttributeFilterState>
	selectedKycAllowlistedWhitelistedToTransferHoldStates: Array<RWAAttributeFilterState>
	selectedTransferableStates: Array<RWAAttributeFilterState>
	selectedSelfCustodyStates: Array<RWAAttributeFilterState>
	minDefiActiveTvlToOnChainMcapPct: number | null
	maxDefiActiveTvlToOnChainMcapPct: number | null
	minActiveMcapToOnChainMcapPct: number | null
	maxActiveMcapToOnChainMcapPct: number | null
	minDefiActiveTvlToActiveMcapPct: number | null
	maxDefiActiveTvlToActiveMcapPct: number | null
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	includeWrappers: boolean
}

type RWAFilterActions = {
	setDefiActiveTvlToOnChainMcapPctRange: (minValue: string | number | null, maxValue: string | number | null) => void
	setActiveMcapToOnChainMcapPctRange: (minValue: string | number | null, maxValue: string | number | null) => void
	setDefiActiveTvlToActiveMcapPctRange: (minValue: string | number | null, maxValue: string | number | null) => void
}

type RWAOverviewFiltersProps = {
	enabled: boolean
	defaultInclusion: IRWAAssetsOverview['defaultInclusion']
	modes: RWAFilterModes
	options: RWAFilterOptions
	selections: RWAFilterSelections
	actions: RWAFilterActions
}

type RWAAttributeFilterConfig = {
	queryKey: RWAAttributeFilterKey
	label: string
	selectedStates: Array<RWAAttributeFilterState>
}

type RWASelectFilterConfig = {
	enabled: boolean
	allValues: SelectValues
	selectedValues: Array<string>
	includeQueryKey: RWASelectFilterKey
	excludeQueryKey: ExcludeQueryKey
	label: string
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

type RWAInclusionFilterConfig = {
	id: RWAInclusionKey
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
	activeIds: Array<string>
	selectValues: Record<string, Array<string>>
	ranges: Record<string, RWARangeDraft>
	attributeStates: Record<string, Array<RWAAttributeFilterState>>
	inclusion: Record<RWAInclusionKey, boolean>
}

const toggleAttributeFilterState = (
	selectedStates: Array<RWAAttributeFilterState>,
	state: RWAAttributeFilterState
): Array<RWAAttributeFilterState> => {
	const selectedSet = new Set(selectedStates)
	if (selectedSet.has(state)) {
		selectedSet.delete(state)
	} else {
		selectedSet.add(state)
	}
	return RWA_ATTRIBUTE_FILTER_STATES.filter((value) => selectedSet.has(value))
}

function getRwaSelectFilters({
	modes,
	options,
	selections
}: Pick<RWAOverviewFiltersProps, 'modes' | 'options' | 'selections'>): Array<RWASelectFilterConfig> {
	const selectFilter = (
		key: RWASelectFilterKey,
		allValues: SelectValues,
		selectedValues: Array<string>,
		label: string
	): RWASelectFilterConfig => ({
		enabled: isRwaSelectFilterShown(key, modes.mode, allValues.length),
		allValues,
		selectedValues,
		includeQueryKey: key,
		excludeQueryKey: getRwaExcludeQueryKey(key),
		label
	})
	return [
		selectFilter('types', options.typeOptions, selections.selectedTypes, 'Types'),
		selectFilter('assetNames', options.assetNames, selections.selectedAssetNames, 'Asset Names'),
		selectFilter('assetGroups', options.assetGroups, selections.selectedAssetGroups, 'Asset Groups'),
		selectFilter('categories', options.categoriesOptions, selections.selectedCategories, 'Categories'),
		selectFilter('platforms', options.platforms, selections.selectedPlatforms, 'Platforms'),
		selectFilter('assetClasses', options.assetClassOptions, selections.selectedAssetClasses, 'Asset Classes'),
		selectFilter(
			'rwaClassifications',
			options.rwaClassificationOptions,
			selections.selectedRwaClassifications,
			'RWA Classification'
		),
		selectFilter('accessModels', options.accessModelOptions, selections.selectedAccessModels, 'Access Model'),
		selectFilter('issuers', options.issuers, selections.selectedIssuers, 'Issuers')
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
			name: 'Active AUM / Onchain %',
			label: 'Active AUM / Onchain',
			min: selections.minActiveMcapToOnChainMcapPct,
			max: selections.maxActiveMcapToOnChainMcapPct,
			minQueryKey: 'minActiveMcapToOnChainMcapPct',
			maxQueryKey: 'maxActiveMcapToOnChainMcapPct',
			onSubmitRange: actions.setActiveMcapToOnChainMcapPctRange
		},
		{
			name: 'DeFi TVL / Active AUM %',
			label: 'DeFi TVL / Active AUM',
			min: selections.minDefiActiveTvlToActiveMcapPct,
			max: selections.maxDefiActiveTvlToActiveMcapPct,
			minQueryKey: 'minDefiActiveTvlToActiveMcapPct',
			maxQueryKey: 'maxDefiActiveTvlToActiveMcapPct',
			onSubmitRange: actions.setDefiActiveTvlToActiveMcapPctRange
		}
	] satisfies Array<RWARangeFilterConfig>
}

function getRwaAttributeFilters({
	selections
}: Pick<RWAOverviewFiltersProps, 'selections'>): Array<RWAAttributeFilterConfig> {
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

function getSelectOptionKeys(values: SelectValues): Array<string> {
	return values.map((value) => (typeof value === 'string' ? value : value.key))
}

function isSelectFilterNarrowed(config: RWASelectFilterConfig, values: Array<string>): boolean {
	return values.length < config.allValues.length
}

function getRwaInclusionFilters(props: RWAOverviewFiltersProps): Array<RWAInclusionFilterConfig> {
	return RWA_INCLUSION_OPTIONS.map((option) => ({
		id: option.key,
		label: option.name,
		value: props.selections[option.key],
		defaultValue: getRwaInclusionDefault(props.defaultInclusion, option.key)
	}))
}

function countRwaInclusionOverrides(props: RWAOverviewFiltersProps): number {
	let count = 0
	for (const config of getRwaInclusionFilters(props)) {
		if (config.value !== config.defaultValue) count += 1
	}
	return count
}

function getRwaFilterDefinitions(props: RWAOverviewFiltersProps): Array<RWAFilterDefinition> {
	const filterDefinitions: Array<RWAFilterDefinition> = []

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
	const activeIds: Array<string> = []
	const selectValues: Record<string, Array<string>> = {}
	const ranges: Record<string, RWARangeDraft> = {}
	const attributeStates: Record<string, Array<RWAAttributeFilterState>> = {}

	const pushActiveId = (id: string) => {
		if (!activeIds.includes(id)) activeIds.push(id)
	}

	for (const config of getRwaSelectFilters(props)) {
		if (!config.enabled) continue
		selectValues[config.includeQueryKey] = config.selectedValues.slice()
		if (isSelectFilterNarrowed(config, config.selectedValues)) pushActiveId(config.includeQueryKey)
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
		if (config.selectedStates.length < RWA_ATTRIBUTE_FILTER_STATES.length) pushActiveId(config.queryKey)
	}

	const inclusion: Record<RWAInclusionKey, boolean> = {
		includeStablecoins: false,
		includeGovernance: false,
		includeWrappers: false,
		includeBridgeTvl: true
	}
	for (const config of getRwaInclusionFilters(props)) inclusion[config.id] = config.value

	return { activeIds, selectValues, ranges, attributeStates, inclusion }
}

function serializeRwaFilterDraft(
	props: RWAOverviewFiltersProps,
	draft: RWAFilterDraft
): Record<string, string | Array<string> | undefined> {
	const filterDefinitions = getRwaFilterDefinitions(props)
	const updates: Record<string, string | Array<string> | undefined> = {}
	for (const key of DIALOG_FILTER_QUERY_KEYS) {
		updates[key] = undefined
	}
	for (const config of getRwaInclusionFilters(props)) {
		updates[config.id] = getRwaInclusionQueryValue(draft.inclusion[config.id], config.defaultValue)
	}

	const activeIds = new Set(draft.activeIds)
	for (const definition of filterDefinitions) {
		if (!activeIds.has(definition.id)) continue
		if (definition.kind === 'select') {
			const { includeQueryKey, excludeQueryKey, allValues } = definition.config
			Object.assign(
				updates,
				getQueryUpdatesFromSelected(
					includeQueryKey,
					excludeQueryKey,
					getSelectOptionKeys(allValues),
					draft.selectValues[definition.id]
				)
			)
		} else if (definition.kind === 'range') {
			const range = draft.ranges[definition.id]
			const min = parseNumberInput(range.min)
			const max = parseNumberInput(range.max)
			updates[definition.config.minQueryKey] = min == null ? undefined : String(min)
			updates[definition.config.maxQueryKey] = max == null ? undefined : String(max)
		} else if (definition.kind === 'attribute') {
			const { queryKey } = definition.config
			Object.assign(
				updates,
				getQueryUpdatesFromSelected(
					queryKey,
					getRwaExcludeQueryKey(queryKey),
					[...RWA_ATTRIBUTE_FILTER_STATES],
					draft.attributeStates[definition.id]
				)
			)
		}
	}

	return updates
}

function getRwaActiveFilterPills(
	props: RWAOverviewFiltersProps,
	router: ReturnType<typeof useRouter>
): Array<ActiveFilterPill> {
	const activeFilters: Array<ActiveFilterPill> = []

	for (const config of getRwaSelectFilters(props)) {
		if (!config.enabled || !isSelectFilterNarrowed(config, config.selectedValues)) continue
		activeFilters.push({
			id: config.includeQueryKey,
			label: `${config.label}: ${describeSelection(config.allValues, config.selectedValues)}`,
			onRemove: () => clearRwaFilterQueryKeys(router, [config.includeQueryKey, config.excludeQueryKey])
		})
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
		if (config.selectedStates.length === RWA_ATTRIBUTE_FILTER_STATES.length) continue
		activeFilters.push({
			id: config.queryKey,
			label: `${config.label}: ${describeSelection(ATTRIBUTE_FILTER_OPTIONS, config.selectedStates)}`,
			onRemove: () => clearRwaFilterQueryKeys(router, [config.queryKey, getRwaExcludeQueryKey(config.queryKey)])
		})
	}

	for (const config of getRwaInclusionFilters(props)) {
		if (!hasActiveInclusionOverride(router.query[config.id], config.defaultValue)) continue
		activeFilters.push({
			id: config.id,
			label: `${config.label}: ${config.value ? 'included' : 'excluded'}`,
			onRemove: () => clearRwaFilterQueryKeys(router, [config.id])
		})
	}

	return activeFilters
}

function RWAIncludeDraftSection({
	inclusionFilters,
	draft,
	onDraftChange
}: {
	inclusionFilters: Array<RWAInclusionFilterConfig>
	draft: RWAFilterDraft
	onDraftChange: (draft: RWAFilterDraft | ((current: RWAFilterDraft) => RWAFilterDraft)) => void
}) {
	return (
		<DialogPanelSection title="Include">
			<div className="flex flex-wrap gap-1">
				{inclusionFilters.map((config) => (
					<Checkbox
						key={config.id}
						variant="filter"
						value={config.id}
						checked={draft.inclusion[config.id]}
						onChange={() =>
							onDraftChange((current) => ({
								...current,
								inclusion: { ...current.inclusion, [config.id]: !current.inclusion[config.id] }
							}))
						}
					>
						<span className="whitespace-nowrap">{config.label}</span>
					</Checkbox>
				))}
			</div>
		</DialogPanelSection>
	)
}

/** Include in TVL and the Filters dialog. */
export function RWAOverviewFilterControls(props: RWAOverviewFiltersProps) {
	if (!props.enabled) return null

	const selectedFilterCount = createRwaFilterDraft(props).activeIds.length + countRwaInclusionOverrides(props)

	return (
		<>
			<RWAIncludeInTvlSelect defaultInclusion={props.defaultInclusion} size="md" />
			<FilterBuilderDialog appliedCount={selectedFilterCount}>
				<RWAFiltersSession {...props} />
			</FilterBuilderDialog>
		</>
	)
}

/**
 * The strip above the chart: the page controls (leading), the active filter pills, then Include in TVL,
 * Filters and List Your Assets. Everything here changes the page, so it sits above the page.
 */
export function RWAOverviewFilters(props: RWAOverviewFiltersProps & { leading?: ReactNode }) {
	const router = useRouter()

	if (!props.enabled) return null

	return (
		<Card padding="sm" className="flex flex-wrap items-center gap-2">
			{props.leading}
			<ActiveFilterPills pills={getRwaActiveFilterPills(props, router)} />
			<div className="flex flex-wrap items-center gap-2 sm:ml-auto">
				<RWAOverviewFilterControls {...props} />
				<RWAListYourAssetsButton />
			</div>
		</Card>
	)
}

function RWAFiltersSession(props: RWAOverviewFiltersProps) {
	const router = useRouter()
	const [draft, setDraft] = useState<RWAFilterDraft>(() => createRwaFilterDraft(props))
	const filterDefinitions = getRwaFilterDefinitions(props)
	const inclusionFilters = getRwaInclusionFilters(props)
	const draftCount =
		draft.activeIds.length +
		inclusionFilters.filter((config) => draft.inclusion[config.id] !== config.defaultValue).length
	const activeIds = new Set(draft.activeIds)
	const groups = FILTER_GROUPS.map((group) => ({
		label: group,
		filters: filterDefinitions.filter((definition) => definition.group === group && !activeIds.has(definition.id))
	}))
	const activeDefinitions = draft.activeIds.map((id) => filterDefinitions.find((definition) => definition.id === id)!)

	return (
		<FilterBuilderContent
			draftCount={draftCount}
			browse={<FilterBrowser groups={groups} onAdd={(id) => setDraft((current) => addDraftFilter(current, id))} />}
			active={
				<>
					<RWAIncludeDraftSection inclusionFilters={inclusionFilters} draft={draft} onDraftChange={setDraft} />
					{activeDefinitions.length > 0 ? (
						activeDefinitions.map((definition) => (
							<RWADraftFilterEditor
								key={definition.id}
								definition={definition}
								draft={draft}
								onDraftChange={setDraft}
							/>
						))
					) : (
						<NoActiveFilters />
					)}
				</>
			}
			onClearAll={() =>
				setDraft((current) => {
					const inclusion = { ...current.inclusion }
					for (const config of inclusionFilters) inclusion[config.id] = config.defaultValue
					return { ...current, activeIds: [], inclusion }
				})
			}
			onApply={() => void pushShallowQuery(router, serializeRwaFilterDraft(props, draft))}
		/>
	)
}

const FILTER_GROUPS: Array<RWAFilterDefinition['group']> = ['Classification', 'Ratios', 'Attributes']

function DialogPanelSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h4 className="label-xs tracking-wide text-tertiary uppercase">{title}</h4>
			{children}
		</section>
	)
}

function addDraftFilter(draft: RWAFilterDraft, id: string): RWAFilterDraft {
	// The draft already holds every filter's current values, so an added filter starts from them.
	return { ...draft, activeIds: draft.activeIds.concat(id) }
}

function removeDraftFilter(draft: RWAFilterDraft, id: string): RWAFilterDraft {
	return { ...draft, activeIds: draft.activeIds.filter((activeId) => activeId !== id) }
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
	return (
		<ActiveFilterCard
			label={definition.label}
			category={definition.group}
			onRemove={() => onDraftChange((current) => removeDraftFilter(current, definition.id))}
		>
			{definition.kind === 'select' ? (
				<RWASelectDraftEditor definition={definition} draft={draft} onDraftChange={onDraftChange} />
			) : definition.kind === 'range' ? (
				<RWARangeDraftEditor definition={definition} draft={draft} onDraftChange={onDraftChange} />
			) : (
				<RWAAttributeDraftEditor definition={definition} draft={draft} onDraftChange={onDraftChange} />
			)}
		</ActiveFilterCard>
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
	const selectedValues = draft.selectValues[definition.id]

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
			variant="input"
			size="md"
			visibleOptionLimit={null}
			selectAllScope="matches"
			searchPlaceholder={`Search ${definition.label.toLowerCase()}...`}
			emptyLabel="No matches found"
			triggerProps={{ 'aria-label': `${definition.label} values` }}
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
	const range = draft.ranges[definition.id]

	const updateRange = (key: keyof RWARangeDraft, value: string) => {
		onDraftChange((current) => ({
			...current,
			ranges: {
				...current.ranges,
				[definition.id]: { ...current.ranges[definition.id], [key]: value }
			}
		}))
	}

	return (
		<div className="flex items-center gap-2">
			<FilterNumberInput
				label={`${definition.label} minimum`}
				value={range.min}
				onChange={(value) => updateRange('min', value)}
				placeholder="Min"
				suffix="%"
			/>
			<FilterNumberInput
				label={`${definition.label} maximum`}
				value={range.max}
				onChange={(value) => updateRange('max', value)}
				placeholder="Max"
				suffix="%"
			/>
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
	const selectedStates = draft.attributeStates[definition.id]

	return (
		<div className="flex flex-wrap gap-1">
			{RWA_ATTRIBUTE_FILTER_STATES.map((state) => {
				const isSelected = selectedStates.includes(state)
				return (
					<Button
						key={state}
						type="button"
						variant="toggle"
						size="sm"
						aria-pressed={isSelected}
						data-active={isSelected}
						onClick={() =>
							onDraftChange((current) => ({
								...current,
								attributeStates: {
									...current.attributeStates,
									[definition.id]: toggleAttributeFilterState(current.attributeStates[definition.id], state)
								}
							}))
						}
					>
						{ATTRIBUTE_FILTER_STATE_LABELS[state]}
					</Button>
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
	getRwaInclusionFilters,
	removeDraftFilter,
	serializeRwaFilterDraft
}
