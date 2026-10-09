import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import * as React from 'react'
import { NestedMenu } from '~/components/NestedMenu'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import {
	nestedMenuSeeMoreStyles,
	nestedMenuSelectRowStyles,
	popoverMultiSelectCheckStyles,
	popoverRowStyles,
	popoverRowWithBorderStyles,
	popoverScrollAreaStyles,
	popoverSeeMoreStyles,
	popoverSingleSelectCheckStyles
} from '~/ui/Popover'
import { PopoverHeader } from '~/ui/PopoverHeader'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { tw } from '~/ui/tw'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'
import { ComboboxSelectTrigger } from './ComboboxSelectTrigger'
import { readSelectionFromQuery, updateQueryFromSelected } from './query'
import { isSearchable } from './searchThreshold'
import { getSelectAllState, SELECT_ALL_VALUE, SelectAllContent } from './SelectAll'
import { SelectCheckIcon } from './SelectCheckIcon'
import type { ExcludeQueryKey, SelectOption, SelectTriggerSize, SelectTriggerVariant, SelectValues } from './types'
import { selectTriggerStyles } from './types'

/* SelectWithCombobox — a single or multi picker for a mid-sized list; the folder README says which picker fits.

   A multi-select row holds two `role="option"` items: the option and its "Only" button. Code that counts or indexes
   options skips `[aria-label^="Only "]`. */

interface ISelectWithComboboxBase {
	allValues: SelectValues
	/** What the trigger lists instead of `selectedValues`, e.g. one group name for its selected members. */
	selectedLabels?: Array<string>
	singleSelect?: boolean
	nestedMenu?: boolean
	variant: SelectTriggerVariant
	size: SelectTriggerSize
	/** Placement and layout classes appended to the trigger; `variant` and `size` own its look. */
	className?: string
	triggerProps?: Omit<Ariakit.ComboboxSelectProps, 'className'>
	/** The trigger's accessible name comes from `triggerProps`; a top-level `aria-label` was silently dropped. */
	'aria-label'?: never
	customFooter?: React.ReactNode
	/** Full-bleed rows under the search field, e.g. a toggle that qualifies the selection. */
	headerRow?: React.ReactNode
	/** Rows under "Select all" that select a preset, e.g. only EVM chains. */
	quickActions?: ReadonlyArray<{ label: string; onSelect: () => void }>
	onValuesChange?: (values: Array<string>, label: string) => void
	resetPageOnQueryChange?: boolean
	pushQueryUpdates?: (updates: Record<string, string | Array<string> | undefined>) => void
	popoverClassName?: string
	searchPlaceholder?: string
	visibleOptionLimit?: number | null
	selectAllScope?: 'all' | 'matches'
	emptyLabel?: React.ReactNode
}

interface ISelectWithComboboxUrlParams extends ISelectWithComboboxBase {
	includeQueryKey: string
	excludeQueryKey: ExcludeQueryKey
	/** Rendered as selected while the URL holds no selection; defaults to every option. */
	defaultSelectedValues?: Array<string>
	/** The picker reads its selection from the URL with `readSelectionFromQuery`, the same reader pages use. */
	selectedValues?: never
	setSelectedValues?: never
}

interface ISelectWithComboboxState extends ISelectWithComboboxBase {
	includeQueryKey?: never
	excludeQueryKey?: never
	defaultSelectedValues?: never
	selectedValues: Array<string>
	setSelectedValues: (values: Array<string>) => void
}

/** With `labelType="none"` the trigger shows the current value, so `heading` names the phone drawer; otherwise the label does. */
type SelectWithComboboxLabelProps =
	| { label: string; labelType?: 'regular' | 'smol' | 'none'; heading: string }
	| { label: string; labelType?: 'regular' | 'smol'; heading?: undefined }

type ISelectWithCombobox = SelectWithComboboxLabelProps & (ISelectWithComboboxUrlParams | ISelectWithComboboxState)

