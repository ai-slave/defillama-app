import * as Ariakit from '@ariakit/react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { multiSearchApi, searchApi } from '~/api'
import { useAuthContext } from '~/auth'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import { freeLabelAOnly, freeLabelBOnly, useLlamaAIFreeLabel } from '~/components/LlamaAIFreeLabel'
import { GoldCta } from '~/containers/LlamaAI/components/GoldCta'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Dialog, dialogScrollableBodyStyles, DialogSearchHeader } from '~/ui/Dialog'
import { takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingDots } from '~/ui/Loaders'
import { NoResults } from '~/ui/NoResults'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { fetchJson } from '~/utils/async'
import { queryReadFailed } from '~/utils/query'
import { findCategoryToPromote, mergePromotedCategory } from './categoryPromotion'

const SEARCH_PAGE_SIZE = 20
const EMPTY_SEARCH_ITEMS: Array<ISearchItem> = []

async function getDefaultSearchList() {
	const data = await fetchJson('https://defillama-datasets.llama.fi/searchlist.json')
	return data
}
async function fetchSearchPage(query: string, offset: number): Promise<Array<ISearchItem>> {
	// Follow-up pages don't need the category merge - only the top of the list
	// is eligible for promotion.
	if (offset > 0) {
		return searchApi<ISearchItem>({ indexUid: 'pages', limit: SEARCH_PAGE_SIZE, offset, q: query })
	}

	const [hits, categoryHits] = await multiSearchApi<ISearchItem>([
		{ indexUid: 'pages', limit: SEARCH_PAGE_SIZE, offset, q: query },
		{ indexUid: 'pages', limit: 3, offset: 0, q: query, filter: [['type = "Category"']] }
	])
	return mergePromotedCategory(hits, findCategoryToPromote(hits, categoryHits, query))
}

interface ISearchItem {
	name: string
	logo: string
	symbol?: string
	route: string
	type: string
	deprecated?: boolean
	hideType?: boolean
	subName?: string
	r?: number
}

export function MobileSearch({ searchTrigger }: { searchTrigger?: ReactNode } = {}) {
	const isClient = useIsClient()
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()
	const shouldSkipLanding = isAuthenticated

	const siteSearchStore = Ariakit.useDialogStore()
	// Signed in, the button reads Ask LlamaAI in both arms, so the reader is not part of the label test here.
	const freeLabel = useLlamaAIFreeLabel(!shouldSkipLanding)

	return (
		<>
			<GoldCta
				as={BasicLink}
				size="lg"
				square
				href={isClient && shouldSkipLanding ? '/ai/chat' : '/ai'}
				className="-my-0.5 lg:hidden"
				data-umami-event="llamaai-mobile-nav-link"
				data-umami-event-subscribed={isClient && hasActiveSubscription ? 'true' : 'false'}
				onClick={freeLabel.trackEntryClick}
			>
				<svg className="size-4 shrink-0">
					<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
				</svg>
				{isClient && shouldSkipLanding ? (
					<span className="sr-only">Ask LlamaAI</span>
				) : (
					<span className="sr-only">
						<span className={freeLabelAOnly}>Try LlamaAI</span>
						<span className={freeLabelBOnly}>Ask LlamaAI for free</span>
					</span>
				)}
			</GoldCta>
			{searchTrigger ?? (
				<Ariakit.DialogProvider store={siteSearchStore}>
					<Tooltip
						content="Search"
						render={
							// Inside a Tooltip the provider context is the tooltip's, so the disclosure names its dialog's store.
							<Ariakit.DialogDisclosure
								store={siteSearchStore}
								render={<Button variant="onBrand" size="lg" square className="-my-0.5 lg:hidden" />}
								aria-label="Search"
							/>
						}
					>
						<Icon name="search" className="size-4" />
					</Tooltip>

					<SiteSearchDialog store={siteSearchStore} />
				</Ariakit.DialogProvider>
			)}
		</>
	)
}

function SiteSearchDialog({ store }: { store: Ariakit.DialogStore }) {
	return (
		<Dialog store={store} size="md" fullSheet unmountOnHide portal>
			<SiteSearchPalette onSelect={() => store.setOpen(false)} />
		</Dialog>
	)
}

