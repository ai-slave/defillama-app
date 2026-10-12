import * as Ariakit from '@ariakit/react'
import { defaultRangeExtractor } from '@tanstack/react-virtual'
import { matchSorter } from 'match-sorter'
import { type ReactNode, type Ref, startTransition, useId, useMemo, useRef, useState } from 'react'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { ComboboxSelectTrigger, selectTriggerStyles } from './ComboboxSelectTrigger'
import { Check } from './internal/Check'
import { popoverMeasuredRowStyles, popoverScrollAreaStyles } from './internal/Popover'
import { isSearchable } from './internal/searchThreshold'
import { getSelectAllState, SELECT_ALL_VALUE, SelectAllContent } from './internal/SelectAll'
import { Logo } from './Logo'
import { PopoverHeader } from './PopoverHeader'
import { ComboboxSurface } from './PopoverSurface'
import { SearchField } from './SearchField'
import { BusyGlyph, InlineLoading } from './Status'

/* ----------------------------------------------------------------------------
   Pickers for long option lists (protocols, chains, tokens, Downloads
   parameters): VirtualizedSelect and VirtualizedMultiSelect. Never build a
   long list from a plain input over buttons, or cap it with `slice()`.

   Only the rows in view are rendered, and each is measured
   (`popoverMeasuredRowStyles`, without `content-visibility`, because an
   off-screen row would report its placeholder height), so a row may wrap
   or carry a second line. Ariakit keeps DOM focus in the search field and
   moves a virtual active row; the virtualizer keeps that row, its neighbors
   and the selected rows mounted, so arrow keys continue past the rendered
   window and the list opens on the selection.

   Triggers: `field` is an input-style trigger under a visible label-sm
   text-secondary label, with an optional `labelAction` at the end of the
   label row; `chip` is a toolbar trigger that reads "Label: value". An
   option's `logo` URL draws round on its row and, once picked, on the
   trigger. A server-searched picker passes `onSearchChange` and lists the
   options it is given unfiltered. A `field` takes `error` the way Field does
   (src/ui/Field.tsx): the message under the trigger in body-sm text-error,
   `aria-invalid` and `aria-describedby` on the trigger, and `data-invalid`
   on the field, so `showFieldErrors` focuses the trigger.

   An unset single pick is `null`: pass `value ?? null`, never `x || ''`,
   which renders a blank trigger. Use `''` only for an option whose value
   really is `''`.
---------------------------------------------------------------------------- */

export type VirtualizedSelectOption<T extends string = string> = {
	value: T
	label: string
	/** Image URL, drawn round on the row and, once picked, on the trigger. */
	logo?: string | null
	/** A second line under the label. */
	description?: string
	disabled?: boolean
	/** A child protocol, indented under its parent. */
	isChild?: boolean
	/** A heading the list shows above the first option of each run of the same group. */
	group?: string
}

type PickerBaseProps<T extends string = string> = {
	label: string
	options: ReadonlyArray<VirtualizedSelectOption<T>>
	/** Trigger text while nothing is picked. */
	placeholder: string
	/** The options are still loading: the trigger waits, disabled, with a spinner. */
	isLoading?: boolean
	/** The pick is not available yet (it depends on another field). The placeholder says why, in words a reader sees
	    without hovering: "Select a protocol first". */
	disabled?: boolean
	/** Server search: the caller passes the matching `options`, so the list shows them unfiltered. */
	onSearchChange?: (value: string) => void
	/** A server search is in flight; the list says so instead of "No results". */
	isSearching?: boolean
	/** A control at the end of a field's label row, such as an include/exclude toggle. */
	labelAction?: ReactNode
	/** Full-bleed rows under the search field, such as a switch between the kinds of option listed. */
	headerRow?: ReactNode
	/** For a caller that hands focus back to the trigger, e.g. when the list of picks it fed empties. */
	triggerRef?: Ref<HTMLButtonElement>
	autoFocus?: boolean
	/** A `field`'s validation error, shown under the trigger (src/ui/Field.tsx). */
	error?: string | null
	/** Layout placement only. */
	className?: string
}

function FieldLabel({ id, htmlFor, label, action }: { id: string; htmlFor: string; label: string; action: ReactNode }) {
	const text = (
		<label id={id} htmlFor={htmlFor} className="label-sm text-secondary">
			{label}
		</label>
	)
	if (!action) return text
	return (
		<div className="flex items-center justify-between gap-2">
			{text}
			{action}
		</div>
	)
}

