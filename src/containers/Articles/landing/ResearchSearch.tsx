import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useId, useState } from 'react'
import { ResearchIcon } from '~/components/ResearchIcon'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import {
	ArticleApiError,
	listArticles,
	listArticleSections,
	listResearchClients,
	type ArticleSectionListResponse
} from '~/containers/Articles/api'
import { articleClientLabel, researchClientHref } from '~/containers/Articles/clientLabel'
import {
	type ResearchSearchQuery,
	useResearchSearchParams
} from '~/containers/Articles/landing/useResearchSearchParams'
import {
	articleHref,
	formatDate,
	getArticleBylineAuthorEntries,
	readingMinutes
} from '~/containers/Articles/landing/utils'
import { ResearchLoader } from '~/containers/Articles/ResearchLoader'
import type { ArticleDocument, ArticleSection, ResearchClientSummary } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'

function humanizeTag(tag: string) {
	return tag.replace(/-/g, ' ')
}

function resolveCover(article: ArticleDocument | null | undefined) {
	return article?.coverImage?.url || null
}

const ALL_CLIENTS = 'all'
const RESEARCH_CLIENTS_QUERY_KEY = ['research', 'clients'] as const

function buildSearchUrl(
	pathname: string,
	params: { q?: string; tag?: string; section?: string; client?: string; page?: number }
) {
	const search = new URLSearchParams()
	if (params.q) search.set('q', params.q)
	if (params.tag) search.set('tag', params.tag)
	if (params.section) search.set('section', params.section)
	if (params.client) search.set('client', params.client)
	if (params.page && params.page > 1) search.set('page', String(params.page))
	const qs = search.toString()
	return qs ? `${pathname}?${qs}` : pathname
}

function ByLine({ article }: { article: ArticleDocument }) {
	const authorEntries =
		getArticleBylineAuthorEntries(article) ??
		(article.authorProfile
			? [
					{
						key: `owner:${article.authorProfile.slug}`,
						name: article.authorProfile.displayName,
						href: `/research/authors/${article.authorProfile.slug}`
					}
				]
			: null)

	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 body-sm text-tertiary">
			{authorEntries?.length ? (
				<span className="flex flex-wrap items-center gap-1 font-medium text-secondary">
					{authorEntries.map((entry, index) => (
						<span key={entry.key} className="inline-flex items-center gap-1">
							{entry.href ? (
								<Link href={entry.href} className="transition-colors hover:text-link">
									{entry.name}
								</Link>
							) : (
								<span>{entry.name}</span>
							)}
							{index < authorEntries.length - 2 ? <span>,</span> : null}
							{index === authorEntries.length - 2 ? <span className="font-normal">and</span> : null}
						</span>
					))}
				</span>
			) : null}
			{authorEntries?.length ? <span aria-hidden>·</span> : null}
			<span>{formatDate(article.displayDate ?? article.publishedAt)}</span>
			<span aria-hidden>·</span>
			<span>{readingMinutes(article)} min read</span>
		</div>
	)
}

function SearchBar({ searchQuery, routePath }: { searchQuery: ResearchSearchQuery; routePath: string }) {
	const router = useRouter()
	const { query, tag, section, client } = searchQuery
	const [draft, setDraft] = useState(query)
	// Every new URL query (a submit, a section or tag link, Back/Forward) replaces the draft. Keying the draft by the
	// query it was typed against would bring a discarded draft back when the reader returns to that query.
	const [draftQuery, setDraftQuery] = useState(query)
	if (draftQuery !== query) {
		setDraftQuery(query)
		setDraft(query)
	}

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const nextQuery = draft.trim()
		const href = buildSearchUrl(routePath, { q: nextQuery, tag, section, client })
		router.push(href, undefined, { shallow: false, scroll: false })
	}

	return (
		<form
			noValidate
			action={routePath}
			onSubmit={handleSubmit}
			className="group relative flex items-center border-b border-medium transition-colors focus-within:border-brand"
		>
			<Icon name="search" height={14} width={14} className="pointer-events-none mr-3 text-tertiary" />
			<label className="flex-1">
				<span className="sr-only">Search research</span>
				<input
					name="q"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder="Search reports, interviews, spotlights…"
					className="w-full bg-transparent py-2.5 body-md text-research-navy placeholder:text-tertiary focus:outline-hidden"
				/>
			</label>
			<button
				type="submit"
				className="ml-2 inline-flex items-center gap-1 p-1 label-xs tracking-[0.18em] text-link uppercase transition-colors hover:text-research-navy"
			>
				<span>Search</span>
				<span aria-hidden>→</span>
			</button>
		</form>
	)
}

