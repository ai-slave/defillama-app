import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import * as React from 'react'
import { NestedMenu } from '~/components/NestedMenu'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import {
	nestedMenuSeeMoreStyles,
	nestedMenuSelectRowStyles,
	popoverMultiSelectCheckStyles,
	popoverRowWithBorderStyles,
	popoverScrollAreaStyles,
	popoverSeeMoreStyles,
	popoverSingleSelectCheckStyles
} from '~/ui/Popover'
import { PopoverHeader } from '~/ui/PopoverHeader'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'
import { readSelectionFromQuery, updateQueryFromSelected } from './query'
import { getSelectAllState, SELECT_ALL_VALUE, SelectAllContent } from './SelectAll'
import { SelectCheckIcon } from './SelectCheckIcon'
import type { ExcludeQueryKey, SelectOption, SelectTriggerSize, SelectTriggerVariant, SelectValues } from './types'
import { selectTriggerStyles } from './types'

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
	onEditCustomColumn?: (idx: number) => void
	onDeleteCustomColumn?: (idx: number) => void
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

const EMPTY_QUICK_ACTIONS: ReadonlyArray<{ label: string; onSelect: () => void }> = []

const NAVIGATION_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'])

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
	onEditCustomColumn,
	onDeleteCustomColumn,
	includeQueryKey,
	excludeQueryKey,
	resetPageOnQueryChange,
	pushQueryUpdates,
	onValuesChange,
	defaultSelectedValues,
	popoverClassName,
	searchPlaceholder = 'Search...',
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
	const showCheckboxes = Array.isArray(selectedValues) && !singleSelect
	const queryUpdateOptions = {
		...(resetPageOnQueryChange !== undefined ? { resetPage: resetPageOnQueryChange } : {}),
		...(pushQueryUpdates !== undefined ? { pushQueryUpdates } : {})
	}

	const isStringValue = React.useCallback((value: string | SelectOption): value is string => {
		return typeof value === 'string'
	}, [])

	const getOptionKey = React.useCallback(
		(value: string | SelectOption) => {
			return isStringValue(value) ? value : value.key
		},
		[isStringValue]
	)
	const setSelectedValuesFromState = React.useCallback(
		(values: Array<string>) => {
			if (setSelectedValuesProp) {
				setSelectedValuesProp(values)
			}
		},
		[setSelectedValuesProp]
	)

	// Helper to extract keys from allValues
	const getAllKeys = React.useCallback(() => allValues.map((v) => (typeof v === 'string' ? v : v.key)), [allValues])

	// If includeQueryKey is provided, use URL-based functions; otherwise derive from setSelectedValues
	const setSelectedValues: (values: Array<string>) => void = includeQueryKey
		? (values: Array<string>) =>
				updateQueryFromSelected(
					router,
					includeQueryKey,
					excludeQueryKey,
					getAllKeys(),
					values,
					defaultSelectedValues,
					queryUpdateOptions
				)
		: setSelectedValuesFromState
	const clearAll = includeQueryKey
		? () =>
				updateQueryFromSelected(
					router,
					includeQueryKey,
					excludeQueryKey,
					getAllKeys(),
					'None',
					defaultSelectedValues,
					queryUpdateOptions
				)
		: () => setSelectedValuesFromState([])
	const selectOnlyOne = includeQueryKey
		? (value: string) =>
				updateQueryFromSelected(
					router,
					includeQueryKey,
					excludeQueryKey,
					getAllKeys(),
					[value],
					defaultSelectedValues,
					queryUpdateOptions
				)
		: (value: string) => setSelectedValuesFromState([value])
	const firstSelectedValue = selectedValues[0]
	const providerValue = singleSelect ? (firstSelectedValue ?? '') : selectedValues
	const normalizeNextValues = React.useCallback(
		(values: Array<string> | string) => {
			if (singleSelect) {
				if (typeof values === 'string') return values ? [values] : []
				return values.slice(0, 1)
			}

			return Array.isArray(values) ? values : values ? [values] : []
		},
		[singleSelect]
	)

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

	// A new limit from the caller replaces however far the list was expanded.
	const [syncedVisibleOptionLimit, setSyncedVisibleOptionLimit] = React.useState(visibleOptionLimit)
	if (visibleOptionLimit !== syncedVisibleOptionLimit) {
		setSyncedVisibleOptionLimit(visibleOptionLimit)
		if (visibleOptionLimit !== null) {
			setViewableMatches(visibleOptionLimit)
		}
	}

	const getMatchKeys = React.useCallback(() => matches.map(getOptionKey), [matches, getOptionKey])

	const getSelectAllValues = React.useCallback(() => {
		if (selectAllScope === 'all') return getAllKeys()
		return Array.from(new Set(selectedValues.concat(getMatchKeys())))
	}, [getAllKeys, getMatchKeys, selectedValues, selectAllScope])

	const toggleAll = includeQueryKey
		? () => {
				const allKeys = getAllKeys()
				const nextValues = selectAllScope === 'all' ? null : getSelectAllValues()
				updateQueryFromSelected(
					router,
					includeQueryKey,
					excludeQueryKey,
					allKeys,
					nextValues && nextValues.length === allKeys.length ? null : nextValues,
					defaultSelectedValues,
					queryUpdateOptions
				)
			}
		: () => setSelectedValuesFromState(getSelectAllValues())
	const hasOptionLimit = visibleOptionLimit !== null
	const visibleMatches = hasOptionLimit ? matches.slice(0, viewableMatches) : matches
	// With a search typed and `selectAllScope="matches"`, the row acts on the shown options only.
	const selectsShown = selectAllScope === 'matches' && searchValue.trim() !== ''
	const selectAllScopeKeys = selectsShown ? getMatchKeys() : getAllKeys()
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

	// Ariakit makes the last selected option active on open and scrolls to it. In a multi-select that option is
	// arbitrary, so the list opens at its top and scrolls only to follow arrow-key navigation.
	const movedSinceOpenRef = React.useRef(false)
	// Spread only in multi-select: an undefined prop would replace Ariakit's own scroller.
	const optionScrollProps = showCheckboxes
		? {
				unstable_scrollIntoView: (element: HTMLElement) => {
					if (movedSinceOpenRef.current) element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
				}
			}
		: {}
	const searchProps = showCheckboxes
		? {
				...optionScrollProps,
				// Capture: Ariakit moves the active option in its own keydown handler, before a bubbling one runs.
				onKeyDownCapture: (event: React.KeyboardEvent) => {
					if (NAVIGATION_KEYS.has(event.key)) movedSinceOpenRef.current = true
				}
			}
		: {}
	const setOpen = (open: boolean) => {
		if (open) movedSinceOpenRef.current = false
	}

	const renderLeadingRows = (rowStyles: string, actionStyles: string) => (
		<>
			{showCheckboxes ? (
				<Ariakit.ComboboxItem
					value={SELECT_ALL_VALUE}
					{...optionScrollProps}
					selectValueOnClick={false}
					resetValueOnSelect={false}
					hideOnClick={false}
					onClick={toggleSelectAll}
					className={rowStyles}
				>
					<SelectAllContent label={selectsShown ? 'Select all shown' : 'Select all'} state={selectAllState} />
				</Ariakit.ComboboxItem>
			) : null}
			{quickActions.map((action) => (
				<Ariakit.ComboboxItem
					key={action.label}
					value={`__quick_action__${action.label}`}
					{...optionScrollProps}
					selectValueOnClick={false}
					resetValueOnSelect={false}
					hideOnClick={false}
					onClick={action.onSelect}
					className={actionStyles}
				>
					{action.label}
				</Ariakit.ComboboxItem>
			))}
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
		focusFirstNewItem(comboboxRef, '[role="option"]', leadingRowCount + previousCount)
	}

	const setInputValue = (value: string) => {
		React.startTransition(() => {
			setSearchValue(value)
		})
	}

	const setSelectedValue = (values: string | Array<string>) => {
		const nextValues = normalizeNextValues(values)
		setSelectedValues(nextValues)
		onValuesChange?.(nextValues, label)
	}

	if (nestedMenu) {
		return (
			<Ariakit.ComboboxProvider
				resetValueOnHide
				setOpen={setOpen}
				setInputValue={setInputValue}
				selectedValue={providerValue}
				setSelectedValue={setSelectedValue}
			>
				<NestedMenu label={label} render={<button type="button" />}>
					<PopoverHeader
						inset="nested"
						search={
							<Ariakit.Combobox {...searchProps} placeholder={searchPlaceholder} className={`w-full ${inputStyles}`} />
						}
					>
						{headerRow}
					</PopoverHeader>
					<Ariakit.ComboboxList ref={comboboxRef} className={popoverScrollAreaStyles}>
						{visibleMatches.length > 0
							? renderLeadingRows(nestedMenuSelectRowStyles, `${nestedMenuSeeMoreStyles} border-b border-subtle`)
							: null}
						{visibleMatches.map((option) => (
							<Ariakit.ComboboxItem
								key={getOptionKey(option)}
								value={getOptionKey(option)}
								{...optionScrollProps}
								resetValueOnSelect={false}
								hideOnClick={false}
								className={nestedMenuSelectRowStyles}
							>
								{isStringValue(option) ? (
									<span>{option}</span>
								) : !isStringValue(option) && option.help ? (
									<Tooltip content={option.help}>
										<span className="mr-1">{option.name}</span>
										<Icon name="help-circle" height={15} width={15} />
									</Tooltip>
								) : (
									<span className="inline-flex items-center gap-1.5">
										{isStringValue(option) ? option : option.name}
										{isStringValue(option) ? null : option.icon}
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
								See more...
							</Ariakit.ComboboxItem>
						) : null}
					</Ariakit.ComboboxList>
				</NestedMenu>
			</Ariakit.ComboboxProvider>
		)
	}

	return (
		<Ariakit.ComboboxProvider
			resetValueOnHide
			setOpen={setOpen}
			setInputValue={setInputValue}
			selectedValue={providerValue}
			setSelectedValue={setSelectedValue}
		>
			<Ariakit.ComboboxSelect
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
			</Ariakit.ComboboxSelect>
			<ComboboxSurface hideOnInteractOutside heading={heading ?? label} className={popoverClassName}>
				<PopoverHeader
					search={
						<Ariakit.ComboboxInput
							{...searchProps}
							placeholder={searchPlaceholder}
							className={`w-full ${inputStyles}`}
						/>
					}
				>
					{headerRow}
				</PopoverHeader>
				{matches.length > 0 ? (
					<>
						<Ariakit.ComboboxList ref={comboboxRef} className={popoverScrollAreaStyles}>
							{renderLeadingRows(
								`${popoverRowWithBorderStyles} gap-2`,
								`${popoverSeeMoreStyles} border-b border-subtle`
							)}
							{visibleMatches.map((option) => {
								const isCustom = typeof option === 'object' && option.isCustom
								const customIndex = typeof option === 'object' ? option.customIndex : undefined
								const optionKey = getOptionKey(option)
								const optionContent = (
									<>
										{isStringValue(option) ? (
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
										{isCustom && typeof customIndex === 'number' ? (
											<span className="ml-2 flex gap-1">
												<button
													type="button"
													tabIndex={-1}
													className="rounded-sm p-1 hover:bg-hover-row"
													onClick={(e) => {
														e.stopPropagation()
														onEditCustomColumn?.(customIndex)
													}}
													title="Edit custom column"
													aria-label="Edit custom column"
												>
													<Icon name="settings" height={14} width={14} />
												</button>
												<button
													type="button"
													tabIndex={-1}
													className="hover-wash rounded-sm p-1 text-secondary hover:text-data-down"
													onClick={(e) => {
														e.stopPropagation()
														onDeleteCustomColumn?.(customIndex)
													}}
													title="Delete custom column"
													aria-label="Delete custom column"
												>
													<Icon name="trash-2" height={14} width={14} />
												</button>
											</span>
										) : null}
										{showCheckboxes ? (
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation()
													selectOnlyOne(optionKey)
												}}
												className="invisible body-sm text-link underline group-hover:visible group-focus-visible:visible"
											>
												Only
											</button>
										) : null}
										{renderCheck()}
									</>
								)
								// Keep the typed filter while toggling several matches in a multi-select.
								const selectItem = (
									<Ariakit.ComboboxItem
										key={`${label}-${optionKey}`}
										value={optionKey}
										{...optionScrollProps}
										resetValueOnSelect={false}
										className={`${popoverRowWithBorderStyles} group gap-2`}
									>
										{optionContent}
									</Ariakit.ComboboxItem>
								)

								return !isStringValue(option) && option.help ? (
									<Tooltip key={`${label}-${optionKey}`} content={option.help} render={selectItem}>
										{optionContent}
									</Tooltip>
								) : (
									selectItem
								)
							})}

							{hasOptionLimit && matches.length > viewableMatches ? (
								<Ariakit.ComboboxItem
									value="__see_more__"
									selectValueOnClick={false}
									hideOnClick={false}
									className={popoverSeeMoreStyles}
									onClick={handleSeeMore}
								>
									See more...
								</Ariakit.ComboboxItem>
							) : null}
						</Ariakit.ComboboxList>
						{customFooter ? <>{customFooter}</> : null}
					</>
				) : (
					<p role="status" aria-live="polite" className="px-3 py-6 text-center body-sm text-tertiary">
						<Ariakit.ComboboxInputValue>
							{(value) => (value && typeof emptyLabel === 'string' ? `${emptyLabel} for "${value}"` : emptyLabel)}
						</Ariakit.ComboboxInputValue>
					</p>
				)}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
