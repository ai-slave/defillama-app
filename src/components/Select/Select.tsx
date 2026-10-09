import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import * as React from 'react'
import { NestedMenu } from '~/components/NestedMenu'
import { CountBadge } from '~/ui/CountBadge'
import { Icon } from '~/ui/Icon'
import {
	nestedMenuSelectRowStyles,
	popoverMultiSelectCheckStyles,
	popoverRowStyles,
	popoverRowWithBorderStyles,
	popoverScrollAreaStyles,
	popoverSingleSelectCheckStyles
} from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { ComboboxSelectTrigger } from './ComboboxSelectTrigger'
import { readSelectionFromQuery, updateQueryFromSelected } from './query'
import { getSelectAllState, SELECT_ALL_VALUE, SelectAllContent } from './SelectAll'
import { SelectCheckIcon } from './SelectCheckIcon'
import { gridRowStyles, onlyItemStyles } from './SelectWithCombobox'
import type { ExcludeQueryKey, SelectValues, SelectTriggerSize, SelectTriggerVariant } from './types'
import { selectTriggerStyles } from './types'

/* Select — a single or multi picker for a short list. It never searches and shows every option, with no "See more",
   in a `panel` drawer that hugs its rows. The folder README says which picker fits. */

/** With `labelType="none"` the trigger shows the current value, so `heading` names the phone drawer; otherwise the label does. */
type SelectLabelProps =
	| { label: React.ReactNode; labelType?: 'regular' | 'smol' | 'none'; heading: string }
	| { label: React.ReactNode; labelType?: 'regular' | 'smol'; heading?: undefined }

interface ISelectBase {
	allValues: SelectValues
	nestedMenu?: boolean
	variant: SelectTriggerVariant
	size: SelectTriggerSize
	/** Placement and layout classes appended to the trigger; `variant` and `size` own its look. */
	className?: string
	triggerProps?: Omit<Ariakit.ComboboxSelectProps, 'className'>
	/** The trigger's accessible name comes from `triggerProps`; a top-level `aria-label` was silently dropped. */
	'aria-label'?: never
	placement?: Ariakit.ComboboxProviderProps['placement']
	/** Layout only, such as a width. */
	popoverClassName?: string
}

interface ISelectWithUrlParams extends ISelectBase {
	includeQueryKey: string
	excludeQueryKey: ExcludeQueryKey
	/** The picker reads its selection from the URL with `readSelectionFromQuery`, the same reader pages use. */
	selectedValues?: never
	setSelectedValues?: never
}

interface ISelectWithStateArray extends ISelectBase {
	includeQueryKey?: never
	excludeQueryKey?: never
	selectedValues: Array<string>
	setSelectedValues: (values: Array<string>) => void
}

interface ISelectWithStateSingle extends ISelectBase {
	includeQueryKey?: never
	excludeQueryKey?: never
	selectedValues: string
	setSelectedValues: (value: string) => void
}

type ISelect = SelectLabelProps & (ISelectWithUrlParams | ISelectWithStateArray | ISelectWithStateSingle)

function isUrlSelect(props: ISelect): props is ISelect & ISelectWithUrlParams {
	return typeof props.includeQueryKey === 'string'
}

function isMultiStateSelect(props: ISelect): props is ISelect & ISelectWithStateArray {
	return !isUrlSelect(props) && Array.isArray(props.selectedValues)
}

/** An option's name. `help` is a tooltip on a pickable option; on a disabled one it is the visible reason under the
    name, since a disabled row's tooltip never opens. `muted` draws the name on the secondary tier. */
function OptionLabel({ option }: { option: SelectValues[number] }) {
	if (typeof option === 'string') return <span>{option}</span>
	if (option.disabled)
		return (
			<span className="flex min-w-0 flex-col">
				<span>{option.name}</span>
				{option.help ? <span className="body-xs text-tertiary">{option.help}</span> : null}
			</span>
		)
	if (option.help)
		return (
			<Tooltip content={option.help}>
				<span className={option.muted ? 'mr-1 text-secondary' : 'mr-1'}>{option.name}</span>
				<Icon name="help-circle" height={15} width={15} />
			</Tooltip>
		)
	return <span className={option.muted ? 'text-secondary' : undefined}>{option.name}</span>
}