/** Mounts with each opening, so every search starts empty. */
function SiteSearchPalette({ onSelect }: { onSelect: () => void }) {
	const [searchValue, setSearchValue] = useState('')
	return (
		<Ariakit.ComboboxProvider
			inputValue={searchValue}
			setInputValue={(value) => {
				startTransition(() => {
					setSearchValue(value)
				})
			}}
		>
			<DialogSearchHeader title="Search">
				<Ariakit.Combobox placeholder="Search…" aria-label="Search" render={<Input />} />
			</DialogSearchHeader>
			<Ariakit.ComboboxList className={`${dialogScrollableBodyStyles} p-2`} alwaysVisible>
				<SearchResults searchValue={searchValue} onSelect={onSelect} />
			</Ariakit.ComboboxList>
		</Ariakit.ComboboxProvider>
	)
}

const isSearchHotkey = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.code === 'KeyK'

export function SiteSearchHotkey() {
	const store = Ariakit.useDialogStore()
	useEffect(() => {
		function openSearch(e: KeyboardEvent) {
			if (!isSearchHotkey(e)) return
			e.preventDefault()
			store.show()
		}
		window.addEventListener('keydown', openSearch)
		return () => window.removeEventListener('keydown', openSearch)
	}, [store])

	return <SiteSearchDialog store={store} />
}

/** Results for a query, or the recent and default lists before one. Shared by the desktop popover and the
    phone dialog. */
function SearchResults({ searchValue, onSelect }: { searchValue: string; onSelect?: () => void }) {
	const debouncedSearchValue = useDebouncedValue(searchValue, 200)
	const search = useSearch(debouncedSearchValue)
	const defaults = useDefaultSearchList()

	if (debouncedSearchValue) {
		// The failure first: a retry from it moves the query back to loading, and the error waits in its Try again.
		if (search.data.length === 0 && search.failed) {
			return <SearchError retrying={search.isFetching} onRetry={() => void search.refetch()} />
		}
		if (search.isLoading) return <SearchLoading />
		if (search.data.length === 0) return <NoResults />
		return (
			<>
				{search.data.map((route) => (
					<SearchItem key={`${route.name}-${route.route}-${route.subName}`} route={route} onSelect={onSelect} />
				))}
				{/* A failed next page keeps the results already loaded and offers its own retry in place of See more. */}
				{search.isFetchNextPageError ? (
					<SearchError retrying={search.isFetchingNextPage} onRetry={() => void search.fetchNextPage()} />
				) : search.hasNextPage ? (
					<SeeMoreButton isLoading={search.isFetchingNextPage} onClick={() => search.fetchNextPage()} />
				) : null}
			</>
		)
	}

	if (defaults.failed) return <SearchError retrying={defaults.isFetching} onRetry={() => void defaults.refetch()} />
	if (defaults.isLoading) return <SearchLoading />
	if (defaults.defaultSearchList.length === 0) return <NoResults />
	return (
		<>
			{defaults.recentSearchList.map((route) => (
				<SearchItem
					key={`recent-${route.name}-${route.route}-${route.subName}`}
					route={route}
					recent
					onSelect={onSelect}
				/>
			))}
			{defaults.defaultSearchList.map((route) => (
				<SearchItem key={`${route.name}-${route.route}-${route.subName}`} route={route} onSelect={onSelect} />
			))}
		</>
	)
}

function SearchLoading() {
	return (
		<p role="status" className="flex justify-center p-4">
			<LoadingIndicator />
		</p>
	)
}

function SearchError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
	return (
		<div className="p-2">
			<InlineStatus
				variant="error"
				action={
					// Replaces a See more that failed with focus, so it takes that focus.
					<Button
						ref={takeLostFocus}
						type="button"
						size="sm"
						pendingLabel={retrying ? 'Retrying…' : null}
						onClick={onRetry}
					>
						Try again
					</Button>
				}
			>
				Couldn&rsquo;t load search results.
			</InlineStatus>
		</div>
	)
}

function getPreHydrationInputValue() {
	if (typeof window === 'undefined') return ''
	const el = document.getElementById('desktop-search-input')
	return el instanceof HTMLInputElement ? el.value : ''
}