function SectionsPills({ searchQuery, pathname }: { searchQuery: ResearchSearchQuery; pathname: string }) {
	const { query: q, tag, section: activeSection, client } = searchQuery
	const labelId = useId()
	const { data } = useQuery<ArticleSectionListResponse>({
		queryKey: ['research', 'sections'],
		queryFn: () => listArticleSections(6),
		retry: false
	})

	const hrefForSection = (sectionSlug?: string) =>
		buildSearchUrl(pathname, {
			q,
			tag,
			section: sectionSlug,
			client
		})

	// The current section draws its accent and underline from aria-current.
	const linkStyles =
		'relative inline-flex items-center label-xs tracking-[0.18em] uppercase transition-colors text-secondary hover:text-primary aria-[current=page]:text-link after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:bg-current after:opacity-0 aria-[current=page]:after:opacity-100'

	return (
		<nav aria-labelledby={labelId} className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
			<span id={labelId} className="label-xs tracking-[0.24em] text-tertiary uppercase">
				Sections
			</span>
			<Link href={hrefForSection()} aria-current={!activeSection ? 'page' : undefined} className={linkStyles}>
				All
			</Link>
			{data?.sections?.map((s) => (
				<Link
					key={s.section}
					href={hrefForSection(s.section)}
					aria-current={s.section === activeSection ? 'page' : undefined}
					className={linkStyles}
				>
					{humanizeTag(s.section)}
				</Link>
			))}
		</nav>
	)
}

function ResultCard({ article }: { article: ArticleDocument }) {
	const cover = resolveCover(article)
	const sectionLabel = article.section ? humanizeTag(article.section) : null
	return (
		<li className="group grid grid-cols-1 gap-3.5 py-5.5 sm:grid-cols-[clamp(180px,28vw,260px)_minmax(0,1fr)] sm:gap-6">
			<Link
				href={articleHref(article)}
				aria-label={article.title}
				className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-surface-elevated-1"
			>
				{cover ? (
					<img
						src={cover}
						alt={article.coverImage?.alt ?? ''}
						loading="lazy"
						decoding="async"
						className="size-full object-cover"
					/>
				) : (
					<div className="grid size-full place-items-center text-tertiary">
						<ResearchIcon name="research-placeholder" className="size-6" aria-hidden />
					</div>
				)}
				{sectionLabel ? (
					<span className="absolute top-[10px] left-[10px] z-[1]">
						{/* Over a cover the badge is white on the image; without one it sits on the light placeholder. */}
						<span
							className={`rounded-[4px] border px-2 py-0.75 label-xs tracking-[0.04em] uppercase ${cover ? 'border-research-white text-research-white backdrop-blur-[2px]' : 'border-medium text-secondary'}`}
						>
							{sectionLabel}
						</span>
					</span>
				) : null}
			</Link>
			<div className="grid content-start gap-2.5">
				<Link href={articleHref(article)} className="block">
					<h3 className="text-[19px] leading-[130%] font-semibold tracking-tight text-research-navy transition-colors group-hover:text-link sm:text-[22px]">
						{article.title}
					</h3>
					{article.excerpt || article.subtitle ? (
						<p className="mt-2.5 line-clamp-2 body-md text-secondary">{article.excerpt || article.subtitle}</p>
					) : null}
				</Link>
				{article.client ? (
					<Link
						href={researchClientHref(article.client.id)}
						className="w-fit label-xs tracking-[0.18em] text-link uppercase transition-colors hover:text-research-navy"
					>
						{articleClientLabel(article.client)}
					</Link>
				) : null}
				<ByLine article={article} />
			</div>
		</li>
	)
}

