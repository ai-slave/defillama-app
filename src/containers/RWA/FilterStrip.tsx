import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { ActiveFilterPills } from '~/components/FilterBuilderDialog'
import { ResetFiltersButton } from '~/components/Filters/ResetFiltersButton'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { Card } from '~/ui/Card'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { RWAOverviewDisplayRow } from './api.types'
import { RWAAssetsFilterPills, RWAAssetsMoreFilters, type RWAOverviewFiltersProps } from './Filters'
import { clearRwaFilterQueryKeys, getRwaExcludeQueryKey, isRwaSelectFilterShown } from './filterState'
import { RWAIncludeInTvlSelect } from './IncludeInTvl'
import { getRwaAssetsInlineOptions, getRwaPerpsPickerOptions, withRwaOptionCounts } from './inlineOptions'
import type { RWAAssetsInlineFilterKey } from './layout/inlineFilters'
import { RWAListYourAssetsButton } from './links'
import {
	getRwaVenueTypeQueryPatch,
	readRwaVenueTypeChoice,
	RWA_VENUE_TYPE_OPTIONS,
	type RWAPerpsFilterDefinition,
	type RWAVenueTypeChoice
} from './perpsFilters'
import { RWAPerpsMoreFilters, useRwaPerpsFilterPills } from './PerpsMoreFilters'

/* The filter strip above the chart, and the venue page's strip built from the same pieces. Filters.tsx holds the Assets tree's More filters, perpsFilters.ts the Perps tree's filter records. */

const ASSETS_INLINE_FILTER_LABELS: Record<RWAAssetsInlineFilterKey, string> = {
	categories: 'Category',
	assetGroups: 'Asset Group',
	accessModels: 'Access Model'
}

/** Reset all: clears the filter keys the page reads (`keys`), inline or behind More filters; the view and grouping
    stay. It stays rendered and is disabled until the page counts an active filter (never for a stray or empty key),
    so pressing it keeps focus on it. */
export function RWAResetAllFilters({ active, keys }: { active: boolean; keys: ReadonlyArray<string> }) {
	const router = useRouter()
	return (
		<ResetFiltersButton nestedMenu={false} disabled={!active} onClick={() => clearRwaFilterQueryKeys(router, keys)}>
			Reset all
		</ResetFiltersButton>
	)
}

export function RWAPerpsFilterPills({ filters }: { filters: ReadonlyArray<RWAPerpsFilterDefinition> }) {
	return <ActiveFilterPills pills={useRwaPerpsFilterPills(filters)} />
}

/** The Assets tree's inline pickers, in the order the page lists them; a picker with one option has nothing to offer. */
function RWAAssetsInlineFilters(props: RWAOverviewFiltersProps & { rows: ReadonlyArray<RWAOverviewDisplayRow> }) {
	return (
		<>
			{props.inlineFilters.map((key) => {
				const values = getAssetsInlineValues(key, props.options)
				if (!isRwaSelectFilterShown(key, props.modes.mode, values.length)) return null
				return (
					<Select
						key={key}
						allValues={getRwaAssetsInlineOptions(key, values, props.rows, props.selections)}
						label={ASSETS_INLINE_FILTER_LABELS[key]}
						labelType="smol"
						variant="filter"
						size="md"
						includeQueryKey={key}
						excludeQueryKey={getRwaExcludeQueryKey(key)}
					/>
				)
			})}
		</>
	)
}

function getAssetsInlineValues(key: RWAAssetsInlineFilterKey, options: RWAOverviewFiltersProps['options']) {
	switch (key) {
		case 'categories':
			return options.categoriesOptions
		case 'assetGroups':
			return options.assetGroups
		case 'accessModels':
			return options.accessModelOptions
	}
}

