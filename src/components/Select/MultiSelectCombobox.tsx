import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '~/components/Icon'
import { inputStyles } from '~/ui/Input'
import {
	popoverMultiSelectCheckStyles,
	popoverRowWithBorderStyles,
	popoverSearchBlockWithBottomPaddingStyles,
	popoverSeeMoreStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'
import type { MultiSelectOption } from './types'

const DEFAULT_VIEWABLE_MATCHES = 10

export const MultiSelectCombobox = ({
	data,
	placeholder,
	selectedValues,
	setSelectedValues
}: {
	data: ReadonlyArray<MultiSelectOption>
	placeholder: string
	selectedValues: string[]
	setSelectedValues: (values: string[]) => void
}) => {
	const [searchValue, setSearchValue] = useState('')

	const matches = useMemo(() => {
		if (!searchValue) return data

		return matchSorter(data, searchValue, {
			keys: ['label'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [data, searchValue])

	const [viewableMatches, setViewableMatches] = useState(DEFAULT_VIEWABLE_MATCHES)

	const [open, setOpen] = useState(false)

	const comboboxRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) {
			setSearchValue('')
			setViewableMatches(DEFAULT_VIEWABLE_MATCHES)
		}
	}, [open])

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
			setValue={(value) => {
				startTransition(() => {
					setSearchValue(value)
				})
			}}
			open={open}
			setOpen={setOpen}
		>
			<span className="relative flex w-full flex-1 flex-wrap items-center gap-1 rounded-[8px] border border-medium bg-page focus-within:border-brand">
				{selectedValues.length > 0 ? (
					<div className="flex flex-wrap items-center gap-1 pl-1">
						{selectedValues.map((value) => (
							<button
								key={`mutliselectcombobox-selected-${value}`}
								className="flex items-center gap-1 rounded-md border border-brand bg-brand-muted p-1.5 label-sm text-link hover:bg-hover-row"
								onClick={() => {
									setSelectedValues(selectedValues.filter((v) => v !== value))
								}}
							>
								<span>{value}</span>
								<Icon name="x" className="size-3" />
							</button>
						))}
					</div>
				) : null}
				<Ariakit.Combobox
					placeholder={placeholder}
					className="min-h-8 w-full flex-1 bg-transparent px-3 py-1.5 pr-8 text-base text-primary outline-none placeholder:text-tertiary sm:body-sm"
				/>
				{open ? (
					<Icon name="x" className="absolute top-0 right-2 bottom-0 my-auto size-4 text-tertiary" />
				) : (
					<Icon name="chevron-down" className="absolute top-0 right-2 bottom-0 my-auto size-4 text-tertiary" />
				)}
			</span>
			<Ariakit.ComboboxPopover
				unmountOnHide
				hideOnInteractOutside
				preventBodyScroll
				gutter={6}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={`${popoverSurfaceStyles} thin-scrollbar`}
				portal
				sameWidth
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>

				<span className={popoverSearchBlockWithBottomPaddingStyles}>
					<input
						placeholder="Search..."
						className={`${inputStyles} w-full`}
						onInput={(e) => {
							const nextValue = e.currentTarget.value
							startTransition(() => setSearchValue(nextValue))
						}}
					/>
				</span>

				<Ariakit.ComboboxList ref={comboboxRef}>
					{matches.slice(0, viewableMatches).map((item) => (
						<Ariakit.ComboboxItem
							key={`multi-select-${item.value}`}
							value={item.value}
							hideOnClick
							className={`${popoverRowWithBorderStyles} group justify-start gap-2`}
						>
							{item.logo ? <img src={item.logo} alt={item.label} className="size-5 shrink-0 rounded-full" /> : null}
							<span>{item.label}</span>
							<span className={popoverMultiSelectCheckStyles(selectedValues.includes(item.value))} aria-hidden>
								{selectedValues.includes(item.value) ? <Icon name="check" className="size-3" /> : null}
							</span>
						</Ariakit.ComboboxItem>
					))}
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
			</Ariakit.ComboboxPopover>
		</Ariakit.ComboboxProvider>
	)
}