function Pagination({
	searchQuery,
	pathname,
	page,
	totalPages,
	rangeStart,
	rangeEnd,
	totalItems
}: {
	searchQuery: ResearchSearchQuery
	pathname: string
	page: number
	totalPages: number
	rangeStart: number
	rangeEnd: number
	totalItems: number
}) {
	const router = useRouter()
	const go = (next: number) => {
		const href = buildSearchUrl(pathname, {
			q: searchQuery.query,
			tag: searchQuery.tag,
			section: searchQuery.section,
			client: searchQuery.client,
			page: next
		})
		router.push(href, undefined, { shallow: false, scroll: false })
	}
	const prevPage = Math.max(1, page - 1)
	const nextPage = Math.min(totalPages, page + 1)

	return (
		<nav
			aria-label="Search results pagination"
			className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-5"
		>
			<span className="label-xs tracking-[0.18em] text-tertiary uppercase tabular-nums">
				{rangeStart}–{rangeEnd} of {formatNumber(totalItems)}
			</span>
			<div className="flex items-center gap-2">
				{/* Focusable at the ends: paging to the last page disables the Next that was pressed. A failed page replaces
				    the pager with the error, so focus moves to the page instead of dropping to the body. */}
				<Button
					ref={focusRegionOnLeave}
					variant="outline"
					size="md"
					onClick={() => go(prevPage)}
					disabled={page <= 1}
					accessibleWhenDisabled
				>
					<Icon name="arrow-left" className="size-3.5" />
					<span>Prev</span>
				</Button>
				<span className="px-2 mono-sm tracking-[0.12em] text-secondary tabular-nums">
					{page} / {totalPages}
				</span>
				<Button
					ref={focusRegionOnLeave}
					variant="outline"
					size="md"
					onClick={() => go(nextPage)}
					disabled={page >= totalPages}
					accessibleWhenDisabled
				>
					<span>Next</span>
					<Icon name="arrow-right" className="size-3.5" />
				</Button>
			</div>
		</nav>
	)
}

function EmptyState({ query, tag, section, client }: { query: string; tag: string; section: string; client: string }) {
	const hasFilters = Boolean(query || tag || section || client)
	return (
		<div className="grid place-items-center px-4 py-20 text-center">
			<div className="grid max-w-md gap-3">
				<ResearchIcon name="research-search-empty" className="mx-auto size-12 text-tertiary" aria-hidden />
				<h2 className="text-[22px] leading-[130%] font-semibold tracking-tight text-research-navy">
					{hasFilters ? 'Nothing matches that.' : 'No research yet.'}
				</h2>
				<p className="body-md text-secondary">
					{hasFilters
						? 'Try a different keyword, drop a filter, or browse the sections below.'
						: 'Once research is published, you can search across reports, interviews, and more from here.'}
				</p>
			</div>
		</div>
	)
}

function ResultsTitle({ query, tag, clientName }: { query: string; tag: string; clientName: string | null }) {
	const cls = 'text-[clamp(22px,2.6vw,30px)] leading-[120%] font-medium tracking-tight text-research-navy'
	if (query) {
		return (
			<h1 className={cls}>
				<span className="text-tertiary">Results for </span>
				<span>"{query}"</span>
			</h1>
		)
	}
	if (tag) {
		return (
			<h1 className={cls}>
				<span className="text-tertiary">Tagged </span>
				<span>#{tag}</span>
			</h1>
		)
	}
	if (clientName) {
		return (
			<h1 className={cls}>
				<span className="text-tertiary">Client </span>
				<span>{clientName}</span>
			</h1>
		)
	}
	return <h1 className={cls}>All Research</h1>
}

function ClientFilter({
	searchQuery,
	pathname,
	clients
}: {
	searchQuery: ResearchSearchQuery
	pathname: string
	clients: Array<ResearchClientSummary>
}) {
	const router = useRouter()
	const { query: q, tag, section, client } = searchQuery
	if (clients.length === 0) return null
	const selectedName = client
		? (clients.find((option) => option.id === client)?.displayName ?? 'Unknown client')
		: 'All clients'

	return (
		<SelectWithCombobox
			allValues={[
				{ key: ALL_CLIENTS, name: 'All clients' },
				...clients.map((option) => ({ key: option.id, name: option.displayName }))
			]}
			selectedValues={[client || ALL_CLIENTS]}
			selectedLabels={[selectedName]}
			setSelectedValues={(values) => {
				const next = values[0]
				if (!next) return
				const href = buildSearchUrl(pathname, {
					q,
					tag,
					section,
					client: next === ALL_CLIENTS ? undefined : next
				})
				router.push(href, undefined, { shallow: false, scroll: false })
			}}
			label="Client"
			labelType="regular"
			singleSelect
			variant="filter"
			size="md"
			className="w-fit"
		/>
	)
}

