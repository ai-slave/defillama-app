import * as Ariakit from '@ariakit/react'
import clsx from 'clsx'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Icon } from '~/components/Icon'
import { NestedMenu, NestedMenuItem } from '~/components/NestedMenu'
import { Tooltip } from '~/components/Tooltip'
import { inputStyles } from '~/ui/Input'
import {
	excludedSurfaceComboboxActionBarStyles,
	excludedSurfaceComboboxPopoverSurfaceStyles,
	legacyPopoverActionButtonStyles,
	legacyPopoverSeeMoreStyles,
	legacyPopoverSelectCheckStyles,
	legacySelectPopoverRowStyles,
	nestedMenuActionBarStyles,
	nestedMenuActionButtonStyles,
	nestedMenuSeeMoreStyles,
	nestedMenuSearchBlockStyles,
	nestedMenuSelectRowStyles,
	popoverActionBarStyles,
	popoverActionButtonStyles,
	popoverMultiSelectCheckStyles,
	popoverRowWithBorderStyles,
	popoverSearchBlockStyles,
	popoverSeeMoreStyles,
	popoverSingleSelectCheckStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { updateQueryFromSelected } from './query'
import { SelectCheckIcon } from './SelectCheckIcon'
import type { ExcludeQueryKey, SelectOption, SelectTriggerSize, SelectTriggerVariant, SelectValues } from './types'
import { selectTriggerStyles } from './types'

interface ISelectWithComboboxBase {
	allValues: SelectValues
	selectedValues: Array<string>
	label: string
	singleSelect?: boolean
	nestedMenu?: boolean
	labelType?: 'regular' | 'smol' | 'none'
	variant?: SelectTriggerVariant
	size?: SelectTriggerSize
	triggerProps?: Ariakit.SelectProps
	customFooter?: React.ReactNode
	onEditCustomColumn?: (idx: number) => void
	onDeleteCustomColumn?: (idx: number) => void
	portal?: boolean
	onValuesChange?: (values: string[], label: string) => void
	defaultSelectedValues?: string[]
	resetPageOnQueryChange?: boolean
	pushQueryUpdates?: (updates: Record<string, string | string[] | undefined>) => void
	unmountOnHide?: boolean
	popoverClassName?: string
	popoverWrapperClassName?: string
	searchPlaceholder?: string
	visibleOptionLimit?: number | null
	selectAllScope?: 'all' | 'matches'
	emptyLabel?: React.ReactNode
	popoverVariant?: 'default' | 'legacy'
}

interface ISelectWithComboboxUrlParams extends ISelectWithComboboxBase {
	includeQueryKey: string
	excludeQueryKey: ExcludeQueryKey
	defaultSelectedValues?: string[]
	setSelectedValues?: never
}

interface ISelectWithComboboxState extends ISelectWithComboboxBase {
	includeQueryKey?: never
	excludeQueryKey?: never
	setSelectedValues: (values: Array<string>) => void
}

type ISelectWithCombobox = ISelectWithComboboxUrlParams | ISelectWithComboboxState

export function SelectWithCombobox({
	allValues,
	selectedValues,
	setSelectedValues: setSelectedValuesProp,
	label,
	singleSelect = false,
	nestedMenu,
	labelType,
	variant = 'default',
	size = 'sm',
	triggerProps,
	customFooter,
	onEditCustomColumn,
	onDeleteCustomColumn,
	portal,
	includeQueryKey,
	excludeQueryKey,
	resetPageOnQueryChange,
	pushQueryUpdates,
	onValuesChange,
	defaultSelectedValues,
	unmountOnHide = true,
	popoverClassName,
	popoverWrapperClassName,
	searchPlaceholder = 'Search...',
	visibleOptionLimit = 20,
	selectAllScope = 'all',
	emptyLabel = 'No results found',
	popoverVariant = 'default'
}: ISelectWithCombobox) {
	const router = useRouter()
	const valuesAreAnArrayOfStrings = typeof allValues[0] === 'string'
	const showCheckboxes = Array.isArray(selectedValues) && !singleSelect
	const useLegacyPopover = popoverVariant === 'legacy' || variant === 'pro'
	const actionBarStyles = useLegacyPopover ? excludedSurfaceComboboxActionBarStyles : popoverActionBarStyles
	const nestedActionBarStyles = useLegacyPopover ? excludedSurfaceComboboxActionBarStyles : nestedMenuActionBarStyles
	const actionButtonStyles = useLegacyPopover ? legacyPopoverActionButtonStyles : popoverActionButtonStyles
	const nestedActionButtonStyles = useLegacyPopover ? legacyPopoverActionButtonStyles : nestedMenuActionButtonStyles
	const searchWrapperStyles = useLegacyPopover ? 'relative mb-2 p-3' : popoverSearchBlockStyles
	const nestedSearchWrapperStyles = useLegacyPopover ? 'relative mb-2 p-3' : nestedMenuSearchBlockStyles
	const surfaceStyles = useLegacyPopover ? excludedSurfaceComboboxPopoverSurfaceStyles : popoverSurfaceStyles
	const rowStyles = useLegacyPopover ? legacySelectPopoverRowStyles : popoverRowWithBorderStyles
	const nestedRowStyles = useLegacyPopover ? legacySelectPopoverRowStyles : nestedMenuSelectRowStyles
	const seeMoreStyles = useLegacyPopover ? legacyPopoverSeeMoreStyles : popoverSeeMoreStyles
	const nestedSeeMoreStyles = useLegacyPopover ? legacyPopoverSeeMoreStyles : nestedMenuSeeMoreStyles
	const shouldPortalPopover = portal ?? true

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
		(values: string[]) => {
			if (setSelectedValuesProp) {
				setSelectedValuesProp(values)
			}
		},
		[setSelectedValuesProp]
	)

	// Helper to extract keys from allValues
	const getAllKeys = React.useCallback(() => allValues.map((v) => (typeof v === 'string' ? v : v.key)), [allValues])

	// If includeQueryKey is provided, use URL-based functions; otherwise derive from setSelectedValues
	const setSelectedValues: (values: string[]) => void = includeQueryKey
		? (values: string[]) =>
				updateQueryFromSelected(router, includeQueryKey, excludeQueryKey, getAllKeys(), values, defaultSelectedValues, {
					resetPage: resetPageOnQueryChange,
					pushQueryUpdates
				})
		: setSelectedValuesFromState
	const clearAll = includeQueryKey
		? () =>
				updateQueryFromSelected(router, includeQueryKey, excludeQueryKey, getAllKeys(), 'None', defaultSelectedValues, {
					resetPage: resetPageOnQueryChange,
					pushQueryUpdates
				})
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
					{
						resetPage: resetPageOnQueryChange,
						pushQueryUpdates
					}
				)
		: (value: string) => setSelectedValuesFromState([value])
	const providerValue = singleSelect ? (selectedValues[0] ?? '') : selectedValues
	const normalizeNextValues = React.useCallback(
		(values: string[] | string) => {
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

	React.useEffect(() => {
		if (visibleOptionLimit !== null) {
			setViewableMatches(visibleOptionLimit)
		}
	}, [visibleOptionLimit])

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
					{
						resetPage: resetPageOnQueryChange,
						pushQueryUpdates
					}
				)
			}
		: () => setSelectedValuesFromState(getSelectAllValues())
	const hasOptionLimit = visibleOptionLimit !== null
	const visibleMatches = hasOptionLimit ? matches.slice(0, viewableMatches) : matches
	const selectAllLabel = selectAllScope === 'matches' && searchValue.trim() ? 'Select shown' : 'Select All'

	const comboboxRef = React.useRef<HTMLDivElement>(null)

	const renderCheck = (value: string) => {
		if (useLegacyPopover) {
			return showCheckboxes ? (
				<Ariakit.SelectItemCheck className={legacyPopoverSelectCheckStyles} />
			) : (
				<Ariakit.SelectItemCheck className="ml-auto" />
			)
		}

		const selected = selectedValues.includes(value)
		return showCheckboxes ? (
			<span className={popoverMultiSelectCheckStyles(selected)} aria-hidden>
				{selected ? <SelectCheckIcon /> : null}
			</span>
		) : (
			<span className={popoverSingleSelectCheckStyles(selected)} aria-hidden>
				{selected ? <SelectCheckIcon /> : null}
			</span>
		)
	}

	const handleSeeMore = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		const previousCount = viewableMatches
		setViewableMatches((prev) => prev + 20)

		// Focus on the first newly loaded item after a brief delay
		setTimeout(() => {
			const items = comboboxRef.current?.querySelectorAll('[role="option"]')
			if (items && items.length > previousCount) {
				const firstNewItem = items.item(previousCount)
				if (firstNewItem instanceof HTMLElement) {
					firstNewItem.focus()
				}
			}
		}, 0)
	}

	if (nestedMenu) {
		return (
			<Ariakit.ComboboxProvider
				resetValueOnHide
				setValue={(value) => {
					React.startTransition(() => {
						setSearchValue(value)
					})
				}}
			>
				<Ariakit.SelectProvider
					value={providerValue}
					setValue={(values) => {
						const nextValues = normalizeNextValues(values)
						setSelectedValues(nextValues)
						onValuesChange?.(nextValues, label)
					}}
				>
					<NestedMenu
						label={label}
						render={<button type="button" />}
						popoverVariant={useLegacyPopover ? 'legacy' : popoverVariant}
					>
						<span className={nestedSearchWrapperStyles}>
							<Ariakit.Combobox placeholder={searchPlaceholder} className={`w-full ${inputStyles}`} />
						</span>
						{showCheckboxes ? (
							<span className={nestedActionBarStyles}>
								<button type="button" onClick={clearAll} className={nestedActionButtonStyles}>
									Deselect All
								</button>
								<button type="button" onClick={toggleAll} className={nestedActionButtonStyles}>
									{selectAllLabel}
								</button>
							</span>
						) : null}
						<Ariakit.ComboboxList>
							{visibleMatches.map((option) => (
								<NestedMenuItem
									key={getOptionKey(option)}
									render={<Ariakit.SelectItem value={getOptionKey(option)} />}
									hideOnClick={false}
									className={nestedRowStyles}
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
									{renderCheck(getOptionKey(option))}
								</NestedMenuItem>
							))}
							{hasOptionLimit && matches.length > viewableMatches ? (
								<Ariakit.SelectItem
									value="__see_more__"
									setValueOnClick={false}
									hideOnClick={false}
									className={nestedSeeMoreStyles}
									onClick={(e) => {
										e.preventDefault()
										e.stopPropagation()
										setViewableMatches((prev) => prev + 20)
									}}
								>
									See more...
								</Ariakit.SelectItem>
							) : null}
						</Ariakit.ComboboxList>
					</NestedMenu>
				</Ariakit.SelectProvider>
			</Ariakit.ComboboxProvider>
		)
	}

	return (
		<Ariakit.ComboboxProvider
			resetValueOnHide
			setValue={(value) => {
				React.startTransition(() => {
					setSearchValue(value)
				})
			}}
		>
			<Ariakit.SelectProvider
				value={providerValue}
				setValue={(values) => {
					const nextValues = normalizeNextValues(values)
					setSelectedValues(nextValues)
					onValuesChange?.(nextValues, label)
				}}
			>
				<Ariakit.Select
					className={selectTriggerStyles(variant, size)}
					aria-label={`${label} dropdown`}
					{...triggerProps}
				>
					{labelType === 'smol' ? (
						<span className="flex items-center gap-1">
							<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 label-xs leading-none">
								{selectedValues.length}
							</span>
							<span>{label}</span>
						</span>
					) : labelType === 'regular' && selectedValues.length > 0 ? (
						<>
							<span>{label}: </span>
							<span className="text-link">
								{singleSelect
									? selectedValues[0]
									: selectedValues.length > 2
										? `${selectedValues[0]} + ${selectedValues.length - 1} others`
										: selectedValues.join(', ')}
							</span>
						</>
					) : (
						<span>{label}</span>
					)}
					<Ariakit.SelectArrow className="text-tertiary" />
				</Ariakit.Select>
				<Ariakit.SelectPopover
					unmountOnHide={unmountOnHide}
					hideOnInteractOutside
					gutter={6}
					wrapperProps={{
						className: clsx(popoverMobileWrapperClassName, popoverWrapperClassName)
					}}
					className={clsx(surfaceStyles, popoverClassName)}
					portal={shouldPortalPopover}
				>
					<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
						<Icon name="x" className="size-5" />
					</Ariakit.PopoverDismiss>

					<span className={searchWrapperStyles}>
						<Ariakit.Combobox placeholder={searchPlaceholder} className={`w-full ${inputStyles}`} />
					</span>
					{matches.length > 0 ? (
						<>
							{showCheckboxes ? (
								<span className={actionBarStyles}>
									<button type="button" onClick={clearAll} className={actionButtonStyles}>
										Deselect All
									</button>
									<button type="button" onClick={toggleAll} className={actionButtonStyles}>
										{selectAllLabel}
									</button>
								</span>
							) : null}
							<Ariakit.ComboboxList ref={comboboxRef}>
								{visibleMatches.map((option) => {
									const isCustom = typeof option === 'object' && option.isCustom
									const customIndex = typeof option === 'object' ? option.customIndex : undefined
									return (
										<Ariakit.SelectItem
											key={`${label}-${getOptionKey(option)}`}
											value={getOptionKey(option)}
											className={`${rowStyles} group gap-2`}
											render={<Ariakit.ComboboxItem />}
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
									)
								})}

								{hasOptionLimit && matches.length > viewableMatches ? (
									<Ariakit.SelectItem
										value="__see_more__"
										setValueOnClick={false}
										hideOnClick={false}
										className={seeMoreStyles}
										onClick={handleSeeMore}
										render={<Ariakit.ComboboxItem />}
									>
										See more...
									</Ariakit.SelectItem>
								) : null}
							</Ariakit.ComboboxList>
							{customFooter ? <>{customFooter}</> : null}
						</>
					) : (
						<p
							role="status"
							aria-live="polite"
							className={`px-3 py-6 text-center body-sm ${useLegacyPopover ? 'text-primary' : 'text-tertiary'}`}
						>
							{emptyLabel}
						</p>
					)}
				</Ariakit.SelectPopover>
			</Ariakit.SelectProvider>
		</Ariakit.ComboboxProvider>
	)
}
