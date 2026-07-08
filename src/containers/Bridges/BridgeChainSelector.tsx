import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import * as React from 'react'
import { Icon } from '~/components/Icon'
import type { ISearchItem } from '~/components/Search/types'
import { selectTriggerStyles } from '~/components/Select/types'
import { inputStyles } from '~/ui/Input'
import {
	popoverRowWithBorderStyles,
	popoverSearchBlockWithBottomPaddingStyles,
	popoverSeeMoreStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'

interface IProps {
	options: ISearchItem[]
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
			setValue={(value) => {
				React.startTransition(() => {
					setSearchValue(value)
				})
			}}
		>
			<Ariakit.SelectProvider
				value={currentChain}
				setValue={(values) => {
					handleClick(values)
				}}
			>
				<Ariakit.Select className={selectTriggerStyles('filter', 'md')}>
					{currentChain}
					<Ariakit.SelectArrow className="ml-auto" />
				</Ariakit.Select>
				<Ariakit.SelectPopover
					unmountOnHide
					hideOnInteractOutside
					gutter={6}
					wrapperProps={{ className: popoverMobileWrapperClassName }}
					className={popoverSurfaceStyles}
				>
					<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
						<Icon name="x" className="size-5" />
					</Ariakit.PopoverDismiss>

					<span className={popoverSearchBlockWithBottomPaddingStyles}>
						<Ariakit.Combobox placeholder="Search..." className={`${inputStyles} w-full`} />
					</span>

					{matches.length > 0 ? (
						<>
							<Ariakit.ComboboxList ref={comboboxRef}>
								{matches.slice(0, viewableMatches).map((option) => (
									<Ariakit.SelectItem
										key={`bridge-chain-${option.name}`}
										value={option.name}
										className={`${popoverRowWithBorderStyles} group justify-start gap-4`}
										render={<Ariakit.ComboboxItem />}
									>
										<span>{option.name}</span>
									</Ariakit.SelectItem>
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
						</>
					) : (
						<p className="px-3 py-6 text-center body-sm text-primary">No results found</p>
					)}
				</Ariakit.SelectPopover>
			</Ariakit.SelectProvider>
		</Ariakit.ComboboxProvider>
	)
}