export default function ResearchSearch() {
	const router = useRouter()
	const { searchQuery, clearSearchParams } = useResearchSearchParams()
	const { query, tag, section, client, page } = searchQuery
	const PAGE_SIZE = 24
	const { data: clients = [] } = useQuery({
		queryKey: RESEARCH_CLIENTS_QUERY_KEY,
		queryFn: () => listResearchClients(),
		retry: false
	})
	const clientName = clients.find((option) => option.id === client)?.displayName ?? null

	const {
		data: response,
		isLoading,
		error,
		refetch,
		isFetching,
		errorUpdatedAt,
		dataUpdatedAt
	} = useQuery({
		queryKey: ['research', 'articles', searchQuery],
		queryFn: async () => {
			return listArticles({
				sort: 'newest',
				limit: PAGE_SIZE,
				page,
				query,
				tags: tag ? [tag] : undefined,
				section: section as ArticleSection,
				client: client || undefined
			})
		},
		retry: false,
		enabled: router.isReady,
		// Paging keeps the current results on screen until the next page arrives, so the pressed Prev or Next keeps focus.
		placeholderData: keepPreviousData
	})

	const resultsLoading = !router.isReady || isLoading
	const failed = queryReadFailed({ errorUpdatedAt, dataUpdatedAt })
	const totalItems = response?.totalItems ?? 0
	const totalPages = response ? Math.max(1, response.totalPages) : 1
	const safePage = Math.min(Math.max(1, page), totalPages)
	const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
	const rangeEnd = Math.min(safePage * PAGE_SIZE, totalItems)

	return (
		<div className="mx-auto grid w-full max-w-6xl gap-7 px-3 pt-4 pb-20 sm:px-6 lg:px-8">
			<header className="grid gap-4 pr-16 lg:pr-0">
				<div className="flex items-baseline justify-between gap-6 label-xs tracking-[0.22em] uppercase">
					<span className="text-link">Research / Archive</span>
					<Button variant="link" onClick={clearSearchParams} className="shrink-0">
						<span aria-hidden>←</span>
						Back
					</Button>
				</div>

				<ResultsTitle query={query} tag={tag} clientName={clientName} />

				<div className="flex items-center gap-x-3 text-tertiary">
					<span className="label-xs tracking-[0.18em] uppercase tabular-nums">
						{/* A failed read has no count to give: the block below says why. */}
						{failed
							? null
							: resultsLoading
								? 'Loading…'
								: `${formatNumber(totalItems)} ${totalItems === 1 ? 'result' : 'results'}`}
					</span>
					<div className="grow border-t border-subtle" />
				</div>

				<SearchBar searchQuery={searchQuery} routePath={router.pathname} />
				<SectionsPills searchQuery={searchQuery} pathname={router.pathname} />
				<ClientFilter searchQuery={searchQuery} pathname={router.pathname} clients={clients} />
			</header>

			{/* A failed read shows where the results go, so the search bar and filters stay usable. */}
			{failed ? (
				<InlineStatus
					variant="error"
					action={
						<Button
							ref={focusRegionOnLeave}
							size="sm"
							onClick={() => void refetch()}
							pendingLabel={isFetching ? 'Retrying…' : null}
						>
							Try again
						</Button>
					}
				>
					Couldn't load research. {error instanceof ArticleApiError ? error.message : 'Failed to load articles'}
				</InlineStatus>
			) : resultsLoading ? (
				<div className="grid min-h-[280px] place-items-center py-12">
					<ResearchLoader />
				</div>
			) : response.items.length > 0 ? (
				<>
					<ul className="grid divide-y divide-(--border-subtle)">
						{response.items.map((article) => (
							<ResultCard key={article.id} article={article} />
						))}
					</ul>
					{totalPages > 1 ? (
						<Pagination
							searchQuery={searchQuery}
							pathname={router.pathname}
							page={safePage}
							totalPages={totalPages}
							rangeStart={rangeStart}
							rangeEnd={rangeEnd}
							totalItems={totalItems}
						/>
					) : null}
				</>
			) : (
				<EmptyState query={query} tag={tag} section={section} client={client} />
			)}
		</div>
	)
}