// Ariakit scrolls the list to the selection on open, before the rows above it render and measure, so it lands only
// as close as these estimates are. Measured heights: one line 33px (44px in a phone sheet), two lines 49px, plus 32px
// for a group heading.
function estimateRowHeight(option: VirtualizedSelectOption | null, startsGroup: boolean) {
	const twoLines = !!option && (option.description !== undefined || !!option.isChild)
	const phone = window.matchMedia('(max-width: 639px)').matches
	return (twoLines ? 49 : phone ? 44 : 33) + (startsGroup ? 32 : 0)
}

/** The typed search. Server-searched pickers also hear it through `onSearchChange`. */
function useSearch(onSearchChange: ((value: string) => void) | undefined) {
	const [search, setSearch] = useState('')
	const updateSearch = (value: string) =>
		startTransition(() => {
			setSearch(value)
			onSearchChange?.(value)
		})
	return { search, updateSearch }
}

function findOption<T extends string>(options: ReadonlyArray<VirtualizedSelectOption<T>>, value: string) {
	for (const option of options) {
		if (option.value === value) return option
	}
	return null
}

function filterOptions<T extends string>(
	options: ReadonlyArray<VirtualizedSelectOption<T>>,
	search: string,
	serverSearch: boolean
) {
	if (serverSearch || !search) return options
	return matchSorter(options, search, { keys: ['label', 'value', 'group'], threshold: matchSorter.rankings.CONTAINS })
}

function LogoSlot({ option, size, reserve }: { option: VirtualizedSelectOption; size: number; reserve: boolean }) {
	if (option.logo) return <Logo src={option.logo} size={size} />
	// Rows without a logo keep the logo's slot, so labels in a list with logos line up.
	return reserve ? <span aria-hidden className="shrink-0" style={{ width: size, height: size }} /> : null
}

