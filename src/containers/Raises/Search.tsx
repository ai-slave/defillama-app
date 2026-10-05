import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, useMemo, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { searchFieldInputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { NoResults } from '~/ui/NoResults'
import { popoverMenuItemStyles, popoverSeeMoreStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { slug } from '~/utils'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'

export function RaisesSearch({ list }: { list?: Array<string> }) {
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
		setViewableMatches((prev) => prev + 20)
		focusFirstNewItem(comboboxRef, '[role="option"]', viewableMatches)
	}

	return (
		<div className="relative flex flex-col rounded-md">
			<Ariakit.ComboboxProvider
				resetValueOnHide
				setInputValue={(value) => {
					startTransition(() => {
						setSearchValue(value)
					})
				}}
				open={open}
				setOpen={setOpen}
			>
				<Input placeholder="Search investors…" open={open} setOpen={setOpen} />

				<ComboboxSurface
					variant="search-results"
					sameWidth
					className="max-h-[min(400px,var(--popover-available-height))]"
				>
					{matches.length > 0 ? (
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
									See more…
								</Ariakit.ComboboxItem>
							) : null}
						</Ariakit.ComboboxList>
					) : (
						<NoResults />
					)}
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		</div>
	)
}

function Input({
	open,
	setOpen,
	placeholder
}: {
	open: boolean
	setOpen: React.Dispatch<React.SetStateAction<boolean>>
	placeholder: string
}) {
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
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

			<Ariakit.Combobox placeholder={placeholder} autoSelect className={searchFieldInputStyles} />
		</>
	)
}

function Row({ name, setOpen }: { name: string; setOpen: (open: boolean) => void }) {
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
			className={popoverMenuItemStyles}
		>
			<span>{name}</span>
			{loading ? <LoadingSpinner size={12} /> : null}
		</Ariakit.ComboboxItem>
	)
}
