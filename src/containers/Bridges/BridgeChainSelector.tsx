import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import * as React from 'react'
import type { ISearchItem } from '~/components/Search/types'
import { selectTriggerStyles } from '~/components/Select/types'
import { inputStyles } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import {
	popoverRowWithBorderStyles,
	popoverSearchBlockWithBottomPaddingStyles,
	popoverSeeMoreStyles
} from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'

interface IProps {
	options: Array<ISearchItem>
	currentChain: string
	handleClick: React.Dispatch<any>
}

export function BridgeChainSelector({ options, currentChain, handleClick }: IProps) {
	const [searchValue, setSearchValue] = React.useState('')
	const matches = React.useMemo(() => {
		if (!searchValue) return options
		return matchSorter(options, searchValue, {
			keys: ['name'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [options, searchValue])

	const [viewableMatches, setViewableMatches] = React.useState(20)

	const comboboxRef = React.useRef<HTMLDivElement>(null)

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
		<Ariakit.ComboboxProvider
			resetValueOnHide
			setInputValue={(value) => {
				React.startTransition(() => {
					setSearchValue(value)
				})
			}}
			selectedValue={currentChain}
			setSelectedValue={handleClick}
		>
			<Ariakit.ComboboxSelect className={selectTriggerStyles('filter', 'md')}>
				{currentChain}
				<Ariakit.ComboboxSelectArrow className="ml-auto" />
			</Ariakit.ComboboxSelect>
			<ComboboxSurface variant="list">
				<span className={popoverSearchBlockWithBottomPaddingStyles}>
					<Ariakit.ComboboxInput placeholder="Search..." className={`${inputStyles} w-full`} />
				</span>

				{matches.length > 0 ? (
					<Ariakit.ComboboxList ref={comboboxRef}>
						{matches.slice(0, viewableMatches).map((option) => (
							<Ariakit.ComboboxItem
								key={`bridge-chain-${option.name}`}
								value={option.name}
								className={`${popoverRowWithBorderStyles} group justify-start gap-4`}
							>
								<span>{option.name}</span>
							</Ariakit.ComboboxItem>
						))}
						{matches.length > viewableMatches ? (
							<Ariakit.ComboboxItem
								value="__see_more__"
								selectValueOnClick={false}
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
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