function OptionList({
	options,
	matches,
	multiple,
	selectedValues,
	selectAll,
	isSearching,
	search
}: {
	options: ReadonlyArray<VirtualizedSelectOption>
	matches: ReadonlyArray<VirtualizedSelectOption>
	multiple: boolean
	selectedValues: ReadonlyArray<string>
	/** Leads a multi-select list with the tri-state Select all row (./internal/SelectAll.tsx). */
	selectAll: { label: string; state: ReturnType<typeof getSelectAllState>; onToggle: () => void } | null
	isSearching: boolean
	search: string
}) {
	const listRef = useRef<HTMLDivElement>(null)
	const rowIdPrefix = useId()
	const store = Ariakit.useComboboxContext()
	const activeId = Ariakit.useStoreState(store, 'activeId')
	const offset = selectAll ? 1 : 0
	const count = matches.length + offset
	const reserveLogo = useMemo(() => options.some((option) => option.logo), [options])

	// Ariakit moves only between mounted rows, so the selected rows stay rendered and the list opens on the
	// selection, and so do the active row and its neighbors: the rendered window follows scroll events, which
	// land a frame after each key press, so the next row has to exist before the key does.
	const persistentIndexes = useMemo(() => {
		const selected = new Set(selectedValues)
		const indexes: Array<number> = []
		for (let index = 0; index < matches.length; index++) {
			if (selected.has(matches[index]!.value)) indexes.push(index + offset)
		}
		return indexes
	}, [matches, selectedValues, offset])
	// Each search remounts the list, so a row id from an earlier list never matches this one's prefix.
	const activeIndex = activeId?.startsWith(`${rowIdPrefix}-`) ? Number(activeId.slice(rowIdPrefix.length + 1)) : -1

	const virtualizer = useVirtualItems({
		count,
		getScrollElement: () => listRef.current,
		estimateSize: (index) => {
			const option = selectAll && index === 0 ? null : matches[index - offset]!
			const previous = option && index - offset > 0 ? matches[index - offset - 1]! : null
			return estimateRowHeight(option, !!option?.group && option.group !== previous?.group)
		},
		getItemKey: (index) => (selectAll && index === 0 ? SELECT_ALL_VALUE : matches[index - offset]!.value),
		overscan: 8,
		rangeExtractor: (range) => {
			const indexes = new Set(defaultRangeExtractor(range))
			for (const index of persistentIndexes) indexes.add(index)
			for (let index = activeIndex - 1; index <= activeIndex + 1; index++) {
				if (activeIndex >= 0 && index >= 0 && index < count) indexes.add(index)
			}
			return [...indexes].sort((a, b) => a - b)
		}
	})

	if (matches.length === 0) {
		return (
			<p role="status" className="flex justify-center px-3 py-6 text-center body-sm text-tertiary">
				{isSearching ? (
					<InlineLoading insideLiveRegion label="Searching" />
				) : search ? (
					`No results for "${search}"`
				) : (
					'No options'
				)}
			</p>
		)
	}

	return (
		<Ariakit.ComboboxList ref={listRef} className={popoverScrollAreaStyles}>
			<div className="relative w-full" style={{ height: virtualizer.totalSize }}>
				{virtualizer.items.map((row) => {
					const itemProps = {
						id: `${rowIdPrefix}-${row.index}`,
						className: `${popoverMeasuredRowStyles} aria-disabled:cursor-not-allowed aria-disabled:text-disabled ${
							row.index < count - 1 ? 'border-b border-subtle' : ''
						}`
					}
					const option = selectAll && row.index === 0 ? null : matches[row.index - offset]!
					const previous = option && row.index - offset > 0 ? matches[row.index - offset - 1]! : null
					// A group's first row carries its heading, so the heading scrolls and measures with it.
					const groupHeading = option?.group && option.group !== previous?.group ? option.group : null
					return (
						<div
							key={row.key}
							ref={virtualizer.measureElement}
							data-index={row.index}
							className="absolute inset-x-0 top-0"
							style={{ transform: `translateY(${row.start}px)` }}
						>
							{groupHeading ? <p className="px-3 pt-3 pb-1 label-sm text-tertiary">{groupHeading}</p> : null}
							{option === null ? (
								<Ariakit.ComboboxItem
									{...itemProps}
									value={SELECT_ALL_VALUE}
									selectValueOnClick={false}
									resetValueOnSelect={false}
									hideOnClick={false}
									onClick={selectAll!.onToggle}
								>
									<SelectAllContent label={selectAll!.label} state={selectAll!.state} />
								</Ariakit.ComboboxItem>
							) : (
								<Ariakit.ComboboxItem
									{...itemProps}
									value={option.value}
									disabled={option.disabled}
									// A multi-select keeps the typed filter while several matches are toggled.
									resetValueOnSelect={!multiple}
									hideOnClick={!multiple}
								>
									<OptionContent option={option} reserveLogo={reserveLogo} />
									<Ariakit.ComboboxItemSelected>
										{(selected) => <Check kind={multiple ? 'box' : 'tick'} checked={selected} className="ml-auto" />}
									</Ariakit.ComboboxItemSelected>
								</Ariakit.ComboboxItem>
							)}
						</div>
					)
				})}
			</div>
		</Ariakit.ComboboxList>
	)
}

function OptionContent({ option, reserveLogo }: { option: VirtualizedSelectOption; reserveLogo: boolean }) {
	const description = option.description ?? (option.isChild ? 'Child protocol' : null)
	return (
		<span className={`flex min-w-0 items-center gap-2 ${option.isChild ? 'pl-4' : ''}`}>
			<LogoSlot option={option} size={20} reserve={reserveLogo} />
			<span className="flex min-w-0 flex-col">
				<span className="break-words">{option.label}</span>
				{description ? <span className="break-words text-tertiary">{description}</span> : null}
			</span>
		</span>
	)
}

function TriggerArrow({ isLoading }: { isLoading: boolean }) {
	return isLoading ? (
		<span className="ml-auto text-tertiary">
			<BusyGlyph decorative size={14} />
		</span>
	) : (
		<Ariakit.ComboboxSelectArrow className="ml-auto text-tertiary" />
	)
}

type PickerVariant = 'field' | 'chip'

/** The trigger, and for a field its label row. `chip` reads "Label: value" in a toolbar; `field` sets its
    label above it, and the trigger is named by both. */
