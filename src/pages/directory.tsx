import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { startTransition, useMemo, useRef, useState } from 'react'
import { Announcement } from '~/components/Announcement'
import { TokenLogo } from '~/components/TokenLogo'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import { popoverMenuItemStyles, popoverSeeMoreStyles } from '~/ui/Popover'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('directory', async () => {
	const { protocols } = await fetchProtocols()
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

interface RecentProtocol {
	name: string
	logo?: string
	route: string
	count: number
	lastVisited: number
}

function readRecentProtocol(value: unknown): RecentProtocol | null {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
	const name = Reflect.get(value, 'name')
	const logo = Reflect.get(value, 'logo')
	const route = Reflect.get(value, 'route')
	const count = Reflect.get(value, 'count')
	const lastVisited = Reflect.get(value, 'lastVisited')
	if (typeof name !== 'string' || typeof route !== 'string') return null
	return {
		name,
		...(typeof logo === 'string' ? { logo } : {}),
		route,
		count: typeof count === 'number' && Number.isFinite(count) ? count : 1,
		lastVisited: typeof lastVisited === 'number' && Number.isFinite(lastVisited) ? lastVisited : 0
	}
}

function readRecentProtocols(raw: string): Array<RecentProtocol> {
	try {
		const parsed: unknown = JSON.parse(raw)
		if (!Array.isArray(parsed)) return []
		const protocols: Array<RecentProtocol> = []
		for (const value of parsed) {
			const protocol = readRecentProtocol(value)
			if (protocol) protocols.push(protocol)
		}
		return protocols
	} catch {
		return []
	}
}

const saveRecent = (protocol: { name: string; logo?: string; route: string }) => {
	try {
		const existingRaw = typeof window !== 'undefined' ? window.localStorage.getItem(RECENTS_KEY) : null
		let arr = existingRaw ? readRecentProtocols(existingRaw) : []

		const now = Date.now()
		const existing = arr.find((item) => item.route === protocol.route)
		if (existing) {
			existing.count = (existing.count || 0) + 1
			existing.lastVisited = now
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
	} catch (error) {
		console.log('failed to save recent protocol', error)
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

	const recentProtocols = useMemo(() => {
		return readRecentProtocols(recentProtocolsInStorage)
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
				const firstNewItem = items.item(previousCount)
				if (firstNewItem instanceof HTMLElement) firstNewItem.focus()
			}
		}, 0)
	}

	return (
		<Layout
			title="DeFi Protocols Directory - Official Links - DefiLlama"
			description="Browse the official websites and links for 7000+ DeFi protocols on DefiLlama."
			canonicalUrl="/directory"
		>
			<Announcement notCancellable>
				Search any protocol to go straight into their website, avoiding scam results from Google. Bookmark this page for
				better access and security
			</Announcement>
			<Ariakit.ComboboxProvider
				open
				setInputValue={(value) => {
					startTransition(() => {
						setSearchValue(value)
						setViewableMatches(20)
					})
				}}
			>
				{recentProtocols && recentProtocols.length > 0 ? (
					<div className="mx-auto mt-6 w-full max-w-3xl">
						<div className="mb-2 label-sm text-secondary">Recently visited</div>
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
										<div className="size-6 rounded-sm bg-surface-elevated-1" />
									)}
									<span className="truncate label-sm">{protocol.name}</span>
								</Card>
							))}
						</div>
					</div>
				) : null}

				<div className="mx-auto my-8 w-full max-w-3xl min-w-0">
					<div className="relative">
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<Ariakit.Combobox
							aria-label="Search protocols"
							placeholder="Search protocols…"
							autoSelect
							render={<Input className={searchFieldInputPlacementStyles} />}
						/>
					</div>
					<Ariakit.ComboboxList
						ref={comboboxRef}
						alwaysVisible
						className="mt-2 h-80 overflow-y-auto overscroll-contain rounded-lg border border-subtle bg-surface"
					>
						{matches.length > 0 ? (
							<>
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
										className={`${popoverMenuItemStyles} gap-4 aria-disabled:bg-hover-row aria-selected:bg-hover-row`}
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
										See more…
									</Ariakit.ComboboxItem>
								) : null}
							</>
						) : (
							<NoResults />
						)}
					</Ariakit.ComboboxList>
				</div>
			</Ariakit.ComboboxProvider>
		</Layout>
	)
}