export function Select(props: ISelect) {
	const {
		allValues,
		label,
		nestedMenu,
		labelType = 'regular',
		heading,
		variant,
		size,
		className,
		triggerProps,
		placement = 'bottom-start',
		popoverClassName
	} = props
	const router = useRouter()
	const { includeQueryKey, excludeQueryKey } = isUrlSelect(props) ? props : {}
	const urlSelection = React.useMemo(
		() =>
			includeQueryKey && excludeQueryKey
				? readSelectionFromQuery(
						router.query,
						includeQueryKey,
						excludeQueryKey,
						// The full set leaves disabled options out, as the writer does, so an empty query never selects them.
						allValues.flatMap((v) => (typeof v === 'string' ? [v] : v.disabled ? [] : [v.key]))
					)
				: [],
		[router.query, includeQueryKey, excludeQueryKey, allValues]
	)
	const selectedValues = props.selectedValues ?? urlSelection
	// Nested menus share their parent's values, so each select needs its own field.
	const selectionName = React.useId()
	const labelText = typeof label === 'string' ? label : typeof label === 'number' ? String(label) : 'Select'

	const getOptionKey = React.useCallback((option: string | { key: string }) => {
		return typeof option === 'string' ? option : option.key
	}, [])

	const isSelectOption = React.useCallback(
		(option: string | { key: string; name: string; help?: string; muted?: boolean }) => {
			return typeof option !== 'string'
		},
		[]
	)

	// Helper to extract keys from allValues
	// A disabled option can never be picked, so Select all and the URL's full set leave it out.
	const getAllKeys = React.useCallback(
		() => allValues.flatMap((v) => (typeof v === 'string' ? [v] : v.disabled ? [] : [v.key])),
		[allValues]
	)

	const setSelectedValues = React.useCallback(
		(values: Array<string> | string) => {
			if (isUrlSelect(props)) {
				updateQueryFromSelected(router, props.includeQueryKey, props.excludeQueryKey, getAllKeys(), values)
				return
			}
			if (isMultiStateSelect(props)) {
				props.setSelectedValues(Array.isArray(values) ? values : values ? [values] : [])
				return
			}
			props.setSelectedValues(typeof values === 'string' ? values : (values[0] ?? ''))
		},
		[getAllKeys, props, router]
	)
	const clearAll = React.useCallback(() => {
		if (isUrlSelect(props)) {
			updateQueryFromSelected(router, props.includeQueryKey, props.excludeQueryKey, getAllKeys(), 'None')
			return
		}
		if (isMultiStateSelect(props)) {
			props.setSelectedValues([])
			return
		}
		props.setSelectedValues('')
	}, [getAllKeys, props, router])
	const toggleAll = React.useCallback(() => {
		if (isUrlSelect(props)) {
			updateQueryFromSelected(router, props.includeQueryKey, props.excludeQueryKey, getAllKeys(), null)
			return
		}
		if (isMultiStateSelect(props)) {
			props.setSelectedValues(getAllKeys())
		}
	}, [getAllKeys, props, router])
	const selectOnlyOne = React.useCallback(
		(value: string) => {
			if (isUrlSelect(props)) {
				updateQueryFromSelected(router, props.includeQueryKey, props.excludeQueryKey, getAllKeys(), [value])
				return
			}
			if (isMultiStateSelect(props)) {
				props.setSelectedValues([value])
				return
			}
			props.setSelectedValues(value)
		},
		[getAllKeys, props, router]
	)
	const canSelectOnlyOne = typeof selectedValues === 'string'
	const showCheckboxes = !canSelectOnlyOne
	const selectedCount = canSelectOnlyOne ? (selectedValues ? 1 : 0) : selectedValues.length

	const selectAllState = getSelectAllState(getAllKeys(), canSelectOnlyOne ? [] : selectedValues)
	const toggleSelectAll = selectAllState === 'all' ? clearAll : toggleAll
	const selectAllContent = <SelectAllContent label="Select all" state={selectAllState} />

	const NestedSelectItem = canSelectOnlyOne ? Ariakit.MenuItemRadio : Ariakit.MenuItemCheckbox

	const renderCheck = (value: string) => {
		const selected = typeof selectedValues === 'string' ? selectedValues === value : selectedValues.includes(value)

		return (
			<span
				className={showCheckboxes ? popoverMultiSelectCheckStyles(selected) : popoverSingleSelectCheckStyles(selected)}
				aria-hidden
			>
				{selected ? <SelectCheckIcon /> : null}
			</span>
		)
	}

	if (nestedMenu) {
		return (
			<NestedMenu combobox={null} label={label} render={<button type="button" />}>
				<div className={popoverScrollAreaStyles}>
					{showCheckboxes ? (
						<Ariakit.MenuItem hideOnClick={false} onClick={toggleSelectAll} className={nestedMenuSelectRowStyles}>
							{selectAllContent}
						</Ariakit.MenuItem>
					) : null}
					{allValues.map((option) => (
						<NestedSelectItem
							key={getOptionKey(option)}
							disabled={typeof option !== 'string' && option.disabled}
							accessibleWhenDisabled
							name={selectionName}
							value={getOptionKey(option)}
							checked={
								canSelectOnlyOne
									? selectedValues === getOptionKey(option)
									: selectedValues.includes(getOptionKey(option))
							}
							onChange={(event) => {
								const value = getOptionKey(option)
								setSelectedValues(
									typeof selectedValues === 'string'
										? value
										: event.currentTarget.checked
											? [...selectedValues, value]
											: selectedValues.filter((selected) => selected !== value)
								)
							}}
							hideOnClick={false}
							className={nestedMenuSelectRowStyles}
						>
							<OptionLabel option={option} />
							{renderCheck(getOptionKey(option))}
						</NestedSelectItem>
					))}
				</div>
			</NestedMenu>
		)
	}

	return (
		<Ariakit.ComboboxProvider selectedValue={selectedValues} setSelectedValue={setSelectedValues} placement={placement}>
			<ComboboxSelectTrigger
				className={`${selectTriggerStyles(variant, size)} ${className ?? ''}`}
				aria-label={`${labelText} dropdown`}
				{...triggerProps}
			>
				{labelType === 'smol' ? (
					<span className="flex items-center gap-1">
						<CountBadge count={selectedCount} />
						<span>{label}</span>
					</span>
				) : labelType === 'regular' && selectedCount > 0 ? (
					<>
						<span>{label}: </span>
						<span className="text-link">
							{canSelectOnlyOne
								? selectedValues
								: selectedValues.length > 2
									? `${selectedValues[0]} + ${selectedValues.length - 1} others`
									: selectedValues.join(', ')}
						</span>
					</>
				) : (
					<>{label}</>
				)}
				<Ariakit.ComboboxSelectArrow className="text-tertiary" />
			</ComboboxSelectTrigger>
			{/* Select has no search and holds short lists, so its phone drawer hugs its rows. */}
			<ComboboxSurface
				variant="panel"
				hideOnInteractOutside
				heading={heading ?? labelText}
				className={popoverClassName}
			>
				{allValues.length > 0 ? (
					<div className={popoverScrollAreaStyles}>
						{showCheckboxes ? (
							<Ariakit.ComboboxRow className={gridRowStyles}>
								<Ariakit.ComboboxItem
									value={SELECT_ALL_VALUE}
									selectValueOnClick={false}
									hideOnClick={false}
									onClick={toggleSelectAll}
									className={`${popoverRowStyles} flex-1 gap-2`}
								>
									{selectAllContent}
								</Ariakit.ComboboxItem>
							</Ariakit.ComboboxRow>
						) : null}
						{allValues.map((option) => {
							const optionKey = getOptionKey(option)
							const optionName = isSelectOption(option) ? option.name : option
							const optionDisabled = typeof option !== 'string' && option.disabled
							const selectItem = (
								<Ariakit.ComboboxItem
									key={optionKey}
									value={optionKey}
									disabled={optionDisabled}
									accessibleWhenDisabled
									className={
										showCheckboxes
											? `${popoverRowStyles} min-w-0 flex-1 justify-start gap-2`
											: `${popoverRowWithBorderStyles} justify-start gap-2`
									}
								>
									<OptionLabel option={option} />
									{/* The space "Only" lies over, so a long name never runs under it. */}
									{showCheckboxes ? <span aria-hidden className="ml-auto w-11 shrink-0 max-sm:w-14" /> : null}
									{renderCheck(optionKey)}
								</Ariakit.ComboboxItem>
							)
							if (!showCheckboxes) return selectItem
							// "Only" is its own item in the option's row, so ArrowRight reaches it; a button inside an option would
							// take only clicks.
							return (
								<Ariakit.ComboboxRow key={optionKey} className={gridRowStyles}>
									{selectItem}
									<Ariakit.ComboboxItem
										value={`__only__${optionKey}`}
										disabled={optionDisabled}
										selectValueOnClick={false}
										hideOnClick={false}
										onClick={() => selectOnlyOne(optionKey)}
										aria-label={`Only ${optionName}`}
										className={onlyItemStyles}
									>
										Only
									</Ariakit.ComboboxItem>
								</Ariakit.ComboboxRow>
							)
						})}
					</div>
				) : (
					<p role="status" aria-live="polite" className="px-3 py-6 text-center body-sm text-tertiary">
						No results found
					</p>
				)}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
