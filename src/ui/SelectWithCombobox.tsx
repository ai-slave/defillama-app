import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import * as React from 'react'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'
import {
	ComboboxSelectTrigger,
	selectTriggerStyles,
	type SelectTriggerSize,
	type SelectTriggerVariant
} from './ComboboxSelectTrigger'
import { CountBadge } from './CountBadge'
import { Icon } from './Icon'
import { Input } from './Input'
import { Check } from './internal/Check'
import {
	nestedMenuSeeMoreStyles,
	nestedMenuSelectRowStyles,
	popoverRowStyles,
	popoverRowWithBorderStyles,
	popoverScrollAreaStyles,
	popoverSeeMoreStyles
} from './internal/Popover'
import { isSearchable } from './internal/searchThreshold'
import { getSelectAllState, SELECT_ALL_VALUE, SelectAllContent } from './internal/SelectAll'
import { gridRowStyles, onlyItemStyles } from './internal/selectRowStyles'
import { NestedMenu } from './NestedMenu'
import { PopoverHeader } from './PopoverHeader'
import { ComboboxSurface, type SurfaceWidth } from './PopoverSurface'
import type { SelectOption, SelectValues } from './Select'
import { Tooltip } from './Tooltip'

/* SelectWithCombobox — a single or multi picker for a mid-sized list; design.md "Which component for which job" says
   which picker fits. `quickActions` offer preset selections (only EVM chains) under "Select all". A selection that
   lives in the URL renders UrlSelectWithCombobox (src/components/Select/UrlSelect.tsx), which reads and writes it for
   this picker. A list opens scrolled to its last selected option, which is Ariakit's behavior; multi-selects keep it
   too.

   A multi-select row holds two `role="option"` items: the option and its "Only" button. Code that counts or indexes
   options skips `[aria-label^="Only "]`. */

interface ISelectWithComboboxBase {
	allValues: SelectValues
	/** What the trigger lists after the label instead of the picked names: one group name for its selected members, or a
	    summary such as "All except Ethereum". The `smol` count still counts `selectedValues`. */
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
	popoverWidth?: SurfaceWidth
	searchPlaceholder?: string
	visibleOptionLimit?: number | null
	selectAllScope?: 'all' | 'matches'
	emptyLabel?: React.ReactNode
}

/** With `labelType="none"` the trigger shows the current value, so `heading` names the phone drawer; otherwise the label does. */
type SelectWithComboboxLabelProps =
	| { label: string; labelType?: 'regular' | 'smol' | 'none'; heading: string }
	| { label: string; labelType?: 'regular' | 'smol'; heading?: undefined }

/** Every SelectWithCombobox prop but the selection. */
export type SelectWithComboboxBaseProps = SelectWithComboboxLabelProps & ISelectWithComboboxBase

type ISelectWithCombobox = SelectWithComboboxBaseProps & {
	selectedValues: Array<string>
	setSelectedValues: (values: Array<string>) => void
}

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
	selectedValues,
	selectedLabels: selectedLabelsProp,
	setSelectedValues,
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
	onValuesChange,
	popoverWidth,
	searchPlaceholder = 'Search…',
	visibleOptionLimit = 20,
	selectAllScope = 'all',
	emptyLabel = 'No results found'
}: ISelectWithCombobox) {
	const selectedLabels = selectedLabelsProp ?? selectedValues
	const valuesAreAnArrayOfStrings = typeof allValues[0] === 'string'
	const showCheckboxes = !singleSelect
	const allKeys = allValues.map(getOptionKey)
	const clearAll = () => setSelectedValues([])
	const selectOnlyOne = (value: string) => setSelectedValues([value])
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
		if (selectAllScope === 'all') return setSelectedValues(allKeys)
		setSelectedValues(Array.from(new Set(selectedValues.concat(matchKeys))))
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
				{(selected) => <Check kind={showCheckboxes ? 'box' : 'tick'} checked={selected} className="ml-auto" />}
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
											<span className={option.muted ? 'mr-1 text-secondary' : 'mr-1'}>{option.name}</span>
											<Icon name="help-circle" className="size-3.5" />
										</Tooltip>
									) : (
										<span className={`inline-flex items-center gap-1.5${option.muted ? ' text-secondary' : ''}`}>
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
				// A trigger with an id is a Field's control: the Field's visible label names it.
				aria-label={triggerProps?.id ? undefined : `${label} dropdown`}
				{...triggerProps}
			>
				{labelType === 'smol' ? (
					<span className="flex items-center gap-1">
						<CountBadge count={selectedValues.length} />
						<span>{label}</span>
					</span>
				) : labelType === 'regular' && selectedLabels.length > 0 ? (
					<>
						<span>{label}: </span>
						<span className="text-link">
							{singleSelect && firstSelectedValue !== undefined
								? getSelectOptionLabel(allValues, firstSelectedValue)
								: selectedLabels.length > 2
									? `${selectedLabels[0]} + ${selectedLabels.length - 1} others`
									: selectedLabels.join(', ')}
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
				width={popoverWidth}
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
											<span className={option.muted ? 'mr-1 text-secondary' : 'mr-1'}>{option.name}</span>
											<Icon name="help-circle" className="size-3.5" />
										</span>
									) : (
										<span className={`inline-flex items-center gap-1.5${option.muted ? ' text-secondary' : ''}`}>
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