export const gridRowStyles = tw`group relative flex border-b border-subtle last-of-type:border-b-0`
// "Only" is a small button lying over the space its option keeps free before the check (the row's px-3, the 14px check
// and the gap-2 put it 34px from the edge), so the check stays at the edge. It shows while either item is active, so a
// keyboard reader sees it on reaching the row and a phone shows it on the row last tapped, and on desktop also on hover.
// Phones get a larger tap area. `h-fit` lets my-auto center it between inset-y-0 while min-h sets its height.
export const onlyItemStyles = tw`invisible absolute inset-y-0 right-[34px] my-auto flex h-fit min-h-6 cursor-pointer items-center rounded-md border border-subtle bg-surface px-2 label-sm text-secondary group-has-data-active-item:visible hover:border-medium hover:bg-hover-row hover:text-primary data-active-item:border-medium data-active-item:bg-hover-row data-active-item:text-primary data-focus-visible:focus-ring max-sm:min-h-8 max-sm:px-3 sm:group-hover:visible`

const getOptionKey = (option: string | SelectOption) => (typeof option === 'string' ? option : option.key)

const EMPTY_QUICK_ACTIONS: ReadonlyArray<{ label: string; onSelect: () => void }> = []

export function getSelectOptionLabel(allValues: SelectValues, selectedValue: string): string {
	for (const option of allValues) {
		if (typeof option === 'string') {
			if (option === selectedValue) return option
		} else if (option.key === selectedValue) {
			return option.name
		}
	}
	return selectedValue
}

/**
 * Trigger text for a selection: "None" when nothing is selected, and "All except …" when fewer options are
 * left out than kept, which is when the picker writes an exclude list.
 */
export function describeSelection(allValues: SelectValues, selectedValues: Array<string>): string {
	if (selectedValues.length === 0) return 'None'
	const selected = new Set(selectedValues)
	const leftOut: Array<string> = []
	for (const option of allValues) {
		const key = typeof option === 'string' ? option : option.key
		if (!selected.has(key)) leftOut.push(typeof option === 'string' ? option : option.name)
	}
	const names =
		leftOut.length > 0 && leftOut.length < selectedValues.length
			? leftOut
			: selectedValues.map((value) => getSelectOptionLabel(allValues, value))
	const list = names.length > 2 ? `${names[0]} + ${names.length - 1} others` : names.join(', ')
	return names === leftOut ? `All except ${list}` : list
}