export function DesktopSearch({ hideLlamaAiCta = false }: { hideLlamaAiCta?: boolean }) {
	const isClient = useIsClient()
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()
	const shouldSkipLanding = isAuthenticated
	const freeLabel = useLlamaAIFreeLabel(!hideLlamaAiCta && !shouldSkipLanding)

	const inputField = useRef<HTMLInputElement>(null)

	const [searchValue, setSearchValue] = useState(getPreHydrationInputValue)
	const [open, setOpen] = useState(() => searchValue.length > 0)
	useEffect(() => {
		function focusSearchBar(e: KeyboardEvent) {
			if (isSearchHotkey(e)) {
				e.preventDefault()
				inputField.current?.focus()
				setOpen(true)
			}
		}

		window.addEventListener('keydown', focusSearchBar)

		return () => window.removeEventListener('keydown', focusSearchBar)
	}, [setOpen])

	const queryClient = useQueryClient()
	return (
		<>
			<Ariakit.ComboboxProvider
				inputValue={searchValue}
				setInputValue={(value) => {
					startTransition(() => {
						setSearchValue(value)
					})
				}}
				open={open}
				setOpen={(value) => {
					setOpen(value)
					if (!value) {
						setSearchValue('')
					}
				}}
			>
				<span className="relative isolate hidden w-full lg:inline-block lg:max-w-[50vw]">
					<Tooltip
						content={open ? 'Close search' : 'Open search'}
						render={
							<Button
								variant="ghost"
								size="sm"
								square
								className="absolute top-1/2 left-2 -translate-y-1/2"
								aria-label={open ? 'Close search' : 'Open search'}
								aria-expanded={open}
								onClick={() => setOpen((prev) => !prev)}
							/>
						}
					>
						<Icon name={open ? 'x' : 'search'} className="size-4" />
					</Tooltip>
					<Ariakit.Combobox
						id="desktop-search-input"
						placeholder="Search…"
						aria-label="Search"
						ref={inputField}
						// The default list loads with the popover; starting it on focus has it ready by the first open.
						onFocus={() => void queryClient.prefetchQuery(defaultSearchListQuery)}
						render={<Input className="w-full pr-14 pl-9" />}
					/>
					<span className="absolute top-0 right-1.5 bottom-0 my-auto flex h-5 items-center justify-center rounded-md bg-brand-muted px-1.5 label-xs text-link">
						⌘K
					</span>
				</span>
				<ComboboxSurface
					variant="search-results"
					hideOnInteractOutside
					gutter={6}
					sameWidth
					className="max-h-[min(var(--popover-available-height),60vh)]"
					portal
				>
					<Ariakit.ComboboxList alwaysVisible>
						<SearchResults searchValue={searchValue} />
					</Ariakit.ComboboxList>
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
			{!hideLlamaAiCta ? (
				<GoldCta
					as={BasicLink}
					size="md"
					href={isClient && shouldSkipLanding ? '/ai/chat' : '/ai'}
					className="mr-auto max-lg:hidden"
					data-umami-event="llamaai-nav-link"
					data-umami-event-subscribed={isClient && hasActiveSubscription ? 'true' : 'false'}
					onClick={freeLabel.trackEntryClick}
				>
					<svg className="size-4 shrink-0">
						<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
					</svg>
					{isClient && shouldSkipLanding ? (
						<span className="whitespace-nowrap">Ask LlamaAI</span>
					) : (
						<>
							<span className={`whitespace-nowrap ${freeLabelAOnly}`}>Try LlamaAI</span>
							<span className={`whitespace-nowrap ${freeLabelBOnly}`}>Ask LlamaAI for free</span>
						</>
					)}
				</GoldCta>
			) : null}
		</>
	)
}

