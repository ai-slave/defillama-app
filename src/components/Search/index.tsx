import * as Ariakit from '@ariakit/react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { multiSearchApi, searchApi } from '~/api'
import { useAuthContext } from '~/auth'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { useIsClient } from '~/hooks/useIsClient'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { LoadingDots } from '~/ui/Loaders'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { fetchJson } from '~/utils/async'
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

	const siteSearch = useSiteSearchDialog()

	return (
		<>
			<BasicLink
				href={isClient && shouldSkipLanding ? '/ai/chat' : '/ai'}
				className="llamaai-glow relative -my-0.5 overflow-hidden rounded-md bg-ai-gold-cta p-3 text-black shadow-ai-gold-cta lg:hidden"
				data-umami-event="llamaai-mobile-nav-link"
				data-umami-event-subscribed={isClient && hasActiveSubscription ? 'true' : 'false'}
			>
				<svg className="size-4 shrink-0">
					<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
				</svg>
				<span className="sr-only">{isClient && shouldSkipLanding ? 'Ask LlamaAI' : 'Try LlamaAI'}</span>
			</BasicLink>
			{searchTrigger ?? (
				<Ariakit.DialogProvider store={siteSearch.store}>
					<Ariakit.DialogDisclosure className="-my-0.5 rounded-md bg-surface/15 p-3 text-on-brand shadow hover:bg-surface/25 focus-visible:bg-surface/25 active:bg-surface/25 lg:hidden">
						<span className="sr-only">Search</span>
						<Icon name="search" height={16} width={16} />
					</Ariakit.DialogDisclosure>

					<SiteSearchDialog {...siteSearch} />
				</Ariakit.DialogProvider>
			)}
		</>
	)
}

function useSiteSearchDialog() {
	const [searchValue, setSearchValue] = useState('')
	const [mounted, setMounted] = useState(false)
	const store = Ariakit.useDialogStore({
		setMounted(value) {
			setMounted(value)
			if (!value) {
				setSearchValue('')
			}
		}
	})
	return { store, searchValue, setSearchValue, mounted }
}

function SiteSearchDialog({ store, searchValue, setSearchValue, mounted }: ReturnType<typeof useSiteSearchDialog>) {
	return (
		<Ariakit.Dialog
			store={store}
			unmountOnHide
			className={`${dialogSurfaceStyles} h-[calc(100dvh-80px)] sm:h-[min(720px,calc(100dvh-32px))]! sm:[--dialog-width:640px]`}
			hideOnInteractOutside
			portal
		>
			<Ariakit.ComboboxProvider
				inputValue={searchValue}
				setInputValue={(value) => {
					startTransition(() => {
						setSearchValue(value)
					})
				}}
			>
				<div className="flex min-h-0 flex-1 flex-col p-2">
					<span className="relative isolate flex w-full items-center justify-between gap-2">
						<DialogHeading className="sr-only">Search</DialogHeading>
						<Ariakit.Combobox placeholder="Search..." className={`ml-2 flex-1 ${inputStyles}`} />
						<DialogCloseButton className="shrink-0" ariaLabel="Close search" />
					</span>

					<Ariakit.ComboboxList className={`${dialogScrollableBodyStyles} flex flex-col gap-1`} alwaysVisible>
						{mounted ? <MobileSearchResults searchValue={searchValue} onSelect={() => store.setOpen(false)} /> : null}
					</Ariakit.ComboboxList>
				</div>
			</Ariakit.ComboboxProvider>
		</Ariakit.Dialog>
	)
}

const isSearchHotkey = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.code === 'KeyK'

export function SiteSearchHotkey() {
	const siteSearch = useSiteSearchDialog()
	const { store } = siteSearch
	useEffect(() => {
		function openSearch(e: KeyboardEvent) {
			if (!isSearchHotkey(e)) return
			e.preventDefault()
			store.show()
		}
		window.addEventListener('keydown', openSearch)
		return () => window.removeEventListener('keydown', openSearch)
	}, [store])

	return <SiteSearchDialog {...siteSearch} />
}

