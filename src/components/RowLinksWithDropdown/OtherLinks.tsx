import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, useDeferredValue, useMemo, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import { PopoverHeader } from '~/ui/PopoverHeader'
import { MenuItem, MenuSurface, PopoverList, PopoverRow } from '~/ui/PopoverSurface'
import { BusyGlyph } from '~/ui/Status'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'

interface IProps {
	options: Array<{ label: string; to: string }>
	/** Names the drawer; `name` is the trigger label, which can be the active link. */
	heading: string
	name: string
	keyPrefix?: string
	isActive: boolean
	/** sm beside the 24px link pills; md as the full-width phone trigger. */
	size: 'sm' | 'md'
	/** Layout placement only. */
	className?: string
}

export function OtherLinks({ options, heading, name, keyPrefix = 'row-links', isActive, size, className }: IProps) {
	const [searchValue, setSearchValue] = useState('')
	const matches = useMemo(() => {
		if (!searchValue) return options
		return matchSorter(options, searchValue, {
			keys: ['label'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [options, searchValue])

	const [viewableMatches, setViewableMatches] = useState(20)
	const [open, setOpen] = useState(false)
	// Kept mounted, so its rows are built in a background render after hydration, or at once on an earlier tap.
	const rowsReady = useDeferredValue(true, false) || open
	const comboboxRef = useRef<HTMLDivElement>(null)

	const handleSeeMore = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		const previousCount = viewableMatches
		setViewableMatches((prev) => prev + 20)
		focusFirstNewItem(comboboxRef, '[role="menuitem"]', previousCount)
	}

	return (
		<Ariakit.ComboboxProvider
			resetValueOnHide
			setInputValue={(value) => {
				startTransition(() => {
					setSearchValue(value)
				})
			}}
		>
			<Ariakit.MenuProvider open={open} setOpen={setOpen}>
				<Ariakit.MenuButton
					render={
						<Button variant="toggle" size={size} data-active={isActive} className={`my-auto ${className ?? ''}`} />
					}
				>
					<span>{name}</span>
					<Icon name="chevron-down" className="size-3.5 shrink-0 text-tertiary" />
				</Ariakit.MenuButton>

				{/* Stays mounted: header menu that must open instantly on phones (#2640). */}
				<MenuSurface variant="panel" heading={heading} unmountOnHide={false} gutter={6}>
					{rowsReady ? (
						<>
							<PopoverHeader
								search={<Ariakit.Combobox placeholder="Search…" render={<Input className="w-full" />} />}
							/>
							{matches.length > 0 ? (
								<PopoverList divided render={<Ariakit.ComboboxList ref={comboboxRef} />}>
									{matches.slice(0, viewableMatches).map((value) => (
										<Item label={value.label} to={value.to} key={`${keyPrefix}:${value.label}:${value.to}`} />
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
								</PopoverList>
							) : (
								<NoResults />
							)}
						</>
					) : null}
				</MenuSurface>
			</Ariakit.MenuProvider>
		</Ariakit.ComboboxProvider>
	)
}

function Item({ label, to }: { label: string; to: string }) {
	const [loading, setLoading] = useState(false)
	const router = useRouter()
	return (
		<MenuItem
			onClick={(e) => {
				if (e.ctrlKey || e.metaKey) {
					window.open(to)
				} else {
					setLoading(true)
					void router.push(to).then(() => {
						setLoading(false)
					})
					// window.open(to, '_self')
				}
			}}
			render={<Ariakit.ComboboxItem value={label} setValueOnClick={false} />}
		>
			<span>{label}</span>
			{loading ? <BusyGlyph decorative size={12} /> : null}
		</MenuItem>
	)
}