function PickerTrigger({
	variant,
	label,
	labelAction,
	text,
	picked,
	logo,
	isLoading,
	disabled = false,
	triggerRef,
	autoFocus,
	error,
	className
}: Pick<PickerBaseProps, 'label' | 'labelAction' | 'triggerRef' | 'autoFocus' | 'error' | 'className' | 'disabled'> & {
	variant: PickerVariant
	text: string
	/** Whether `text` names a pick, or is the placeholder. */
	picked: boolean
	logo: VirtualizedSelectOption | null
	isLoading: boolean
}) {
	const labelId = useId()
	const triggerId = useId()
	const errorId = `${useId()}-error`
	const content = (
		<>
			{/* The space keeps the accessible name "Label: value"; flex items join their text without one. */}
			{variant === 'chip' ? <span className="shrink-0">{label}: </span> : null}
			{logo ? <LogoSlot option={logo} size={16} reserve={false} /> : null}
			<span className={`truncate ${!picked ? 'text-tertiary' : variant === 'chip' ? 'text-link' : ''}`}>
				{isLoading ? 'Loading…' : text}
			</span>
			<TriggerArrow isLoading={isLoading} />
		</>
	)
	if (variant === 'chip') {
		return (
			<ComboboxSelectTrigger
				ref={triggerRef}
				autoFocus={autoFocus}
				disabled={isLoading || disabled}
				aria-busy={isLoading || undefined}
				className={`${selectTriggerStyles('filter', 'md')} max-w-72 shrink-0 ${className ?? ''}`}
			>
				{content}
			</ComboboxSelectTrigger>
		)
	}
	return (
		<div data-invalid={error ? '' : undefined} className={`flex min-w-0 flex-col gap-1 text-start ${className ?? ''}`}>
			<FieldLabel id={labelId} htmlFor={triggerId} label={label} action={labelAction} />
			<ComboboxSelectTrigger
				ref={triggerRef}
				id={triggerId}
				autoFocus={autoFocus}
				aria-labelledby={`${labelId} ${triggerId}`}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				disabled={isLoading || disabled}
				aria-busy={isLoading || undefined}
				className={`${selectTriggerStyles('input', 'md')} w-full`}
			>
				{content}
			</ComboboxSelectTrigger>
			{error ? (
				<p id={errorId} className="body-sm text-error">
					{error}
				</p>
			) : null}
		</div>
	)
}

/** The popover: a tall list drawer with a search field for long or server-searched lists, a content-sized panel
    for short ones. `header` holds rows under the search field, or above a short list. */
function PickerSurface({
	label,
	variant,
	searchable,
	header,
	children
}: {
	label: string
	variant: PickerVariant
	searchable: boolean
	header: ReactNode
	children: ReactNode
}) {
	return (
		<ComboboxSurface
			variant={searchable ? 'list' : 'panel'}
			heading={label}
			width={variant === 'chip' ? 'md' : 'trigger'}
		>
			<PopoverHeader
				search={searchable ? <SearchField combobox label={`Search ${label}`} placeholder="Search…" /> : null}
			>
				{header}
			</PopoverHeader>
			{children}
		</ComboboxSurface>
	)
}

/** One pick from a list. */
export function VirtualizedSelect<T extends string = string>({
	label,
	variant,
	options,
	selectedValue,
	onChange,
	placeholder,
	isLoading = false,
	onSearchChange,
	isSearching = false,
	headerRow,
	...triggerProps
}: PickerBaseProps<T> & {
	variant: PickerVariant
	selectedValue: T | null
	onChange: (option: VirtualizedSelectOption<T>) => void
}) {
	const { search, updateSearch } = useSearch(onSearchChange)
	const matches = useMemo(() => filterOptions(options, search, !!onSearchChange), [options, search, onSearchChange])
	const selectedOption = selectedValue === null ? null : findOption(options, selectedValue)
	const selectedText = selectedOption?.label ?? selectedValue
	const selectedValues = useMemo(() => (selectedValue === null ? [] : [selectedValue]), [selectedValue])

	return (
		<Ariakit.ComboboxProvider
			resetValueOnHide
			placement="bottom-start"
			selectedValue={selectedValue ?? ''}
			setSelectedValue={(value) => {
				const option = findOption(options, value)
				if (option) onChange(option)
			}}
			setInputValue={updateSearch}
		>
			<PickerTrigger
				{...triggerProps}
				variant={variant}
				label={label}
				text={selectedText ?? placeholder}
				picked={selectedText !== null}
				logo={selectedOption}
				isLoading={isLoading}
			/>
			<PickerSurface
				label={label}
				variant={variant}
				searchable={isSearchable(options.length, !!onSearchChange)}
				header={headerRow}
			>
				<OptionList
					// A new search is a new list: it starts at the top, not where the last one was scrolled.
					key={search}
					options={options}
					matches={matches}
					multiple={false}
					selectedValues={selectedValues}
					selectAll={null}
					isSearching={isSearching}
					search={search}
				/>
			</PickerSurface>
		</Ariakit.ComboboxProvider>
	)
}

