import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Icon } from '~/components/Icon'
import { NestedMenu, NestedMenuItem } from '~/components/NestedMenu'
import { Tooltip } from '~/components/Tooltip'
import {
	legacyPopoverActionButtonStyles,
	legacyPopoverActionBarStyles,
	legacyPopoverSeeMoreStyles,
	legacyPopoverSelectCheckStyles,
	legacySelectPopoverRowStyles,
	legacySelectPopoverSurfaceStyles,
	popoverActionBarStyles,
	popoverActionButtonStyles,
	popoverMultiSelectCheckStyles,
	popoverRowWithBorderStyles,
	popoverSeeMoreStyles,
	popoverSingleSelectCheckStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'
import { updateQueryFromSelected } from './query'
import type { ExcludeQueryKey, SelectValues, SelectTriggerSize, SelectTriggerVariant } from './types'
import { selectTriggerStyles } from './types'

interface ISelectBase {
	allValues: SelectValues
	selectedValues: Array<string> | string
	label: React.ReactNode
	nestedMenu?: boolean
	labelType?: 'regular' | 'smol' | 'none'
	variant?: SelectTriggerVariant
	size?: SelectTriggerSize
	triggerProps?: Ariakit.SelectProps
	portal?: boolean
	placement?: Ariakit.SelectProviderProps['placement']
	defaultSelectedValues?: string[]
	unmountOnHide?: boolean
	popoverVariant?: 'default' | 'legacy'
}

interface ISelectWithUrlParams extends ISelectBase {
	includeQueryKey: string
	excludeQueryKey: ExcludeQueryKey
	defaultSelectedValues?: string[]
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
		selectedValues,
		label,
		nestedMenu,
		labelType = 'regular',
		variant,
		size,
		triggerProps,
		portal,
		placement = 'bottom-start',
		unmountOnHide = true,
		popoverVariant = 'default'
	} = props
	const router = useRouter()
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
		(values: string[] | string) => {
			if (isUrlSelect(props)) {
				updateQueryFromSelected(
					router,
					props.includeQueryKey,
					props.excludeQueryKey,
					getAllKeys(),
					values,
					props.defaultSelectedValues
				)
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
			updateQueryFromSelected(
				router,
				props.includeQueryKey,
				props.excludeQueryKey,
				getAllKeys(),
				'None',
				props.defaultSelectedValues
			)
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
			updateQueryFromSelected(
				router,
				props.includeQueryKey,
				props.excludeQueryKey,
				getAllKeys(),
				null,
				props.defaultSelectedValues
			)
			return
		}
		if (isMultiStateSelect(props)) {
			props.setSelectedValues(getAllKeys())
		}
	}, [getAllKeys, props, router])
	const selectOnlyOne = React.useCallback(
		(value: string) => {
			if (isUrlSelect(props)) {
				updateQueryFromSelected(
					router,
					props.includeQueryKey,
					props.excludeQueryKey,
					getAllKeys(),
					[value],
					props.defaultSelectedValues
				)
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
	const toggleMultiValue = (value: string) => {
		const currentValues = Array.isArray(selectedValues) ? selectedValues : selectedValues ? [selectedValues] : []
		if (currentValues.includes(value)) {
			setSelectedValues(currentValues.filter((currentValue) => currentValue !== value))
			return
		}
		setSelectedValues([...currentValues, value])
	}

	const [viewableMatches, setViewableMatches] = React.useState(6)

	const canSelectOnlyOne = typeof selectedValues === 'string'
	const showCheckboxes = !canSelectOnlyOne
	const selectedCount = canSelectOnlyOne ? (selectedValues ? 1 : 0) : selectedValues.length
	const isOptionSelected = React.useCallback(
		(value: string) => (Array.isArray(selectedValues) ? selectedValues.includes(value) : selectedValues === value),
		[selectedValues]
	)
	const useLegacyPopover = popoverVariant === 'legacy' || variant === 'pro'
	const actionBarStyles = useLegacyPopover ? legacyPopoverActionBarStyles : popoverActionBarStyles
	const actionButtonStyles = useLegacyPopover ? legacyPopoverActionButtonStyles : popoverActionButtonStyles
	const rowStyles = useLegacyPopover ? legacySelectPopoverRowStyles : popoverRowWithBorderStyles
	const seeMoreStyles = useLegacyPopover ? legacyPopoverSeeMoreStyles : popoverSeeMoreStyles
	const surfaceStyles = useLegacyPopover ? legacySelectPopoverSurfaceStyles : popoverSurfaceStyles

	const selectRef = React.useRef<HTMLDivElement>(null)
	const nestedMenuRef = React.useRef<HTMLDivElement>(null)

	const renderCheck = (value: string) => {
		if (useLegacyPopover) {
			return showCheckboxes ? (
				<Ariakit.SelectItemCheck className={legacyPopoverSelectCheckStyles} />
			) : (
				<Ariakit.SelectItemCheck className="ml-auto" />
			)
		}

		const selected = isOptionSelected(value)
		return showCheckboxes ? (
			<span className={popoverMultiSelectCheckStyles(selected)} aria-hidden>
				{selected ? <Icon name="check" className="size-3" /> : null}
			</span>
		) : (
			<span className={popoverSingleSelectCheckStyles(selected)} aria-hidden>
				{selected ? <Icon name="check" className="size-3" /> : null}
			</span>
		)
	}

	const handleSeeMore = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		const previousCount = viewableMatches
		setViewableMatches((prev) => prev + 20)
		const containerRef = nestedMenuRef.current ? nestedMenuRef : selectRef
		focusFirstNewItem(containerRef, '[role="option"]', previousCount)
	}

	if (nestedMenu) {
		return (
			<Ariakit.SelectProvider
				value={selectedValues}
				setValue={(values) => {
					setSelectedValues(values)
				}}
			>
				<NestedMenu
					label={label}
					render={<button type="button" />}
					popoverVariant={useLegacyPopover ? 'legacy' : popoverVariant}
				>
					<div ref={nestedMenuRef}>
						{showCheckboxes ? (
							<span className={actionBarStyles}>
								<button onClick={clearAll} className={actionButtonStyles}>
									Deselect All
								</button>
								<button onClick={toggleAll} className={actionButtonStyles}>
									Select All
								</button>
							</span>
						) : null}
						{allValues.slice(0, viewableMatches).map((option) => (
							<NestedMenuItem
								key={getOptionKey(option)}
								render={
									<Ariakit.SelectItem
										value={getOptionKey(option)}
										setValueOnClick={!showCheckboxes}
										hideOnClick={!showCheckboxes}
										onClick={
											showCheckboxes
												? (event) => {
														event.preventDefault()
														event.stopPropagation()
														toggleMultiValue(getOptionKey(option))
													}
												: undefined
										}
									/>
								}
								hideOnClick={false}
								className={rowStyles}
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
							</NestedMenuItem>
						))}
						{allValues.length > viewableMatches ? (
							<Ariakit.SelectItem
								value="__see_more__"
								setValueOnClick={false}
								hideOnClick={false}
								className={seeMoreStyles}
								onClick={handleSeeMore}
							>
								See more...
							</Ariakit.SelectItem>
						) : null}
					</div>
				</NestedMenu>
			</Ariakit.SelectProvider>
		)
	}

	return (
		<Ariakit.SelectProvider
			value={selectedValues}
			setValue={(values) => {
				setSelectedValues(values)
			}}
			placement={placement}
		>
			<Ariakit.Select
				className={selectTriggerStyles(variant, size)}
				aria-label={`${labelText} dropdown`}
				{...triggerProps}
			>
				{labelType === 'smol' ? (
					<span className="flex items-center gap-1">
						<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 label-xs leading-none">
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
				<Ariakit.SelectArrow />
			</Ariakit.Select>
			<Ariakit.SelectPopover
				unmountOnHide={unmountOnHide}
				hideOnInteractOutside
				gutter={6}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={surfaceStyles}
				portal={portal || false}
				ref={selectRef}
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>

				{allValues.length > 0 ? (
					<>
						{showCheckboxes ? (
							<span className={actionBarStyles}>
								<button onClick={clearAll} className={actionButtonStyles}>
									Deselect All
								</button>
								<button onClick={toggleAll} className={actionButtonStyles}>
									Select All
								</button>
							</span>
						) : null}

						{allValues.slice(0, viewableMatches).map((option) => (
							<Ariakit.SelectItem
								key={getOptionKey(option)}
								value={getOptionKey(option)}
								setValueOnClick={!showCheckboxes}
								hideOnClick={!showCheckboxes}
								onClick={
									showCheckboxes
										? (event) => {
												event.preventDefault()
												event.stopPropagation()
												toggleMultiValue(getOptionKey(option))
											}
										: undefined
								}
								className={`${rowStyles} group justify-start ${useLegacyPopover ? 'gap-4' : 'gap-2'}`}
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
							</Ariakit.SelectItem>
						))}
						{allValues.length > viewableMatches ? (
							<Ariakit.SelectItem
								value="__see_more__"
								setValueOnClick={false}
								hideOnClick={false}
								className={seeMoreStyles}
								onClick={handleSeeMore}
							>
								See more...
							</Ariakit.SelectItem>
						) : null}
					</>
				) : (
					<p className="px-3 py-6 text-center body-sm text-tertiary">No results found</p>
				)}
			</Ariakit.SelectPopover>
		</Ariakit.SelectProvider>
	)
}