function SearchItem({
	route,
	recent = false,
	onSelect
}: {
	route: ISearchItem
	recent?: boolean
	onSelect?: () => void
}) {
	const router = useRouter()
	const deprecatedContent = route.type ? `Deprecated ${route.type.toLowerCase()}` : 'Deprecated'
	return (
		<Ariakit.ComboboxItem
			className="flex flex-wrap items-center gap-2 px-3 py-2 body-sm text-primary outline-hidden cv-auto-40 hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring"
			render={
				<BasicLink
					href={route.route}
					shallow={
						!!(route.subName && route.route.includes('?') && router.asPath.startsWith(route.route.split('?')[0]))
					}
				/>
			}
			onClick={() => {
				if (!recent) {
					setRecentSearch(route)
				}
				onSelect?.()
			}}
			value={route.route}
			setValueOnClick={false}
			focusOnHover
			hideOnClick
		>
			{route.logo ? (
				<img src={route.logo} alt="" className="size-6 rounded-full" loading="lazy" />
			) : (
				<Icon name="file-text" className="size-6" />
			)}
			<span>{route.name}</span>
			{/* Protocol hits carry their governance token's symbol too; only token hits show it */}
			{route.type === 'Token' && route.symbol ? <span className="text-tertiary">{route.symbol}</span> : null}
			{route.subName ? (
				<>
					<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
					<span className="text-tertiary">{route.subName}</span>
				</>
			) : null}
			{route.deprecated ? <DeprecatedEntityMarker content={deprecatedContent} /> : null}
			{route.hideType ? null : recent ? (
				<Icon name="clock" height={12} width={12} className="ml-auto" />
			) : (
				<span className="ml-auto label-sm text-link">{route.type}</span>
			)}
		</Ariakit.ComboboxItem>
	)
}

function SeeMoreButton({ isLoading, onClick }: { isLoading: boolean; onClick: () => void }) {
	return (
		// Focusable while it loads, so a reader who pressed it keeps their place; it takes focus back from a Try again
		// whose retry brought it back.
		<Ariakit.Button
			ref={takeLostFocus}
			type="button"
			onClick={onClick}
			disabled={isLoading}
			accessibleWhenDisabled
			aria-busy={isLoading || undefined}
			className="flex w-full items-center justify-center gap-1 px-3 py-2 body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row aria-disabled:text-disabled"
		>
			{isLoading ? (
				<>
					Loading
					<LoadingDots />
				</>
			) : (
				'See more'
			)}
		</Ariakit.Button>
	)
}

const setRecentSearch = (route: ISearchItem) => {
	const recentSearch = window.localStorage.getItem('recentSearch')
	const recentSearchArray = JSON.parse(recentSearch ?? '[]')
	setStorageItem(
		'recentSearch',
		JSON.stringify([route, ...recentSearchArray.filter((r: ISearchItem) => r.route !== route.route).slice(0, 2)])
	)
}

const defaultSearchListQuery = {
	queryKey: ['search', 'default-list'],
	queryFn: getDefaultSearchList,
	staleTime: 1000 * 60 * 60
}

function useDefaultSearchList() {
	const query = useQuery({
		...defaultSearchListQuery,
		refetchOnMount: false,
		refetchOnWindowFocus: false
	})
	const data = query.data

	const recentSearch = useStorageItem('recentSearch', '[]')

	const { defaultSearchList, recentSearchList } = useMemo(() => {
		if (!data || data.length === 0)
			return { defaultSearchList: EMPTY_SEARCH_ITEMS, recentSearchList: EMPTY_SEARCH_ITEMS }

		const recentSearchArray: Array<ISearchItem> = JSON.parse(recentSearch)

		return {
			defaultSearchList: data.filter(
				(route: ISearchItem) => !recentSearchArray.some((r: ISearchItem) => r.route === route.route)
			),
			recentSearchList: recentSearchArray
		}
	}, [data, recentSearch])

	return {
		defaultSearchList,
		recentSearchList,
		isLoading: query.isLoading,
		failed: queryReadFailed(query),
		isFetching: query.isFetching,
		refetch: query.refetch
	}
}

function useSearch(searchValue: string) {
	const query = useInfiniteQuery({
		queryKey: ['search', 'results', searchValue],
		queryFn: ({ pageParam }) => fetchSearchPage(searchValue, pageParam),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) =>
			lastPage.length === SEARCH_PAGE_SIZE ? allPages.length * SEARCH_PAGE_SIZE : undefined,
		enabled: searchValue.length > 0,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const data = useMemo(() => query.data?.pages.flat() ?? EMPTY_SEARCH_ITEMS, [query.data])

	return {
		data,
		isLoading: query.isLoading,
		failed: queryReadFailed(query),
		isFetching: query.isFetching,
		hasNextPage: query.hasNextPage,
		isFetchNextPageError: query.isFetchNextPageError,
		isFetchingNextPage: query.isFetchingNextPage,
		fetchNextPage: query.fetchNextPage,
		refetch: query.refetch
	}
}
