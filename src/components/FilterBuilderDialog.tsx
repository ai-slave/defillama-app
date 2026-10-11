import * as Ariakit from '@ariakit/react'
import { Fragment, useDeferredValue, useState, type ReactNode } from 'react'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { CountBadge } from '~/ui/CountBadge'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { focusNeighbourOnLeave, keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { metricOptionChipStyles } from '~/ui/MetricChip'
import { NoResults } from '~/ui/NoResults'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SearchField } from '~/ui/SearchField'
import { EmptyState } from '~/ui/Status'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'

/* ----------------------------------------------------------------------------
   FilterBuilderDialog — the table filter builder: a Filters button with the
   applied count, and an `lg` dialog that edits a draft of the filters and
   applies it on Apply. One pane lists the filters to add as grouped chips
   (FilterBrowser, with a search from 12); the other holds an
   ActiveFilterCard per added filter around the page's own editor. Below sm
   the panes stack, the active filters first. Number editors use
   FilterNumberInput, which names each field ("Market cap minimum").

   The caller owns its draft: render a session component as the child and
   build its `useState` from the applied filters. Each opening remounts the
   child, so every opening starts from what the table shows and Cancel
   needs no reset. The session renders <FilterBuilderContent>.

   Adding or removing a filter keeps focus in its pane, and Clear all stays
   rendered (disabled at zero) so it keeps focus too.
---------------------------------------------------------------------------- */

export function FilterBuilderDialog({
	appliedCount,
	label = 'Filters',
	labelType = 'regular',
	children
}: {
	appliedCount: number
	/** The trigger's text; a page with inline filters beside it says "More filters". */
	label?: string
	/** 'smol' reads like the inline pickers beside it: the count first, always shown, then the label and a gear. */
	labelType?: 'regular' | 'smol'
	children: ReactNode
}) {
	const [open, setOpen] = useState(false)
	const opening = useOpeningKey(open)
	return (
		<Ariakit.DialogProvider open={open} setOpen={setOpen}>
			<Ariakit.DialogDisclosure
				render={<Button type="button" size="md" />}
				data-filter-builder
				// The smol trigger draws its count first, so the name is set here: "More filters", never "0 More filters".
				aria-label={appliedCount > 0 ? `${label}, ${appliedCount} applied` : label}
			>
				{labelType === 'smol' ? (
					<>
						<CountBadge count={appliedCount} />
						<span>{label}</span>
						<Icon name="settings" className="size-3.5 text-tertiary" />
					</>
				) : (
					<span>{label}</span>
				)}
				{labelType === 'regular' && appliedCount > 0 ? (
					<span className="min-w-4 rounded-full bg-brand-muted px-1 text-center label-xs text-link">
						{appliedCount}
					</span>
				) : null}
			</Ariakit.DialogDisclosure>
			<Dialog size="lg" fullSheet unmountOnHide portal>
				<Fragment key={opening}>{children}</Fragment>
			</Dialog>
		</Ariakit.DialogProvider>
	)
}

export function FilterBuilderContent({
	draftCount,
	browse,
	active,
	onClearAll,
	onApply
}: {
	/** Filters set in the draft, for the subtitle and Clear all. */
	draftCount: number
	/** A <FilterBrowser>. */
	browse: ReactNode
	/** One <ActiveFilterCard> per added filter, plus any always-on controls. */
	active: ReactNode
	onClearAll: () => void
	/** Writes the draft to the table; the dialog closes after it. */
	onApply: () => void
}) {
	const store = Ariakit.useDialogContext()!
	return (
		<>
			<DialogHeader title="Filters" subtitle={`${draftCount} selected`} />
			<DialogBody kind="flush">
				<div className="flex flex-col sm:grid sm:min-h-full sm:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
					<section
						aria-labelledby="filter-builder-active"
						data-filter-pane="active"
						className="flex flex-col gap-2 p-4 sm:order-2 sm:border-l sm:border-subtle"
					>
						<h3 id="filter-builder-active" className="label-sm text-secondary">
							Active filters
						</h3>
						{active}
					</section>
					<section
						aria-labelledby="filter-builder-browse"
						data-filter-pane="browse"
						className="flex flex-col gap-3 border-t border-subtle p-4 sm:order-1 sm:border-t-0"
					>
						<h3 id="filter-builder-browse" className="label-sm text-secondary">
							Add filters
						</h3>
						{browse}
					</section>
				</div>
			</DialogBody>
			<DialogFooter
				leading={
					// Disabled, not removed, at zero: the button keeps focus after it clears the draft.
					<Button
						type="button"
						variant="ghost"
						size="md"
						disabled={draftCount === 0}
						accessibleWhenDisabled
						onClick={onClearAll}
					>
						Clear all
					</Button>
				}
				dismiss={<DialogCancelButton />}
			>
				<Button
					type="button"
					variant="primary"
					size="md"
					onClick={() => {
						onApply()
						store.hide()
					}}
				>
					Apply
				</Button>
			</DialogFooter>
		</>
	)
}