/** The Perps tree's inline pickers: its filter records flagged inline, each with its markets per option. */
function RWAPerpsInlineFilters({ definitions }: { definitions: ReadonlyArray<RWAPerpsFilterDefinition> }) {
	return (
		<>
			{definitions.map((definition) => {
				if (!definition.inline) return null
				if (definition.kind !== 'select') return null
				return (
					<SelectWithCombobox
						key={definition.id}
						allValues={getRwaPerpsPickerOptions(definition.values, definition.counts)}
						label={definition.label}
						labelType="smol"
						variant="filter"
						size="md"
						includeQueryKey={definition.includeKey}
						excludeQueryKey={definition.excludeKey}
						searchPlaceholder={`Search ${definition.label.toLowerCase()}…`}
					/>
				)
			})}
		</>
	)
}

function RWAVenueTypeFilter({ counts }: { counts: Record<RWAVenueTypeChoice, number> }) {
	const router = useRouter()
	const choice = readRwaVenueTypeChoice(router.query)
	/* The trigger reads the choice (DEX and CEX, DEX only, CEX only), never the field's name. */
	return (
		<Select
			heading="Venue Type"
			allValues={withRwaOptionCounts(RWA_VENUE_TYPE_OPTIONS, counts)}
			selectedValues={choice}
			setSelectedValues={(next: string) =>
				void pushShallowQuery(router, getRwaVenueTypeQueryPatch(next as RWAVenueTypeChoice))
			}
			label={RWA_VENUE_TYPE_OPTIONS.find((option) => option.key === choice)?.name ?? 'Venue Type'}
			triggerProps={{ 'aria-label': 'Venue Type dropdown' }}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)
}

/**
 * The left group shapes the page: the page controls (leading), Include in TVL (Assets tree) or Venue Type (Perps tree).
 * The right group narrows the rows: the inline filters, Reset all (enabled when the page counts an active filter), the
 * pills, More filters and List Your Assets. On the Perps tree every filter is a record of `perpsFilters`; the inline
 * ones draw here, the rest behind More filters. Below sm the strip keeps two rows with nothing set: the inline pickers
 * and List Your Assets hide, and More filters becomes the page's Filters, holding and counting the inline filters
 * (their pills show instead of their triggers). The pickers hide with CSS, so server and client HTML match.
 */
export function RWAOverviewFilters(
	props: RWAOverviewFiltersProps & {
		leading?: ReactNode
		/** The page's rows: the Assets inline pickers count them per option. */
		rows: ReadonlyArray<RWAOverviewDisplayRow>
		/** The page counts an active filter: Reset all is enabled. */
		active: boolean
		/** The keys Reset all clears. */
		resetKeys: ReadonlyArray<string>
		perpsFilters?: ReadonlyArray<RWAPerpsFilterDefinition>
	}
) {
	if (!props.enabled) return null
	const { perpsFilters } = props
	const venueType = perpsFilters?.find((definition) => definition.kind === 'venueType')
	return (
		<Card padding="sm" className="flex flex-wrap items-center gap-2">
			{props.leading}
			{props.showIncludeInTvl ? <RWAIncludeInTvlSelect defaultInclusion={props.defaultInclusion} size="md" /> : null}
			{venueType?.kind === 'venueType' ? <RWAVenueTypeFilter counts={venueType.counts} /> : null}
			<div className="flex flex-wrap items-center gap-2 sm:ml-auto">
				<div className="hidden sm:contents">
					{perpsFilters ? <RWAPerpsInlineFilters definitions={perpsFilters} /> : <RWAAssetsInlineFilters {...props} />}
				</div>
				<RWAResetAllFilters active={props.active} keys={props.resetKeys} />
				{perpsFilters ? <RWAPerpsFilterPills filters={perpsFilters} /> : <RWAAssetsFilterPills {...props} />}
				{perpsFilters ? <RWAPerpsMoreFilters definitions={perpsFilters} /> : <RWAAssetsMoreFilters {...props} />}
				<RWAListYourAssetsButton className="max-sm:hidden" />
			</div>
		</Card>
	)
}
