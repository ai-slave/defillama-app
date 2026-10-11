import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, useMemo, useRef, useState } from 'react'
import { NoResults } from '~/ui/NoResults'
import { ComboboxSurface, PopoverRow } from '~/ui/PopoverSurface'
import { SearchField } from '~/ui/SearchField'
import { BusyGlyph } from '~/ui/Status'
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

	const handleSeeMore = (e: React.MouseEvent) => {
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
				<SearchField combobox label="Search investors" placeholder="Search investors…" autoSelect />

				<ComboboxSurface variant="search-results" sameWidth maxHeight="lg">
					{matches.length > 0 ? (
						<Ariakit.ComboboxList ref={comboboxRef}>
							{matches.slice(0, viewableMatches).map((option: string) => (
								<Row key={option} name={option} setOpen={setOpen} />
							))}
							{matches.length > viewableMatches ? (
								<PopoverRow
									variant="action"
									render={<Ariakit.ComboboxItem value="__see_more__" setValueOnClick={false} hideOnClick={false} />}
									onClick={handleSeeMore}
								>
									See more…
								</PopoverRow>
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

function Row({ name, setOpen }: { name: string; setOpen: (open: boolean) => void }) {
	const [loading, setLoading] = useState(false)
	const router = useRouter()

	return (
		<PopoverRow
			render={<Ariakit.ComboboxItem value={name} focusOnHover hideOnClick={false} setValueOnClick={false} />}
			onClick={(_e) => {
				setLoading(true)

				void router.push(`/raises/${slug(name.toLowerCase())}`).then(() => {
					setLoading(false)
					setOpen(false)
				})
			}}
			disabled={loading}
		>
			<span>{name}</span>
			{loading ? <BusyGlyph decorative size={12} /> : null}
		</PopoverRow>
	)
}