/** The active pane before any filter is added; shared by every filter dialog. */
export function NoActiveFilters() {
	return (
		<EmptyState size="md" icon="settings" title="No filters applied">
			<span className="sm:hidden">Add filters from the list below to narrow the table.</span>
			<span className="max-sm:hidden">Add filters from the list to narrow the table.</span>
		</EmptyState>
	)
}

export interface FilterBrowserGroup<I extends string> {
	label: string
	filters: ReadonlyArray<{ id: I; label: string }>
}

// Long lists get a search; a short one fits on screen.
const SEARCH_MIN_FILTERS = 12

/** The add pane: every filter not yet added, as chips grouped by category, with a search for long lists. */
export function FilterBrowser<I extends string>({
	groups,
	onAdd
}: {
	/** Only the filters that are not in the draft yet. */
	groups: ReadonlyArray<FilterBrowserGroup<I>>
	onAdd: (id: I) => void
}) {
	const isSmallScreen = useMedia('(max-width: 639px)')
	const [search, setSearch] = useState('')
	const query = useDeferredValue(search).trim().toLowerCase()

	let total = 0
	const shownGroups: Array<FilterBrowserGroup<I>> = []
	for (const group of groups) {
		total += group.filters.length
		const filters = query ? group.filters.filter((filter) => filter.label.toLowerCase().includes(query)) : group.filters
		if (filters.length > 0) shownGroups.push({ label: group.label, filters })
	}

	return (
		<>
			{total >= SEARCH_MIN_FILTERS || search ? (
				// Phones skip the autofocus: the keyboard would cover the filters before anyone asked to search.
				<SearchField
					label="Search filters"
					placeholder={`Search ${total} filters…`}
					value={search}
					onChange={setSearch}
					autoFocus={!isSmallScreen}
				/>
			) : null}
			{total === 0 ? (
				<p className="body-sm text-tertiary">Every filter is added.</p>
			) : shownGroups.length === 0 ? (
				<NoResults>No filters match “{search.trim()}”</NoResults>
			) : (
				shownGroups.map((group) => (
					<section key={group.label} aria-label={group.label} className="flex flex-col gap-2">
						<p aria-hidden="true" className="label-xs tracking-wide text-tertiary uppercase">
							{group.label}
						</p>
						<div className="flex flex-wrap gap-1 sheet:gap-2">
							{group.filters.map((filter) => (
								<button
									key={filter.id}
									type="button"
									onClick={(event) => {
										// The chip leaves the list once its filter is added. Focus moves to the chip that takes its
										// place, so a keyboard can add several in a row; with no chip left, the dialog's net takes it.
										const chips = [
											...event.currentTarget
												.closest('[data-filter-pane]')!
												.querySelectorAll<HTMLElement>('[data-filter-chip]')
										]
										const index = chips.indexOf(event.currentTarget)
										const next = chips[index + 1] ?? chips[index - 1]
										keepFocus(
											() => onAdd(filter.id),
											() => next
										)
									}}
									data-filter-chip
									className={metricOptionChipStyles}
								>
									<Icon name="plus" className="size-3 text-tertiary group-hover:text-link" aria-hidden="true" />
									<span>{filter.label}</span>
								</button>
							))}
						</div>
					</section>
				))
			)}
		</>
	)
}

