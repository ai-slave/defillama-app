import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { startTransition, useMemo, useRef, useState } from 'react'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'
import { Button } from './Button'
import { focusNeighborOnLeave } from './focus'
import { Icon } from './Icon'
import { Check } from './internal/Check'
import { popoverRowWithBorderStyles, popoverSeeMoreStyles } from './internal/Popover'
import { Logo } from './Logo'
import { ListLoading } from './NoResults'
import { ComboboxSurface } from './PopoverSurface'

/* MultiSelectCombobox — a search with its input on the page and the picks as removable chips in front of it; the
   results open in the `search-results` surface under the whole control. Removing a chip hands focus to its neighbor,
   else to the input. */

export type MultiSelectOption = {
	value: string
	label: string
	selectedLabel?: string
	disabled?: boolean
	/** Image URL, drawn round on the option's row. */
	logo?: string
	isChild?: boolean
}

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
	/** Accessible name of the search field and its results. */
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
				className="relative flex w-full flex-1 flex-wrap items-center gap-1 rounded-lg border border-medium bg-page bg-clip-padding focus-within:border-brand not-focus-within:hover:border-strong"
			>
				{selectedValues.length > 0 ? (
					<div className="flex flex-wrap items-center gap-1 pl-1">
						{selectedValues.map((value) => (
							<Button
								variant="filter"
								size="sm"
								data-active
								key={`multiselectcombobox-selected-${value}`}
								aria-label={`Remove ${labelsByValue.get(value) ?? value}`}
								data-row
								ref={focusNeighborOnLeave(() => anchorRef.current?.querySelector('input'))}
								onClick={() => setSelectedValues(selectedValues.filter((v) => v !== value))}
							>
								<span>{labelsByValue.get(value) ?? value}</span>
								<Icon name="x" className="size-3.5" />
							</Button>
						))}
					</div>
				) : null}
				<Ariakit.Combobox
					aria-label={heading}
					placeholder={placeholder}
					className="min-h-8 w-full flex-1 bg-transparent px-3 py-1.5 pr-8 body-lg text-primary outline-hidden placeholder:text-tertiary max-sm:placeholder:text-sm/6 sm:body-sm"
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
				maxHeight="lg"
			>
				<Ariakit.ComboboxList ref={comboboxRef}>
					{isLoading ? <ListLoading label="Loading options" /> : null}
					{matches.slice(0, viewableMatches).map((item) => (
						<Ariakit.ComboboxItem
							key={`multi-select-${item.value}`}
							value={item.value}
							hideOnClick
							className={`${popoverRowWithBorderStyles} group justify-start gap-2`}
						>
							{item.logo ? <Logo src={item.logo} size={20} /> : null}
							<span>{item.label}</span>
							<Ariakit.ComboboxItemSelected>
								{(selected) => <Check kind="box" checked={selected} className="ml-auto" />}
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
							See more…
						</Ariakit.ComboboxItem>
					) : null}
				</Ariakit.ComboboxList>
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
