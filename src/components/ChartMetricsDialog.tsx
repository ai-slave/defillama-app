import * as Ariakit from '@ariakit/react'
import { cloneElement, useDeferredValue, useState, type ReactNode } from 'react'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { metricOptionChipStyles } from '~/ui/MetricChip'
import { NoResults } from '~/ui/NoResults'
import { SearchField } from '~/ui/SearchField'
import { Tooltip } from '~/ui/Tooltip'

export interface ChartMetricOption {
	key: string
	label: string
	/** The series color for the active theme; tints the dot on a picked chip. */
	color: string
	active: boolean
	/** Withheld from this reader: listed with a PRO badge, and a click opens the upgrade path instead of toggling. */
	locked?: boolean
	/** A mark before the label, such as the Yields verified seal. */
	leading?: ReactNode
	/** What the metric measures, shown as a tooltip on the chip on hover and keyboard focus. */
	description?: string
}

export interface ChartMetricGroup<O extends ChartMetricOption> {
	label: string
	options: ReadonlyArray<O>
}

/** The footer's undo control. A chart that can draw nothing clears every pick; one whose empty selection falls back
    to its default metrics resets to them instead, so the button never claims to clear what comes back. */
export type ChartMetricsClear =
	| { kind: 'clear'; onClear: () => void }
	| { kind: 'reset'; atDefault: boolean; onReset: () => void }

// Long catalogues get a search; a short one fits on screen, so a field would only cover it with a keyboard.
const SEARCH_MIN_OPTIONS = 12

/** The chart toolbar's "Add Metrics" button and its dialog, on every page: the catalogue as grouped chips that toggle
    series on the chart, "N of M selected", a search from 12 options (with the full phone sheet), and Clear all or
    Reset. Choices apply as they are made, so Done only closes. Locked Pro options open the upgrade path. Pages pass
    their catalogue as groups and keep their own removable chips in the toolbar. The option chips are
    `metricOptionChipStyles`: 24px, full radius, neutral border, brand when picked. */
export function ChartMetricsDialog<O extends ChartMetricOption>({
	groups,
	onToggle,
	clear,
	onUnlock
}: {
	groups: ReadonlyArray<ChartMetricGroup<O>>
	onToggle: (option: O) => void
	/** Omitted where the chart has neither, such as Yields pools, whose defaults come from the pool. */
	clear?: ChartMetricsClear
	/** Opens the upgrade path for a locked option. */
	onUnlock?: () => void
}) {
	const store = Ariakit.useDialogStore()
	return (
		<Ariakit.DialogProvider store={store}>
			<Ariakit.DialogDisclosure render={<Button size="md" />}>
				<span>Add Metrics</span>
				<Icon name="plus" className="size-3.5" />
			</Ariakit.DialogDisclosure>
			<MetricsDialog groups={groups} onToggle={onToggle} clear={clear} onUnlock={onUnlock} />
		</Ariakit.DialogProvider>
	)
}