/** One added filter in the active pane: its name, its category, a remove button, and the caller's editor. */
export function ActiveFilterCard({
	label,
	category,
	description,
	onRemove,
	children
}: {
	label: string
	category: string
	/** What the filter measures, behind a help icon beside its name. */
	description?: string
	onRemove: () => void
	children: ReactNode
}) {
	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<span className="min-w-0 truncate label-sm text-primary">{label}</span>
				{description ? <QuestionHelper text={description} /> : null}
				<Tag>{category}</Tag>
				<Tooltip
					content={`Remove ${label} filter`}
					render={
						<Button
							type="button"
							variant="ghost"
							size="sm"
							square
							aria-label={`Remove ${label} filter`}
							onClick={(event) => {
								// The card leaves with its button. Focus moves to the next card's remove button, else the previous
								// card's, else the first control that adds a filter back, found after the filter returns to that list.
								const pane = event.currentTarget.closest('[data-filter-pane]')!
								const removes = [...pane.querySelectorAll<HTMLElement>('[data-filter-remove]')]
								const index = removes.indexOf(event.currentTarget)
								const next = removes[index + 1] ?? removes[index - 1]
								keepFocus(
									onRemove,
									() =>
										next ??
										pane.parentElement!.querySelector<HTMLElement>(
											'[data-filter-pane="browse"] input, [data-filter-pane="browse"] [data-filter-chip]'
										)
								)
							}}
							data-filter-remove
							className="ml-auto"
						/>
					}
				>
					<Icon name="x" className="size-4" aria-hidden="true" />
				</Tooltip>
			</div>
			{children}
		</Card>
	)
}

export interface ActiveFilterPill {
	id: string
	label: string
	onRemove: () => void
}

// A pill leaves once its filter clears, after the URL updates. With no pill left, the Filters button nearest the strip
// takes focus.
const focusNeighbourPillOnLeave = focusNeighbourOnLeave((pill) => {
	for (let region = pill.parentElement; region; region = region.parentElement) {
		const trigger = region.querySelector<HTMLElement>('[data-filter-builder]')
		if (trigger) return trigger
	}
	return null
})

/** The applied filters beside a table, each a pill that clears its filter. */
export function ActiveFilterPills({ pills }: { pills: Array<ActiveFilterPill> }) {
	if (pills.length === 0) return null

	return (
		<div className="flex flex-wrap gap-1">
			{pills.map((pill) => (
				<Button
					key={pill.id}
					ref={focusNeighbourPillOnLeave}
					data-row
					type="button"
					variant="filter"
					size="sm"
					data-active="true"
					className="group"
					onClick={pill.onRemove}
				>
					<span className="sr-only">Remove </span>
					<span>{pill.label}</span>
					<Icon name="x" className="size-3 text-secondary group-hover:text-primary" aria-hidden="true" />
				</Button>
			))}
		</div>
	)
}

/** A number field in a filter editor, with an optional unit before or after the value ($, %). Values such as
    10b or 500m are parsed by the caller, so the field takes text. */
export function FilterNumberInput({
	label,
	value,
	onChange,
	placeholder,
	prefix,
	suffix
}: {
	/** The accessible name, such as "Market cap minimum"; the placeholder is only an example. */
	label: string
	value: string
	onChange: (value: string) => void
	placeholder: string
	prefix?: string
	suffix?: string
}) {
	return (
		<label className="relative min-w-0 flex-1">
			<span className="sr-only">{label}</span>
			{prefix ? (
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 left-3 flex items-center body-sm text-tertiary"
				>
					{prefix}
				</span>
			) : null}
			<Input
				type="text"
				inputMode="decimal"
				value={value}
				onChange={(event) => onChange(event.currentTarget.value)}
				placeholder={placeholder}
				className={`w-full ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-7' : ''}`}
			/>
			{suffix ? (
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 right-3 flex items-center body-sm text-tertiary"
				>
					{suffix}
				</span>
			) : null}
		</label>
	)
}