export function SelectWithCombobox({
	allValues,
	selectedValues: selectedValuesProp,
	selectedLabels: selectedLabelsProp,
	setSelectedValues: setSelectedValuesProp,
	label,
	singleSelect = false,
	nestedMenu,
	labelType,
	heading,
	variant,
	size,
	className,
	triggerProps,
	customFooter,
	headerRow,
	quickActions = EMPTY_QUICK_ACTIONS,
	includeQueryKey,
	excludeQueryKey,
	resetPageOnQueryChange,
	pushQueryUpdates,
	onValuesChange,
	defaultSelectedValues,
	popoverClassName,
	searchPlaceholder = 'Search…',
	visibleOptionLimit = 20,
	selectAllScope = 'all',
	emptyLabel = 'No results found'
}: ISelectWithCombobox) {
	const router = useRouter()
	const urlSelection = React.useMemo(
		() =>
			includeQueryKey && excludeQueryKey
				? readSelectionFromQuery(
						router.query,
						includeQueryKey,
						excludeQueryKey,
						allValues.map((v) => (typeof v === 'string' ? v : v.key)),
						defaultSelectedValues
					)
				: [],
		[router.query, includeQueryKey, excludeQueryKey, allValues, defaultSelectedValues]
	)
	const selectedValues = selectedValuesProp ?? urlSelection
	const selectedLabels = selectedLabelsProp ?? selectedValues
	// A picker reading the URL says when nothing or "all except" is selected, so an active filter never
	// looks like the default.
	const urlSelectionText = includeQueryKey && !selectedLabelsProp ? describeSelection(allValues, selectedValues) : null
	const valuesAreAnArrayOfStrings = typeof allValues[0] === 'string'
	const showCheckboxes = !singleSelect
	const queryUpdateOptions = {
		...(resetPageOnQueryChange !== undefined ? { resetPage: resetPageOnQueryChange } : {}),
		...(pushQueryUpdates !== undefined ? { pushQueryUpdates } : {})
	}
	const allKeys = allValues.map(getOptionKey)

	// One writer for every selection change: the URL when the picker reads it, else the caller's state.
	const writeSelection = (values: Array<string> | 'None' | null) => {
		if (includeQueryKey) {
			updateQueryFromSelected(
				router,
				includeQueryKey,
				excludeQueryKey,
				allKeys,
				values,
				defaultSelectedValues,
				queryUpdateOptions
			)
			return
		}
		setSelectedValuesProp!(values === 'None' ? [] : (values ?? allKeys))
	}
	const setSelectedValues = (values: Array<string>) => writeSelection(values)
	const clearAll = () => writeSelection('None')
	const selectOnlyOne = (value: string) => writeSelection([value])
	const firstSelectedValue = selectedValues[0]
	const providerValue = singleSelect ? (firstSelectedValue ?? '') : selectedValues

	const [searchValue, setSearchValue] = React.useState('')

	const matches = React.useMemo(() => {
		if (!searchValue) return allValues

		if (valuesAreAnArrayOfStrings) {
			return matchSorter(
				allValues.filter((value): value is string => typeof value === 'string'),
				searchValue,
				{
					threshold: matchSorter.rankings.CONTAINS
				}
			)
		}

		return matchSorter(
			allValues.filter((value): value is SelectOption => typeof value !== 'string'),
			searchValue,
			{
				keys: ['name'],
				threshold: matchSorter.rankings.CONTAINS
			}
		)
	}, [valuesAreAnArrayOfStrings, allValues, searchValue])

	const [viewableMatches, setViewableMatches] = React.useState(visibleOptionLimit ?? 20)
	const matchKeys = matches.map(getOptionKey)

	const toggleAll = () => {
		if (selectAllScope === 'all') return writeSelection(includeQueryKey ? null : allKeys)
		const nextValues = Array.from(new Set(selectedValues.concat(matchKeys)))
		writeSelection(includeQueryKey && nextValues.length === allKeys.length ? null : nextValues)
	}
	const hasOptionLimit = visibleOptionLimit !== null
	const visibleMatches = hasOptionLimit ? matches.slice(0, viewableMatches) : matches
	// With a search typed and `selectAllScope="matches"`, the row acts on the shown options only.
	const selectsShown = selectAllScope === 'matches' && searchValue.trim() !== ''
	const selectAllScopeKeys = selectsShown ? matchKeys : allKeys
	const selectAllState = getSelectAllState(selectAllScopeKeys, selectedValues)
	const toggleSelectAll = () => {
		if (selectAllState !== 'all') return toggleAll()
		if (!selectsShown) return clearAll()
		const shown = new Set(selectAllScopeKeys)
		setSelectedValues(selectedValues.filter((value) => !shown.has(value)))
	}
	// "See more" focuses the first new option by index, past the rows that lead the list.
	const leadingRowCount = (showCheckboxes ? 1 : 0) + quickActions.length

	const comboboxRef = React.useRef<HTMLDivElement>(null)

	// The flat multi-select lays its options out as rows with an "Only" item; the nested menu has no "Only".
	const grid = showCheckboxes && !nestedMenu
	// Ariakit groups items without a row into one row, so beside the option rows every single item needs its own.
	const inRow = (item: React.ReactElement, key?: string) =>
		grid ? (
			<Ariakit.ComboboxRow key={key} className={gridRowStyles}>
				{item}
			</Ariakit.ComboboxRow>
		) : (
			item
		)
	const renderLeadingRows = (rowStyles: string, actionStyles: string) => (
		<>
			{showCheckboxes
				? inRow(
						<Ariakit.ComboboxItem
							value={SELECT_ALL_VALUE}
							selectValueOnClick={false}
							resetValueOnSelect={false}
							hideOnClick={false}
							onClick={toggleSelectAll}
							className={rowStyles}
						>
							<SelectAllContent label={selectsShown ? 'Select all shown' : 'Select all'} state={selectAllState} />
						</Ariakit.ComboboxItem>
					)
				: null}
			{quickActions.map((action) =>
				inRow(
					<Ariakit.ComboboxItem
						key={action.label}
						value={`__quick_action__${action.label}`}
						selectValueOnClick={false}
						resetValueOnSelect={false}
						hideOnClick={false}
						onClick={action.onSelect}
						className={actionStyles}
					>
						{action.label}
					</Ariakit.ComboboxItem>,
					action.label
				)
			)}
		</>
	)

	const renderCheck = () => {
		return (
			<Ariakit.ComboboxItemSelected>
				{(selected) => (
					<span
						className={
							showCheckboxes ? popoverMultiSelectCheckStyles(selected) : popoverSingleSelectCheckStyles(selected)
						}
						aria-hidden
					>
						{selected ? <SelectCheckIcon /> : null}
					</span>
				)}
			</Ariakit.ComboboxItemSelected>
		)
	}

	const handleSeeMore = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		const previousCount = viewableMatches
		setViewableMatches((prev) => prev + 20)
		// Each multi-select row also holds an "Only" item, which the count skips.
		focusFirstNewItem(comboboxRef, '[role="option"]:not([aria-label^="Only "])', leadingRowCount + previousCount)
	}

	const setInputValue = (value: string) => {
		React.startTransition(() => {
			setSearchValue(value)
		})
	}

	const setSelectedValue = (values: string | Array<string>) => {
		// Ariakit hands a single select its value as a string and a multi select an array.
		const nextValues = typeof values === 'string' ? (values ? [values] : []) : values
		setSelectedValues(nextValues)
		onValuesChange?.(nextValues, label)
	}

	const emptyState = (
		<p role="status" aria-live="polite" className="px-3 py-6 text-center body-sm text-tertiary">
			<Ariakit.ComboboxInputValue>
				{(value) => (value && typeof emptyLabel === 'string' ? `${emptyLabel} for "${value}"` : emptyLabel)}
			</Ariakit.ComboboxInputValue>
		</p>
	)

	if (nestedMenu) {
		return (
			<Ariakit.ComboboxProvider
				resetValueOnHide
				setInputValue={setInputValue}
				selectedValue={providerValue}
				setSelectedValue={setSelectedValue}
			>
				<NestedMenu label={label} render={<button type="button" />}>
					<PopoverHeader
						inset="nested"
						search={<Ariakit.Combobox placeholder={searchPlaceholder} render={<Input className="w-full" />} />}
					>
						{headerRow}
					</PopoverHeader>
					{matches.length > 0 ? (
						<Ariakit.ComboboxList ref={comboboxRef} className={popoverScrollAreaStyles}>
							{renderLeadingRows(nestedMenuSelectRowStyles, `${nestedMenuSeeMoreStyles} border-b border-subtle`)}
							{visibleMatches.map((option) => (
								<Ariakit.ComboboxItem
									key={getOptionKey(option)}
									value={getOptionKey(option)}
									resetValueOnSelect={false}
									hideOnClick={false}
									className={nestedMenuSelectRowStyles}
								>
									{typeof option === 'string' ? (
										<span>{option}</span>
									) : option.help ? (
										<Tooltip content={option.help}>
											<span className="mr-1">{option.name}</span>
											<Icon name="help-circle" height={15} width={15} />
										</Tooltip>
									) : (
										<span className="inline-flex items-center gap-1.5">
											{option.name}
											{option.icon}
										</span>
									)}
									{renderCheck()}
								</Ariakit.ComboboxItem>
							))}
							{hasOptionLimit && matches.length > viewableMatches ? (
								<Ariakit.ComboboxItem
									value="__see_more__"
									selectValueOnClick={false}
									hideOnClick={false}
									className={nestedMenuSeeMoreStyles}
									onClick={handleSeeMore}
								>
									See more…
								</Ariakit.ComboboxItem>
							) : null}
						</Ariakit.ComboboxList>
					) : (
						emptyState
					)}
				</NestedMenu>
			</Ariakit.ComboboxProvider>
		)
	}

	const searchable = isSearchable(allValues.length, false)
	return (
		<Ariakit.ComboboxProvider
			resetValueOnHide
			setInputValue={setInputValue}
			selectedValue={providerValue}
			setSelectedValue={setSelectedValue}
		>
			<ComboboxSelectTrigger
				className={`${selectTriggerStyles(variant, size)} ${className ?? ''}`}
				aria-label={`${label} dropdown`}
				{...triggerProps}
			>
				{labelType === 'smol' ? (
					<span className="flex items-center gap-1">
						<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 label-xs">
							{selectedLabels.length}
						</span>
						<span>{label}</span>
					</span>
				) : labelType === 'regular' && (urlSelectionText || selectedLabels.length > 0) ? (
					<>
						<span>{label}: </span>
						<span className="text-link">
							{urlSelectionText ??
								(singleSelect && firstSelectedValue !== undefined
									? getSelectOptionLabel(allValues, firstSelectedValue)
									: selectedLabels.length > 2
										? `${selectedLabels[0]} + ${selectedLabels.length - 1} others`
										: selectedLabels.join(', '))}
						</span>
					</>
				) : (
					<span>{label}</span>
				)}
				<Ariakit.ComboboxSelectArrow className="text-tertiary" />
			</ComboboxSelectTrigger>
			<ComboboxSurface
				variant={searchable ? 'list' : 'panel'}
				hideOnInteractOutside
				heading={heading ?? label}
				className={popoverClassName}
			>
				<PopoverHeader
					search={
						searchable ? (
							<Ariakit.ComboboxInput placeholder={searchPlaceholder} render={<Input className="w-full" />} />
						) : null
					}
				>
					{headerRow}
				</PopoverHeader>
				{matches.length > 0 ? (
					<Ariakit.ComboboxList ref={comboboxRef} className={popoverScrollAreaStyles}>
						{grid
							? renderLeadingRows(`${popoverRowStyles} flex-1 gap-2`, `${popoverSeeMoreStyles} flex-1`)
							: renderLeadingRows(
									`${popoverRowWithBorderStyles} gap-2`,
									`${popoverSeeMoreStyles} border-b border-subtle`
								)}
						{visibleMatches.map((option) => {
							const optionKey = getOptionKey(option)
							const optionContent = (
								<>
									{typeof option === 'string' ? (
										<span>{option}</span>
									) : option.help ? (
										<span className="inline-flex items-center">
											<span className="mr-1">{option.name}</span>
											<Icon name="help-circle" height={15} width={15} />
										</span>
									) : (
										<span className="inline-flex items-center gap-1.5">
											{option.name}
											{option.icon}
										</span>
									)}
									{/* The space "Only" lies over, so a long name never runs under it. */}
									{grid ? <span aria-hidden className="ml-auto w-11 shrink-0 max-sm:w-14" /> : null}
									{renderCheck()}
								</>
							)
							// Keep the typed filter while toggling several matches in a multi-select.
							const selectItem = (
								<Ariakit.ComboboxItem
									key={`${label}-${optionKey}`}
									value={optionKey}
									resetValueOnSelect={false}
									className={showCheckboxes ? `${popoverRowStyles} min-w-0 flex-1` : popoverRowWithBorderStyles}
								>
									{optionContent}
								</Ariakit.ComboboxItem>
							)
							const item =
								typeof option !== 'string' && option.help ? (
									<Tooltip key={`${label}-${optionKey}`} content={option.help} render={selectItem}>
										{optionContent}
									</Tooltip>
								) : (
									selectItem
								)
							if (!showCheckboxes) return item
							// "Only" is its own item in the option's row, so ArrowRight reaches it: the search field keeps focus, and
							// a button inside an option would take only clicks.
							return (
								<Ariakit.ComboboxRow key={`${label}-${optionKey}`} className={gridRowStyles}>
									{item}
									<Ariakit.ComboboxItem
										value={`__only__${optionKey}`}
										selectValueOnClick={false}
										resetValueOnSelect={false}
										hideOnClick={false}
										onClick={() => selectOnlyOne(optionKey)}
										aria-label={`Only ${typeof option === 'string' ? option : option.name}`}
										className={onlyItemStyles}
									>
										Only
									</Ariakit.ComboboxItem>
								</Ariakit.ComboboxRow>
							)
						})}

						{hasOptionLimit && matches.length > viewableMatches
							? inRow(
									<Ariakit.ComboboxItem
										value="__see_more__"
										selectValueOnClick={false}
										hideOnClick={false}
										className={popoverSeeMoreStyles}
										onClick={handleSeeMore}
									>
										See more…
									</Ariakit.ComboboxItem>
								)
							: null}
					</Ariakit.ComboboxList>
				) : (
					emptyState
				)}
				{/* The footer's actions (such as adding a custom column) matter most when a search finds nothing. */}
				{customFooter}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
