import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { startTransition, useMemo, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { popoverMultiSelectCheckStyles, popoverRowWithBorderStyles, popoverSeeMoreStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { LoadingIndicator } from '~/ui/Status'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'
import { SelectCheckIcon } from './SelectCheckIcon'
import type { MultiSelectOption } from './types'

const DEFAULT_VIEWABLE_MATCHES = 10

export function MultiSelectCombobox({
	data,
	heading,
	placeholder,
	selectedValues,
	setSelectedValues,
	filterOptions = true,
	onSearchChange,
	isLoading = false,
	emptyMessage = 'No options found'
}: {
	data: ReadonlyArray<MultiSelectOption>
	/** Accessible name of the search results. */
	heading: string
	placeholder: string
	selectedValues: Array<string>
	setSelectedValues: (values: Array<string>) => void
	filterOptions?: boolean
	onSearchChange?: (value: string) => void
	isLoading?: boolean
	emptyMessage?: string
}) {
	const [searchValue, setSearchValue] = useState('')

	const matches = useMemo(() => {
		if (!filterOptions || !searchValue) return data

		return matchSorter(data, searchValue, {
			keys: ['label'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [data, filterOptions, searchValue])
	const labelsByValue = useMemo(
		() => new Map(data.map((option) => [option.value, option.selectedLabel ?? option.label])),
		[data]
	)

	const [viewableMatches, setViewableMatches] = useState(DEFAULT_VIEWABLE_MATCHES)

	const [open, setOpen] = useState(false)

	const comboboxRef = useRef<HTMLDivElement>(null)
	const anchorRef = useRef<HTMLSpanElement>(null)

	// Closing by any route (selection, Escape, outside click) clears the search, so the next open starts
	// from the full list.
	const setOpenAndResetSearch = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) {
			setSearchValue('')
			onSearchChange?.('')
			setViewableMatches(DEFAULT_VIEWABLE_MATCHES)
		}
	}

	const updateSearch = (value: string) => {
		startTransition(() => {
			setSearchValue(value)
			onSearchChange?.(value)
		})
	}

	const handleSeeMore = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		const previousCount = viewableMatches
		setViewableMatches((prev) => prev + 20)
		focusFirstNewItem(comboboxRef, '[role="option"]', previousCount)
	}

	return (
		<Ariakit.ComboboxProvider
			resetValueOnHide
			selectedValue={selectedValues}
			setSelectedValue={setSelectedValues}
			setInputValue={updateSearch}
			open={open}
			setOpen={setOpenAndResetSearch}
		>
			<span
				ref={anchorRef}
				className="relative flex w-full flex-1 flex-wrap items-center gap-1 rounded-lg border border-medium bg-page focus-within:border-brand"
			>
				{selectedValues.length > 0 ? (
					<div className="flex flex-wrap items-center gap-1 pl-1">
						{selectedValues.map((value) => (
							<button
								type="button"
								key={`mutliselectcombobox-selected-${value}`}
								className="hover-wash flex items-center gap-1 rounded-md border border-brand bg-brand-muted p-1.5 label-sm text-link"
								onClick={() => {
									setSelectedValues(selectedValues.filter((v) => v !== value))
								}}
							>
								<span>{labelsByValue.get(value) ?? value}</span>
								<Icon name="x" className="size-3" />
							</button>
						))}
					</div>
				) : null}
				<Ariakit.Combobox
					placeholder={placeholder}
					className="min-h-8 w-full flex-1 bg-transparent px-3 py-1.5 pr-8 text-base text-primary outline-hidden placeholder:text-tertiary sm:body-sm"
				/>
				{open ? (
					<Icon name="x" className="absolute top-0 right-2 bottom-0 my-auto size-4 text-tertiary" />
				) : (
					<Icon name="chevron-down" className="absolute top-0 right-2 bottom-0 my-auto size-4 text-tertiary" />
				)}
			</span>
			<ComboboxSurface
				variant="search-results"
				aria-label={heading}
				// Chips reduce the input width; anchor results to the whole control.
				getAnchorRect={() => anchorRef.current?.getBoundingClientRect() ?? null}
				sameWidth
				className="max-h-[min(400px,var(--popover-available-height))]"
			>
				<Ariakit.ComboboxList ref={comboboxRef}>
					{isLoading ? (
						<p role="status" aria-live="polite" className="flex justify-center px-3 py-6">
							<LoadingIndicator />
						</p>
					) : null}
					{matches.slice(0, viewableMatches).map((item) => (
						<Ariakit.ComboboxItem
							key={`multi-select-${item.value}`}
							value={item.value}
							hideOnClick
							className={`${popoverRowWithBorderStyles} group justify-start gap-2`}
						>
							{item.logo ? <img src={item.logo} alt={item.label} className="size-5 shrink-0 rounded-full" /> : null}
							<span>{item.label}</span>
							<Ariakit.ComboboxItemSelected>
								{(selected) => (
									<span className={popoverMultiSelectCheckStyles(selected)} aria-hidden>
										{selected ? <SelectCheckIcon /> : null}
									</span>
								)}
							</Ariakit.ComboboxItemSelected>
						</Ariakit.ComboboxItem>
					))}
					{!isLoading && matches.length === 0 ? (
						<p className="px-3 py-6 text-center body-sm text-tertiary">{emptyMessage}</p>
					) : null}
					{matches.length > viewableMatches ? (
						<Ariakit.ComboboxItem
							value="__see_more__"
							setValueOnClick={false}
							selectValueOnClick={false}
							hideOnClick={false}
							className={popoverSeeMoreStyles}
							onClick={handleSeeMore}
						>
							See more...
						</Ariakit.ComboboxItem>
					) : null}
				</Ariakit.ComboboxList>
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