/** One pick is named. Several are counted against the list, unless a server search decides what the list holds. */
function describePicks(
	options: ReadonlyArray<VirtualizedSelectOption>,
	values: ReadonlyArray<string>,
	serverSearch: boolean
) {
	if (values.length === 1) return findOption(options, values[0]!)?.label ?? values[0]!
	if (serverSearch) return `${values.length} selected`
	return values.length === options.length ? 'All' : `${values.length} of ${options.length}`
}

/** Several picks from a list. The list leads with the tri-state "Select all" whenever every option in
    view still fits under `maxSelections`; a capped list says how many picks it holds and, at the cap,
    disables the rest. */
export function VirtualizedMultiSelect({
	label,
	variant = 'field',
	options,
	selectedValues,
	onChange,
	placeholder,
	isLoading = false,
	onSearchChange,
	isSearching = false,
	maxSelections,
	headerRow,
	...triggerProps
}: PickerBaseProps & {
	variant?: PickerVariant
	selectedValues: Array<string>
	onChange: (values: Array<string>) => void
	maxSelections?: number
}) {
	const { search, updateSearch } = useSearch(onSearchChange)
	const matches = useMemo(() => filterOptions(options, search, !!onSearchChange), [options, search, onSearchChange])
	const atCap = maxSelections !== undefined && selectedValues.length >= maxSelections
	const listOptions = useMemo(() => {
		if (!atCap) return matches
		const selected = new Set(selectedValues)
		return matches.map((option) =>
			option.disabled || selected.has(option.value) ? option : { ...option, disabled: true }
		)
	}, [matches, atCap, selectedValues])

	const selectsShown = search.trim() !== ''
	const scopeKeys = useMemo(() => {
		const keys: Array<string> = []
		for (const option of selectsShown ? matches : options) {
			if (!option.disabled) keys.push(option.value)
		}
		return keys
	}, [selectsShown, matches, options])
	const selectAllState = getSelectAllState(scopeKeys, selectedValues)
	const selected = new Set(selectedValues)
	const unpicked = scopeKeys.filter((value) => !selected.has(value))
	const selectAllFits = maxSelections === undefined || selectedValues.length + unpicked.length <= maxSelections
	const toggleSelectAll = () => {
		if (selectAllState !== 'all') return onChange(selectedValues.concat(unpicked))
		const scope = new Set(scopeKeys)
		onChange(selectedValues.filter((value) => !scope.has(value)))
	}
	const firstPick = selectedValues.length === 1 ? findOption(options, selectedValues[0]!) : null

	return (
		<Ariakit.ComboboxProvider
			resetValueOnHide
			placement="bottom-start"
			selectedValue={selectedValues}
			setSelectedValue={onChange}
			setInputValue={updateSearch}
		>
			<PickerTrigger
				{...triggerProps}
				variant={variant}
				label={label}
				text={selectedValues.length > 0 ? describePicks(options, selectedValues, !!onSearchChange) : placeholder}
				picked={selectedValues.length > 0}
				logo={firstPick}
				isLoading={isLoading}
			/>
			<PickerSurface
				label={label}
				variant={variant}
				searchable={isSearchable(options.length, !!onSearchChange)}
				header={
					maxSelections !== undefined || headerRow ? (
						<>
							{maxSelections !== undefined ? (
								<p role="status" className="px-3 pb-2 body-sm text-tertiary">
									{selectedValues.length} of {maxSelections} picked
									{atCap ? '. Remove one to pick another.' : ''}
								</p>
							) : null}
							{headerRow}
						</>
					) : null
				}
			>
				<OptionList
					// A new search is a new list: it starts at the top, not where the last one was scrolled.
					key={search}
					options={options}
					matches={listOptions}
					multiple
					selectedValues={selectedValues}
					selectAll={
						scopeKeys.length > 0 && selectAllFits
							? {
									label: selectsShown ? 'Select all shown' : 'Select all',
									state: selectAllState,
									onToggle: toggleSelectAll
								}
							: null
					}
					isSearching={isSearching}
					search={search}
				/>
			</PickerSurface>
		</Ariakit.ComboboxProvider>
	)
}
