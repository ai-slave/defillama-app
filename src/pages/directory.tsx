import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { startTransition, useMemo, useRef, useState } from 'react'
import { Announcement } from '~/components/Announcement'
import { Icon } from '~/components/Icon'
import { TokenLogo } from '~/components/TokenLogo'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { basicProtocolPropertiesToKeepV1List } from '~/containers/ProtocolLists/utils.old'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { inputStyles } from '~/ui/Input'
import { popoverMenuItemStyles, popoverSearchResultsSurfaceStyles, popoverSeeMoreStyles } from '~/ui/Popover'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('directory', async () => {
	const { protocols } = await fetchProtocols().then(basicProtocolPropertiesToKeepV1List(['name', 'logo', 'url']))
	return {
		props: {
			protocols: protocols
				.map((protocol) => ({
					name: protocol.name,
					logo: protocol.logo,
					route: protocol.url
				}))
				.filter((p) => !!(p.name && p.route))
		},
		revalidate: maxAgeForNext([22])
	}
})

const RECENTS_KEY = 'recent_protocols'

const saveRecent = (protocol: { name: string; logo?: string; route: string }) => {
	try {
		const existingRaw = typeof window !== 'undefined' ? window.localStorage.getItem(RECENTS_KEY) : null
		let arr: Array<{ name: string; logo?: string; route: string; count: number; lastVisited: number }> = existingRaw
			? JSON.parse(existingRaw)
			: []

		const now = Date.now()
		const idx = arr.findIndex((x) => x.route === protocol.route)
		if (idx >= 0) {
			arr[idx].count = (arr[idx].count || 0) + 1
			arr[idx].lastVisited = now
		} else {
			arr.push({ ...protocol, count: 1, lastVisited: now })
		}

		arr = arr
			.sort((a, b) => {
				if (b.count !== a.count) return b.count - a.count
				return b.lastVisited - a.lastVisited
			})
			.slice(0, 6)

		setStorageItem(RECENTS_KEY, JSON.stringify(arr))
	} catch (e) {
		console.log('failed to save recent protocol', e)
	}
}

export default function Protocols({ protocols }: { protocols: Array<{ name: string; logo: string; route: string }> }) {
	const [searchValue, setSearchValue] = useState('')
	const matches = useMemo(() => {
		if (!searchValue) return protocols
		return matchSorter(protocols, searchValue, {
			keys: ['name'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [protocols, searchValue])

	const [viewableMatches, setViewableMatches] = useState(20)

	const comboboxRef = useRef<HTMLDivElement>(null)

	const recentProtocolsInStorage = useStorageItem(RECENTS_KEY, '[]')

	const recentProtocols: Array<{ name: string; logo?: string; route: string; count: number; lastVisited: number }> =
		useMemo(() => {
			return JSON.parse(recentProtocolsInStorage)
				.map((protocol) => ({
					name: protocol.name,
					logo: protocol.logo,
					route: protocol.route,
					count: protocol.count ?? 1,
					lastVisited:
						typeof protocol.lastVisited === 'number' && Number.isFinite(protocol.lastVisited) ? protocol.lastVisited : 0
				}))
				.sort((a, b) => {
					if (b.count !== a.count) return b.count - a.count
					return b.lastVisited - a.lastVisited
				})
				.slice(0, 6)
		}, [recentProtocolsInStorage])

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
		<Layout
			title="DeFi Protocols Directory - Official Links - DefiLlama"
			description="Browse the official websites and links for 7000+ DeFi protocols on DefiLlama."
			canonicalUrl={`/directory`}
		>
			<Announcement notCancellable>
				Search any protocol to go straight into their website, avoiding scam results from Google. Bookmark this page for
				better access and security
			</Announcement>
			<Ariakit.ComboboxProvider
				setValue={(value) => {
					startTransition(() => {
						setSearchValue(value)
					})
				}}
			>
				{recentProtocols && recentProtocols.length > 0 ? (
					<div className="mx-auto mt-6 w-full max-w-3xl">
						<div className="mb-2 text-xs font-medium text-secondary">Recently visited</div>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{recentProtocols.map((protocol) => (
								<Card
									as="button"
									type="button"
									key={protocol.route}
									onClick={() => {
										if (typeof document !== 'undefined') {
											window.open(protocol.route, '_blank')
										}
										saveRecent(protocol)
									}}
									padding="sm"
									className="hover-wash-card flex cursor-pointer items-center gap-2 text-left"
								>
									{protocol.logo ? (
										<TokenLogo src={protocol.logo} alt={`Logo of ${protocol.name}`} />
									) : (
										<div className="size-6 rounded bg-(--bg-secondary)" />
									)}
									<span className="truncate label-sm">{protocol.name}</span>
								</Card>
							))}
						</div>
					</div>
				) : null}

				<span className="relative mx-auto my-8 w-full max-w-3xl">
					<Ariakit.Combobox
						placeholder="Search..."
						autoSelect
						className={`${inputStyles} w-full rounded-b-none pl-9`}
					/>
					<Icon name="search" height={18} width={18} className="absolute top-0 bottom-0 left-3 my-auto text-tertiary" />
				</span>
				<Ariakit.ComboboxPopover
					sameWidth
					open={true}
					className={`${popoverSearchResultsSurfaceStyles} top-1 h-full max-h-[320px]`}
				>
					{matches.length ? (
						<Ariakit.ComboboxList ref={comboboxRef}>
							{matches.slice(0, viewableMatches).map((option) => (
								<Ariakit.ComboboxItem
									key={option.name}
									value={option.name}
									onClick={() => {
										if (typeof document !== 'undefined') {
											window.open(option.route, '_blank')
										}
										saveRecent(option)
									}}
									focusOnHover
									hideOnClick={false}
									setValueOnClick={false}
									className={`${popoverMenuItemStyles} gap-4 aria-disabled:bg-hover-row aria-disabled:opacity-50 aria-selected:bg-hover-row`}
								>
									{option.logo ? <TokenLogo src={option.logo} alt={`Logo of ${option.name}`} /> : null}
									<span>{option.name}</span>
								</Ariakit.ComboboxItem>
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
						<p className="px-3 py-6 text-center body-sm text-tertiary">No results found</p>
					)}
				</Ariakit.ComboboxPopover>
			</Ariakit.ComboboxProvider>
		</Layout>
	)
}
