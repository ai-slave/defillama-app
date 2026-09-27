import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, useMemo, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuSurface } from '~/ui/MenuSurface'
import { NoResults } from '~/ui/NoResults'
import { popoverRowWithBorderStyles, popoverSearchBlockStyles, popoverSeeMoreStyles } from '~/ui/Popover'
import { focusFirstNewItem } from '~/utils/focusFirstNewItem'

interface IProps {
	options: Array<{ label: string; to: string }>
	name: string
	keyPrefix?: string
	isActive: boolean
	className?: string
}

export function OtherLinks({ options, name, keyPrefix = 'row-links', isActive, className }: IProps) {
	const [searchValue, setSearchValue] = useState('')
	const matches = useMemo(() => {
		if (!searchValue) return options
		return matchSorter(options, searchValue, {
			keys: ['label'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [options, searchValue])

	const [viewableMatches, setViewableMatches] = useState(20)
	const comboboxRef = useRef<HTMLDivElement>(null)

	const handleSeeMore = (e: React.MouseEvent<HTMLDivElement>) => {
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
			<Ariakit.MenuProvider>
				<Ariakit.MenuButton
					data-active={isActive}
					className={`my-auto flex items-center gap-0.5 rounded-md border border-medium bg-surface-elevated-1 py-1 pr-1 pl-2 body-sm whitespace-nowrap text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2 ${
						className ?? ''
					}`}
				>
					<span>{name}</span>
					<Icon name="chevron-down" className="size-3 shrink-0 text-tertiary" />
				</Ariakit.MenuButton>

				{/* Stays mounted: header menu that must open instantly on phones (#2640). */}
				<MenuSurface variant="panel" unmountOnHide={false} gutter={6}>
					<span className={popoverSearchBlockStyles}>
						<Ariakit.Combobox placeholder="Search..." className={`w-full ${inputStyles}`} />
					</span>
					{matches.length > 0 ? (
						<Ariakit.ComboboxList ref={comboboxRef}>
							{matches.slice(0, viewableMatches).map((value) => (
								<Item label={value.label} to={value.to} key={`${keyPrefix}:${value.label}:${value.to}`} />
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
						<NoResults />
					)}
				</MenuSurface>
			</Ariakit.MenuProvider>
		</Ariakit.ComboboxProvider>
	)
}

function Item({ label, to }: { label: string; to: string }) {
	const [loading, setLoading] = useState(false)
	const router = useRouter()
	return (
		<Ariakit.MenuItem
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
			className={`${popoverRowWithBorderStyles} group justify-start gap-4`}
		>
			<span>{label}</span>
			{loading ? <LoadingSpinner size={12} /> : null}
		</Ariakit.MenuItem>
	)
}