function MobileSearchResults({ searchValue, onSelect }: { searchValue: string; onSelect: () => void }) {
	const debouncedSearchValue = useDebouncedValue(searchValue, 200)
	const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } = useSearch(debouncedSearchValue)
	const { defaultSearchList, recentSearchList, isLoadingDefaultSearchList, errorDefaultSearchList } =
		useDefaultSearchList()

	if (debouncedSearchValue) {
		if (isLoading) {
			return (
				<p role="status" className="flex items-center justify-center gap-1 p-4">
					Loading
					<LoadingDots />
				</p>
			)
		}
		if (error) {
			return <p role="alert" className="flex items-center justify-center p-4 text-error">{`Error: ${error.message}`}</p>
		}
		if (data.length === 0) {
			return (
				<p role="status" className="flex items-center justify-center p-4 body-sm text-tertiary">
					No results found
				</p>
			)
		}
		return (
			<>
				{data.map((route: ISearchItem) => (
					<SearchItem key={`m-srch-data-${route.name}-${route.route}`} route={route} onSelect={onSelect} />
				))}
				{hasNextPage ? <SeeMoreButton isLoading={isFetchingNextPage} onClick={() => fetchNextPage()} /> : null}
			</>
		)
	}

	if (isLoadingDefaultSearchList) {
		return (
			<p role="status" className="flex items-center justify-center gap-1 p-4">
				Loading
				<LoadingDots />
			</p>
		)
	}
	if (errorDefaultSearchList) {
		return (
			<p
				role="alert"
				className="flex items-center justify-center p-4 text-error"
			>{`Error: ${errorDefaultSearchList.message}`}</p>
		)
	}
	if (!defaultSearchList?.length) {
		return (
			<p role="status" className="flex items-center justify-center p-4 body-sm text-tertiary">
				No results found
			</p>
		)
	}

	return (
		<>
			{recentSearchList.map((route: ISearchItem) => (
				<SearchItem key={`m-search-rct-${route.name}-${route.route}`} route={route} recent onSelect={onSelect} />
			))}
			{defaultSearchList.map((route: ISearchItem) => (
				<SearchItem key={`m-search-dl-${route.name}-${route.route}`} route={route} onSelect={onSelect} />
			))}
		</>
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

	const { defaultSearchList, recentSearchList, isLoadingDefaultSearchList, errorDefaultSearchList } =
		useDefaultSearchList()
	const debouncedSearchValue = useDebouncedValue(searchValue, 200)
	const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } = useSearch(debouncedSearchValue)

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
					<Ariakit.Combobox
						id="desktop-search-input"
						placeholder="Search..."
						ref={inputField}
						className={`${inputStyles} w-full pr-14 pl-8`}
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
						{debouncedSearchValue ? (
							isLoading ? (
								<p role="status" className="flex items-center justify-center gap-1 p-4">
									Loading
									<LoadingDots />
								</p>
							) : error ? (
								<p
									role="alert"
									className="flex items-center justify-center p-4 text-error"
								>{`Error: ${error.message}`}</p>
							) : data.length === 0 ? (
								<p role="status" className="flex items-center justify-center p-4 body-sm text-tertiary">
									No results found
								</p>
							) : (
								<>
									{data.map((route: ISearchItem) => (
										<SearchItem key={`gs-${route.name}-${route.route}-${route.subName}`} route={route} />
									))}
									{hasNextPage ? (
										<SeeMoreButton isLoading={isFetchingNextPage} onClick={() => fetchNextPage()} />
									) : null}
								</>
							)
						) : isLoadingDefaultSearchList ? (
							<p role="status" className="flex items-center justify-center gap-1 p-4">
								Loading
								<LoadingDots />
							</p>
						) : errorDefaultSearchList ? (
							<p
								role="alert"
								className="flex items-center justify-center p-4 text-error"
							>{`Error: ${errorDefaultSearchList.message}`}</p>
						) : !defaultSearchList?.length ? (
							<p role="status" className="flex items-center justify-center p-4 body-sm text-tertiary">
								No results found
							</p>
						) : (
							<>
								{recentSearchList.map((route: ISearchItem) => (
									<SearchItem key={`gs-r-${route.name}-${route.route}-${route.subName}`} route={route} recent />
								))}
								{defaultSearchList.map((route: ISearchItem) => (
									<SearchItem key={`gs-dl-${route.name}-${route.route}-${route.subName}`} route={route} />
								))}
							</>
						)}
					</Ariakit.ComboboxList>
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
			{!hideLlamaAiCta ? (
				<BasicLink
					href={isClient && shouldSkipLanding ? '/ai/chat' : '/ai'}
					className="llamaai-glow relative mr-auto hidden items-center justify-between gap-2.5 overflow-hidden rounded-md bg-ai-gold-cta px-4 py-2 text-xs font-semibold text-black shadow-ai-gold-cta lg:flex"
					data-umami-event="llamaai-nav-link"
					data-umami-event-subscribed={isClient && hasActiveSubscription ? 'true' : 'false'}
				>
					<svg className="size-4 shrink-0">
						<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
					</svg>
					<span className="whitespace-nowrap">{isClient && shouldSkipLanding ? 'Ask LlamaAI' : 'Try LlamaAI'}</span>
				</BasicLink>
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
				<img src={route.logo} alt={route.name} className="size-6 rounded-full" loading="lazy" />
			) : (
				<Icon name="file-text" className="size-6" />
			)}
			<span>{route.name}</span>
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
		<button
			type="button"
			onClick={onClick}
			disabled={isLoading}
			className="flex w-full items-center justify-center gap-1 px-3 py-2 body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row disabled:opacity-60"
		>
			{isLoading ? (
				<>
					Loading
					<LoadingDots />
				</>
			) : (
				'See more'
			)}
		</button>
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

const useDefaultSearchList = () => {
	const { data, isLoading, error } = useQuery({
		queryKey: ['search', 'default-list'],
		queryFn: getDefaultSearchList,
		staleTime: 1000 * 60 * 60,
		refetchOnMount: false,
		refetchOnWindowFocus: false
	})

	const recentSearch = useStorageItem('recentSearch', '[]')

	const { defaultSearchList, recentSearchList } = useMemo(() => {
		if (!data || data.length === 0) return { defaultSearchList: [], recentSearchList: [] }

		const recentSearchArray = JSON.parse(recentSearch)

		return {
			defaultSearchList:
				data?.filter((route: ISearchItem) => !recentSearchArray.some((r: ISearchItem) => r.route === route.route)) ??
				[],
			recentSearchList: recentSearchArray ?? []
		}
	}, [data, recentSearch])

	return {
		defaultSearchList,
		recentSearchList,
		isLoadingDefaultSearchList: isLoading,
		errorDefaultSearchList: error
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
		error: query.error,
		hasNextPage: query.hasNextPage,
		isFetchingNextPage: query.isFetchingNextPage,
		fetchNextPage: query.fetchNextPage
	}
}
