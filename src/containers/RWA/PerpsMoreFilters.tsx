import { useRouter } from 'next/router'
import { useState } from 'react'
import {
	ActiveFilterCard,
	type ActiveFilterPill,
	FilterBrowser,
	FilterBuilderContent,
	FilterBuilderDialog,
	FilterNumberInput,
	NoActiveFilters
} from '~/components/FilterBuilderDialog'
import { useMedia } from '~/hooks/useMedia'
import { describeSelection, SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { clearRwaFilterQueryKeys } from './filterState'
import { getRwaPerpsPickerOptions } from './inlineOptions'
import {
	countRwaPerpsFilters,
	createRwaPerpsFilterDraft,
	getRwaPerpsDialogFilters,
	getRwaPerpsFilterPills,
	serializeRwaPerpsFilterDraft,
	type RWAPerpsFilterDefinition,
	type RWAPerpsFilterDraft,
	type RWAPerpsFilterGroup,
	type RWAPerpsRangeUnit
} from './perpsFilters'

/* The Perps tree's More filters: the same dialog as the Assets tree over the market's own fields
   (perpsFilters.ts holds the list and the URL rules). */

const GROUPS: Array<RWAPerpsFilterGroup> = ['Market', 'Classification', 'Metrics']

/** A range pill's bounds in the filter's unit: "$1m - no max". */
function formatRange({ min, max }: { min: number | null; max: number | null }, unit: RWAPerpsRangeUnit): string {
	const bound = (value: number | null, missing: string) =>
		value == null
			? missing
			: unit === 'usd'
				? formatUsd(value, { compact: true })
				: unit === 'x'
					? `${value}x`
					: formatPercent(value, { input: 'percent' })
	return `${bound(min, 'no min')} - ${bound(max, 'no max')}`
}

/** The strip's pills for the set filters More filters holds (below sm the inline ones too); each clears its own keys. */
export function useRwaPerpsFilterPills(definitions: ReadonlyArray<RWAPerpsFilterDefinition>): Array<ActiveFilterPill> {
	const router = useRouter()
	const isPhone = useMedia('(max-width: 639px)')
	return getRwaPerpsFilterPills(router.query, getRwaPerpsDialogFilters(definitions, isPhone)).map((pill) => ({
		id: pill.definition.id,
		label: `${pill.definition.label}: ${
			pill.definition.kind === 'select'
				? describeSelection(pill.definition.values, pill.picked ?? [])
				: pill.definition.kind === 'range'
					? formatRange(pill.range ?? { min: null, max: null }, pill.definition.unit)
					: ''
		}`,
		onRemove: () => clearRwaFilterQueryKeys(router, pill.clearKeys)
	}))
}

/** The trigger and the dialog over the page's filters but Venue Type and, from sm, the inline ones. Below sm the strip
    hides the inline pickers (FilterStrip.tsx), so the dialog holds them and is the page's Filters. useMedia reads
    false on the server and the first client render, so the trigger hydrates with the desktop count. `label` is "More
    filters" beside inline pickers and "Filters" on the venue page. */
export function RWAPerpsMoreFilters({
	definitions,
	label = 'More filters'
}: {
	definitions: ReadonlyArray<RWAPerpsFilterDefinition>
	label?: string
}) {
	const router = useRouter()
	const isPhone = useMedia('(max-width: 639px)')
	const dialogFilters = getRwaPerpsDialogFilters(definitions, isPhone)
	return (
		<FilterBuilderDialog
			appliedCount={countRwaPerpsFilters(router.query, dialogFilters)}
			label={isPhone ? 'Filters' : label}
			labelType="smol"
		>
			<RWAPerpsFiltersSession definitions={dialogFilters} />
		</FilterBuilderDialog>
	)
}

type DraftSetter = (update: (current: RWAPerpsFilterDraft) => RWAPerpsFilterDraft) => void

function RWAPerpsFiltersSession({ definitions }: { definitions: ReadonlyArray<RWAPerpsFilterDefinition> }) {
	const router = useRouter()
	const [draft, setDraft] = useState(() => createRwaPerpsFilterDraft(router.query, definitions))
	const active = new Set<string>(draft.activeIds)
	const groups = GROUPS.map((group) => ({
		label: group,
		filters: definitions
			.filter((definition) => definition.group === group && !active.has(definition.id))
			.map((definition) => ({ id: definition.id, label: definition.label }))
	}))
	const activeDefinitions = draft.activeIds.flatMap((id) => definitions.filter((definition) => definition.id === id))

	return (
		<FilterBuilderContent
			draftCount={draft.activeIds.length}
			browse={
				<FilterBrowser
					groups={groups}
					onAdd={(id) =>
						setDraft((current) => ({
							...current,
							activeIds: current.activeIds.concat(id as RWAPerpsFilterDefinition['id'])
						}))
					}
				/>
			}
			active={
				activeDefinitions.length > 0 ? (
					activeDefinitions.map((definition) => (
						<ActiveFilterCard
							key={definition.id}
							label={definition.label}
							category={definition.group}
							onRemove={() =>
								setDraft((current) => ({
									...current,
									activeIds: current.activeIds.filter((id) => id !== definition.id)
								}))
							}
						>
							{definition.kind === 'select' ? (
								<SelectEditor definition={definition} draft={draft} setDraft={setDraft} />
							) : definition.kind === 'range' ? (
								<RangeEditor definition={definition} draft={draft} setDraft={setDraft} />
							) : null}
						</ActiveFilterCard>
					))
				) : (
					<NoActiveFilters />
				)
			}
			onClearAll={() => setDraft((current) => ({ ...current, activeIds: [] }))}
			onApply={() => void pushShallowQuery(router, serializeRwaPerpsFilterDraft(definitions, draft))}
		/>
	)
}

function SelectEditor({
	definition,
	draft,
	setDraft
}: {
	definition: Extract<RWAPerpsFilterDefinition, { kind: 'select' }>
	draft: RWAPerpsFilterDraft
	setDraft: DraftSetter
}) {
	return (
		<SelectWithCombobox
			allValues={getRwaPerpsPickerOptions(definition.values, definition.counts)}
			selectedValues={draft.selectValues[definition.id]}
			setSelectedValues={(values) =>
				setDraft((current) => ({ ...current, selectValues: { ...current.selectValues, [definition.id]: values } }))
			}
			label="Values"
			labelType="smol"
			variant="input"
			size="md"
			visibleOptionLimit={null}
			selectAllScope="matches"
			searchPlaceholder={`Search ${definition.label.toLowerCase()}…`}
			emptyLabel="No matches found"
			triggerProps={{ 'aria-label': `${definition.label} values` }}
		/>
	)
}

const UNIT_AFFIX: Record<RWAPerpsRangeUnit, { prefix?: string; suffix?: string }> = {
	usd: { prefix: '$' },
	x: { suffix: 'x' },
	percent: { suffix: '%' }
}

function RangeEditor({
	definition,
	draft,
	setDraft
}: {
	definition: Extract<RWAPerpsFilterDefinition, { kind: 'range' }>
	draft: RWAPerpsFilterDraft
	setDraft: DraftSetter
}) {
	const range = draft.ranges[definition.id]
	const update = (bound: 'min' | 'max', value: string) =>
		setDraft((current) => ({
			...current,
			ranges: { ...current.ranges, [definition.id]: { ...current.ranges[definition.id], [bound]: value } }
		}))
	return (
		<div className="flex items-center gap-2">
			<FilterNumberInput
				label={`${definition.label} minimum`}
				value={range.min}
				onChange={(value) => update('min', value)}
				placeholder="Min"
				{...UNIT_AFFIX[definition.unit]}
			/>
			<FilterNumberInput
				label={`${definition.label} maximum`}
				value={range.max}
				onChange={(value) => update('max', value)}
				placeholder="Max"
				{...UNIT_AFFIX[definition.unit]}
			/>
		</div>
	)
}