function MetricsDialog<O extends ChartMetricOption>({
	groups,
	onToggle,
	clear,
	onUnlock
}: {
	groups: ReadonlyArray<ChartMetricGroup<O>>
	onToggle: (option: O) => void
	clear?: ChartMetricsClear
	onUnlock?: () => void
}) {
	const store = Ariakit.useDialogContext()!
	const isSmallScreen = useMedia('(max-width: 639px)')
	const [search, setSearch] = useState('')
	const query = useDeferredValue(search).trim().toLowerCase()

	let total = 0
	let picked = 0
	const shownGroups: Array<{ label: string; options: Array<O>; picked: number }> = []
	for (const group of groups) {
		const options: Array<O> = []
		let groupPicked = 0
		for (const option of group.options) {
			// A locked option is never selectable, so it stays out of the counts.
			if (!option.locked) {
				total++
				if (option.active) picked++
			}
			if (query && !option.label.toLowerCase().includes(query)) continue
			options.push(option)
			if (option.active && !option.locked) groupPicked++
		}
		if (options.length > 0) shownGroups.push({ label: group.label, options, picked: groupPicked })
	}
	const searchable = total >= SEARCH_MIN_OPTIONS

	return (
		// Search results change the body's height, so a searchable picker keeps the full phone sheet.
		<Dialog size="md" fullSheet={searchable} unmountOnHide portal>
			<DialogHeader title="Chart metrics" subtitle={`${picked} of ${total} selected`} />
			{searchable ? (
				<DialogToolbar>
					{/* Phones skip the autofocus: the keyboard would cover the list before anyone asked to search. */}
					<SearchField
						label="Search metrics"
						placeholder={`Search ${total} metrics…`}
						value={search}
						onChange={setSearch}
						autoFocus={!isSmallScreen}
					/>
				</DialogToolbar>
			) : null}
			<DialogBody>
				{shownGroups.map((group) => (
					<section key={group.label} aria-label={group.label} className="flex flex-col gap-2">
						<p className="flex items-baseline gap-1.5" aria-hidden="true">
							<span className="label-xs tracking-wide text-tertiary uppercase">{group.label}</span>
							<span className="body-xs text-tertiary">
								{group.picked}/{group.options.length}
							</span>
						</p>
						<div className="flex flex-wrap gap-1 sheet:gap-2">
							{group.options.map((option) =>
								option.locked ? (
									<button
										key={option.key}
										type="button"
										onClick={() => {
											store.hide()
											onUnlock?.()
										}}
										className={metricOptionChipStyles}
										aria-label={`${option.label}, available on Pro`}
									>
										<Icon name="lock" className="size-3 text-tertiary" aria-hidden="true" />
										<span className="text-tertiary">{option.label}</span>
										<span className="rounded-md bg-brand-muted px-1 py-px label-xs tracking-widest text-link">PRO</span>
									</button>
								) : (
									<MetricChip key={option.key} option={option} onToggle={onToggle} />
								)
							)}
						</div>
					</section>
				))}
				{shownGroups.length === 0 ? <NoResults>No metrics match “{search.trim()}”</NoResults> : null}
			</DialogBody>
			<DialogFooter
				leading={
					clear ? (
						// Disabled, not removed, when there is nothing to undo: the button keeps focus after it acts.
						<Button
							type="button"
							variant="ghost"
							size="md"
							disabled={clear.kind === 'clear' ? picked === 0 : clear.atDefault}
							accessibleWhenDisabled
							onClick={clear.kind === 'clear' ? clear.onClear : clear.onReset}
						>
							{clear.kind === 'clear' ? 'Clear all' : 'Reset'}
						</Button>
					) : null
				}
			>
				<Button type="button" variant="primary" size="md" onClick={() => store.hide()}>
					Done
				</Button>
			</DialogFooter>
		</Dialog>
	)
}

function MetricChip<O extends ChartMetricOption>({ option, onToggle }: { option: O; onToggle: (option: O) => void }) {
	const button = (
		<button
			type="button"
			onClick={() => onToggle(option)}
			aria-pressed={option.active}
			data-active={option.active}
			className={metricOptionChipStyles}
		/>
	)
	const content = (
		<>
			{option.active ? (
				<span
					aria-hidden="true"
					className="size-1.5 rounded-full"
					style={{ backgroundColor: `color-mix(in oklch, ${option.color} 75%, var(--text-secondary))` }}
				/>
			) : (
				<Icon name="plus" className="size-3 text-tertiary group-hover:text-link" aria-hidden="true" />
			)}
			{option.leading}
			<span>{option.label}</span>
			{option.active ? (
				<Icon name="x" className="size-3 text-secondary group-hover:text-primary" aria-hidden="true" />
			) : null}
		</>
	)
	if (!option.description) return cloneElement(button, undefined, content)
	return (
		<Tooltip content={option.description} render={button} placement="top">
			{content}
		</Tooltip>
	)
}
