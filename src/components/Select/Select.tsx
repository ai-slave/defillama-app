import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import * as React from 'react'
import { NestedMenu, NestedMenuItem } from '~/components/NestedMenu'
import { Icon } from '~/ui/Icon'
import {
	nestedMenuActionBarStyles,
	nestedMenuActionButtonStyles,
	nestedMenuSeeMoreStyles,
	nestedMenuSelectRowStyles,
	popoverActionBarStyles,
	popoverActionButtonStyles,
	popoverMultiSelectCheckStyles,
	popoverRowWithBorderStyles,
	popoverSeeMoreStyles,
	popoverSingleSelectCheckStyles
} from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'
import { readSelectionFromQuery, updateQueryFromSelected } from './query'
import { SelectCheckIcon } from './SelectCheckIcon'
import type { ExcludeQueryKey, SelectValues, SelectTriggerSize, SelectTriggerVariant } from './types'
import { selectTriggerStyles } from './types'

interface ISelectBase {
	allValues: SelectValues
	label: React.ReactNode
	nestedMenu?: boolean
	labelType?: 'regular' | 'smol' | 'none'
	variant: SelectTriggerVariant
	size: SelectTriggerSize
	/** Placement and layout classes appended to the trigger; `variant` and `size` own its look. */
	className?: string
	triggerProps?: Omit<Ariakit.ComboboxSelectProps, 'className'>
	/** The trigger's accessible name comes from `triggerProps`; a top-level `aria-label` was silently dropped. */
	'aria-label'?: never
	placement?: Ariakit.ComboboxProviderProps['placement']
	/** Layout only, e.g. `z-100` above an open dialog. */
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

type ISelect = ISelectWithUrlParams | ISelectWithStateArray | ISelectWithStateSingle

function isUrlSelect(props: ISelect): props is ISelectWithUrlParams {
	return typeof props.includeQueryKey === 'string'
}

function isMultiStateSelect(props: ISelect): props is ISelectWithStateArray {
	return !isUrlSelect(props) && Array.isArray(props.selectedValues)
}

export function Select(props: ISelect) {
	const {
		allValues,
		label,
		nestedMenu,
		labelType = 'regular',
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
						allValues.map((v) => (typeof v === 'string' ? v : v.key))
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

	const isSelectOption = React.useCallback((option: string | { key: string; name: string; help?: string }) => {
		return typeof option !== 'string'
	}, [])

	// Helper to extract keys from allValues
	const getAllKeys = React.useCallback(() => allValues.map((v) => (typeof v === 'string' ? v : v.key)), [allValues])

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
	const [viewableMatches, setViewableMatches] = React.useState(6)

	const canSelectOnlyOne = typeof selectedValues === 'string'
	const showCheckboxes = !canSelectOnlyOne
	const selectedCount = canSelectOnlyOne ? (selectedValues ? 1 : 0) : selectedValues.length

	const selectRef = React.useRef<HTMLDivElement>(null)
	const nestedMenuRef = React.useRef<HTMLDivElement>(null)

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

	const handleSeeMore = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		const previousCount = viewableMatches
		setViewableMatches((prev) => prev + 20)
		const containerRef = nestedMenuRef.current ? nestedMenuRef : selectRef
		focusFirstNewItem(containerRef, nestedMenu ? '[role^="menuitem"]' : '[role="option"]', previousCount)
	}

	if (nestedMenu) {
		return (
			<NestedMenu combobox={null} label={label} render={<button type="button" />}>
				<div ref={nestedMenuRef}>
					{showCheckboxes ? (
						<span className={nestedMenuActionBarStyles}>
							<button type="button" onClick={clearAll} className={nestedMenuActionButtonStyles}>
								Deselect All
							</button>
							<button type="button" onClick={toggleAll} className={nestedMenuActionButtonStyles}>
								Select All
							</button>
						</span>
					) : null}
					{allValues.slice(0, viewableMatches).map((option) => (
						<NestedSelectItem
							key={getOptionKey(option)}
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
							{typeof option === 'string' ? (
								<span>{option}</span>
							) : isSelectOption(option) && option.help ? (
								<Tooltip content={option.help}>
									<span className="mr-1">{option.name}</span>
									<Icon name="help-circle" height={15} width={15} />
								</Tooltip>
							) : (
								<span>{isSelectOption(option) ? option.name : option}</span>
							)}
							{renderCheck(getOptionKey(option))}
						</NestedSelectItem>
					))}
					{allValues.length > viewableMatches ? (
						<NestedMenuItem hideOnClick={false} className={nestedMenuSeeMoreStyles} onClick={handleSeeMore}>
							See more...
						</NestedMenuItem>
					) : null}
				</div>
			</NestedMenu>
		)
	}

	return (
		<Ariakit.ComboboxProvider selectedValue={selectedValues} setSelectedValue={setSelectedValues} placement={placement}>
			<Ariakit.ComboboxSelect
				className={`${selectTriggerStyles(variant, size)} ${className ?? ''}`}
				aria-label={`${labelText} dropdown`}
				{...triggerProps}
			>
				{labelType === 'smol' ? (
					<span className="flex items-center gap-1">
						<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 label-xs">
							{selectedCount}
						</span>
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
			</Ariakit.ComboboxSelect>
			<ComboboxSurface hideOnInteractOutside className={popoverClassName} ref={selectRef}>
				{allValues.length > 0 ? (
					<>
						{showCheckboxes ? (
							<span className={popoverActionBarStyles}>
								<button type="button" onClick={clearAll} className={popoverActionButtonStyles}>
									Deselect All
								</button>
								<button type="button" onClick={toggleAll} className={popoverActionButtonStyles}>
									Select All
								</button>
							</span>
						) : null}

						{allValues.slice(0, viewableMatches).map((option) => (
							<Ariakit.ComboboxItem
								key={getOptionKey(option)}
								value={getOptionKey(option)}
								className={`${popoverRowWithBorderStyles} group justify-start gap-2`}
							>
								{typeof option === 'string' ? (
									<span>{option}</span>
								) : isSelectOption(option) && option.help ? (
									<Tooltip content={option.help}>
										<span className="mr-1">{option.name}</span>
										<Icon name="help-circle" height={15} width={15} />
									</Tooltip>
								) : (
									<span>{isSelectOption(option) ? option.name : option}</span>
								)}

								{showCheckboxes ? (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation()
											selectOnlyOne(getOptionKey(option))
										}}
										className="invisible body-sm text-link underline group-hover:visible group-focus-visible:visible"
									>
										Only
									</button>
								) : null}
								{renderCheck(getOptionKey(option))}
							</Ariakit.ComboboxItem>
						))}
						{allValues.length > viewableMatches ? (
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
					</>
				) : (
					<p role="status" aria-live="polite" className="px-3 py-6 text-center body-sm text-tertiary">
						No results found
					</p>
				)}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
