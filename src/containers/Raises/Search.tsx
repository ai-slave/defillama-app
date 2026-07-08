import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, useMemo, useRef, useState } from 'react'
import { Icon } from '~/components/Icon'
import { LoadingSpinner } from '~/components/Loaders'
import { searchFieldInputStyles } from '~/ui/Input'
import {
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName,
	popoverMenuItemStyles,
	popoverSeeMoreStyles,
	popoverSurfaceStyles
} from '~/ui/Popover'
import { slug } from '~/utils'

export function RaisesSearch({ list }: { list?: string[] }) {
	const [searchValue, setSearchValue] = useState('')
	const matches = useMemo(() => {
		if (!searchValue) return list || []
		return matchSorter(list || [], searchValue, {
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [list, searchValue])

	const [viewableMatches, setViewableMatches] = useState(20)

	const [open, setOpen] = useState(false)

	const comboboxRef = useRef<HTMLDivElement>(null)

	const handleSeeMore = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		const previousCount = viewableMatches
		setViewableMatches((prev) => prev + 20)

		// Focus on the first newly loaded item after a brief delay
		setTimeout(() => {
			const items = comboboxRef.current?.querySelectorAll('[role="option"]')
			if (items && items.length > previousCount) {
				const firstNewItem = items[previousCount] as HTMLElement
				firstNewItem?.focus()
			}
		}, 0)
	}

	return (
		<div className="relative hidden flex-col rounded-md data-[alwaysdisplay=true]:flex lg:flex">
			<Ariakit.ComboboxProvider
				resetValueOnHide
				setValue={(value) => {
					startTransition(() => {
						setSearchValue(value)
					})
				}}
				open={open}
				setOpen={setOpen}
			>
				<Input placeholder="Search Investors..." open={open} setOpen={setOpen} />

				<Ariakit.ComboboxPopover
					unmountOnHide
					hideOnInteractOutside
					gutter={6}
					wrapperProps={{
						className: `${popoverMobileWrapperClassName} w-full!`
					}}
					className={`${popoverSurfaceStyles} thin-scrollbar max-h-(--popover-available-height)`}
				>
					<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
						<Icon name="x" className="size-5" />
					</Ariakit.PopoverDismiss>
					{matches.length ? (
						<Ariakit.ComboboxList ref={comboboxRef}>
							{matches.slice(0, viewableMatches).map((option: string) => (
								<Row key={option} name={option} setOpen={setOpen} />
							))}
							{matches.length > viewableMatches ? (
								<Ariakit.ComboboxItem
									value="__see_more__"
									setValueOnClick={false}
									hideOnClick={false}
									className={popoverSeeMoreStyles}
									onClick={handleSeeMore}
								>
									See more...
								</Ariakit.ComboboxItem>
							) : null}
						</Ariakit.ComboboxList>
					) : (
						<p className="px-3 py-6 text-center body-sm text-primary">No results found</p>
					)}
				</Ariakit.ComboboxPopover>
			</Ariakit.ComboboxProvider>
		</div>
	)
}

interface IInputProps {
	open: boolean
	setOpen?: React.Dispatch<React.SetStateAction<boolean>>
	placeholder: string
	autoFocus?: boolean
	withValue?: boolean
	hideIcon?: boolean
	onSearchTermChange?: (value: string) => void
}

function Input({ open, setOpen, placeholder, hideIcon, onSearchTermChange }: IInputProps) {
	const inputField = useRef<HTMLInputElement>(null)

	return (
		<>
			{!hideIcon ? (
				<button
					type="button"
					onClick={() => setOpen?.((prev) => !prev)}
					className="absolute top-0 bottom-0 left-3 my-auto text-tertiary hover:text-primary focus-visible:text-primary"
				>
					{open ? (
						<>
							<span className="sr-only">Close Search</span>
							<Icon name="x" height={16} width={16} />
						</>
					) : (
						<>
							<span className="sr-only">Open Search</span>
							<Icon name="search" height={16} width={16} />
						</>
					)}
				</button>
			) : null}

			<Ariakit.Combobox
				placeholder={placeholder}
				autoSelect
				ref={inputField}
				onChange={(e) => {
					onSearchTermChange?.(e.target.value)
				}}
				className={searchFieldInputStyles}
			/>
		</>
	)
}

const Row = ({ name, setOpen }: { name: string; setOpen: (open: boolean) => void }) => {
	const [loading, setLoading] = useState(false)
	const router = useRouter()

	return (
		<Ariakit.ComboboxItem
			value={name}
			onClick={(_e) => {
				setLoading(true)

				void router.push(`/raises/${slug(name.toLowerCase())}`).then(() => {
					setLoading(false)
					setOpen(false)
				})
			}}
			focusOnHover
			hideOnClick={false}
			setValueOnClick={false}
			disabled={loading}
			className={`${popoverMenuItemStyles} aria-disabled:opacity-50`}
		>
			<span>{name}</span>
			{loading ? <LoadingSpinner size={12} /> : null}
		</Ariakit.ComboboxItem>
	)
}
