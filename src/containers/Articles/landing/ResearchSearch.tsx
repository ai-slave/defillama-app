import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { ResearchIcon } from '~/components/ResearchIcon'
import {
	ArticleApiError,
	listArticles,
	listArticleSections,
	type ArticleSectionListResponse
} from '~/containers/Articles/api'
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
import type { ArticleDocument, ArticleSection } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'

function humanizeTag(tag: string) {
	return tag.replace(/-/g, ' ')
}

function resolveCover(article: ArticleDocument | null | undefined) {
	return article?.coverImage?.url || null
}

function buildSearchUrl(pathname: string, params: { q?: string; tag?: string; section?: string; page?: number }) {
	const search = new URLSearchParams()
	if (params.q) search.set('q', params.q)
	if (params.tag) search.set('tag', params.tag)
	if (params.section) search.set('section', params.section)
	if (params.page && params.page > 1) search.set('page', String(params.page))
	const qs = search.toString()
	return qs ? `${pathname}?${qs}` : pathname
}

function ResultBadge({ children }: { children: React.ReactNode }) {
	return (
		<span className="rounded-[4px] border border-research-invert px-2 py-0.75 text-[10px] font-semibold tracking-[0.04em] text-on-brand uppercase backdrop-blur-[2px]">
			{children}
		</span>
	)
}

function ByLine({ article }: { article: ArticleDocument }) {
	const authorEntries =
		getArticleBylineAuthorEntries(article) ??
		(article.authorProfile
			? [{ name: article.authorProfile.displayName, href: `/research/authors/${article.authorProfile.slug}` }]
			: null)

	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-research-heading/60 dark:text-on-brand/55">
			{authorEntries?.length ? (
				<span className="flex flex-wrap items-center gap-1 font-medium text-research-heading/80 dark:text-on-brand/75">
					{authorEntries.map((entry, index) => (
						<span key={`${entry.name}-${index}`} className="inline-flex items-center gap-1">
							{entry.href ? (
								<Link href={entry.href} className="transition-colors hover:text-research-accent-strong">
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
	const queryInputRef = useRef<HTMLInputElement>(null)
	const { query, tag, section } = searchQuery

	useEffect(() => {
		if (queryInputRef.current && document.activeElement !== queryInputRef.current) {
			queryInputRef.current.value = query
		}
	}, [query])

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const nextQuery = queryInputRef.current?.value.trim() ?? ''
		const href = buildSearchUrl(routePath, { q: nextQuery, tag, section })
		router.push(href, undefined, { shallow: false, scroll: false })
	}

	return (
		<form
			action={routePath}
			onSubmit={handleSubmit}
			className="group relative flex items-center border-b border-research-heading/20 transition-colors focus-within:border-research-accent-strong dark:border-research-invert/20 dark:focus-within:border-research-invert"
		>
			<Icon
				name="search"
				height={14}
				width={14}
				className="pointer-events-none mr-3 text-research-heading/55 dark:text-on-brand/55"
			/>
			<label className="flex-1">
				<span className="sr-only">Search research</span>
				<input
					ref={queryInputRef}
					name="q"
					defaultValue={query}
					placeholder="Search reports, interviews, authors…"
					className="w-full bg-transparent py-2.5 text-sm text-research-heading placeholder:text-research-heading/40 focus:outline-hidden dark:text-research-ink dark:placeholder:text-on-brand/40"
				/>
			</label>
			<button
				type="submit"
				className="ml-2 inline-flex items-center gap-1 p-1 font-jetbrains text-[11px] tracking-[0.18em] text-research-accent-strong uppercase transition-colors hover:text-research-heading dark:hover:text-research-ink"
			>
				<span>Search</span>
				<span aria-hidden>→</span>
			</button>
		</form>
	)
}

function SectionsPills({ searchQuery, pathname }: { searchQuery: ResearchSearchQuery; pathname: string }) {
	const { query: q, tag, section: activeSection } = searchQuery
	const { data } = useQuery<ArticleSectionListResponse>({
		queryKey: ['research', 'sections'],
		queryFn: () => listArticleSections(6),
		retry: false
	})

	const hrefForSection = (sectionSlug?: string) =>
		buildSearchUrl(pathname, {
			q,
			tag,
			section: sectionSlug && sectionSlug !== activeSection ? sectionSlug : undefined
		})

	const linkBase = 'inline-flex items-center font-jetbrains text-[11px] tracking-[0.18em] uppercase transition-colors'
	const inactive =
		'text-research-heading/55 hover:text-research-accent-strong dark:text-on-brand/55 dark:hover:text-research-ink'
	const active = 'text-research-accent-strong dark:text-research-ink'

	return (
		<div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
			<span className="font-jetbrains text-[10px] tracking-[0.24em] text-research-heading/40 uppercase dark:text-on-brand/40">
				Sections
			</span>
			<Link
				href={hrefForSection()}
				className={`${linkBase} ${!activeSection ? `${active} relative after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:bg-research-accent-strong dark:after:bg-research-white` : inactive}`}
			>
				All
			</Link>
			{data?.sections?.map((s) => {
				const isActive = s.section === activeSection
				return (
					<Link
						key={s.section}
						href={hrefForSection(s.section)}
						className={`${linkBase} ${isActive ? `${active} relative after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:bg-research-accent-strong dark:after:bg-research-white` : inactive}`}
					>
						{humanizeTag(s.section)}
					</Link>
				)
			})}
		</div>
	)
}

function ResultCard({ article }: { article: ArticleDocument }) {
	const cover = resolveCover(article)
	const sectionLabel = article.section ? humanizeTag(article.section) : null
	return (
		<li className="group relative top-0 grid grid-cols-1 gap-3.5 py-5.5 transition-all duration-200 ease-out hover:top-[-2px] sm:grid-cols-[clamp(180px,28vw,260px)_minmax(0,1fr)] sm:gap-6">
			<Link
				href={articleHref(article)}
				aria-label={article.title}
				className="relative aspect-[16/10] w-full overflow-hidden rounded-[7.2px] bg-research-heading/5 dark:bg-research-wash"
			>
				{cover ? (
					<img
						src={cover}
						alt={article.coverImage?.alt}
						loading="lazy"
						decoding="async"
						className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
					/>
				) : (
					<div className="grid size-full place-items-center text-research-heading/20 dark:text-on-brand/20">
						<ResearchIcon name="research-placeholder" className="size-6" aria-hidden />
					</div>
				)}
				{sectionLabel ? (
					<span className="absolute top-[10px] left-[10px] z-[1]">
						<ResultBadge>{sectionLabel}</ResultBadge>
					</span>
				) : null}
			</Link>
			<div className="grid content-start gap-2.5">
				<Link href={articleHref(article)} className="block">
					<h3 className="text-[19px] leading-[130%] font-semibold tracking-tight text-research-heading transition-colors group-hover:text-research-accent-strong sm:text-[22px] dark:text-research-ink dark:group-hover:text-research-accent-soft">
						{article.title}
					</h3>
					{article.excerpt || article.subtitle ? (
						<p className="mt-2.5 line-clamp-2 text-sm leading-[150%] text-research-heading/70 dark:text-on-brand/70">
							{article.excerpt || article.subtitle}
						</p>
					) : null}
				</Link>
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
			page: next
		})
		router.push(href, undefined, { shallow: false, scroll: false })
	}
	const prevPage = Math.max(1, page - 1)
	const nextPage = Math.min(totalPages, page + 1)

	const btnBase =
		'inline-flex items-center gap-2 rounded-[4px] px-3.5 py-1.75 text-xs font-semibold tracking-[0.08em] uppercase transition-colors'
	const enabledStyle =
		'bg-research-accent-tint text-research-accent hover:bg-research-accent-tint-hover dark:border dark:border-research-invert/40 dark:bg-transparent dark:text-research-ink dark:hover:bg-research-wash-strong'
	const disabledStyle =
		'cursor-not-allowed bg-research-heading/5 text-research-heading/30 dark:border dark:border-research-line dark:bg-transparent dark:text-on-brand/30'

	return (
		<nav
			aria-label="Search results pagination"
			className="flex flex-wrap items-center justify-between gap-3 border-t border-research-heading/10 pt-5 dark:border-research-line"
		>
			<span className="font-jetbrains text-[11px] tracking-[0.18em] text-research-heading/55 uppercase tabular-nums dark:text-on-brand/55">
				{rangeStart}–{rangeEnd} of {totalItems.toLocaleString()}
			</span>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => go(prevPage)}
					disabled={page <= 1}
					className={`${btnBase} ${page <= 1 ? disabledStyle : enabledStyle}`}
				>
					<span aria-hidden>←</span>
					<span>Prev</span>
				</button>
				<span className="px-2 font-jetbrains text-xs tracking-[0.12em] text-research-heading/80 tabular-nums dark:text-on-brand/80">
					{page} / {totalPages}
				</span>
				<button
					type="button"
					onClick={() => go(nextPage)}
					disabled={page >= totalPages}
					className={`${btnBase} ${page >= totalPages ? disabledStyle : enabledStyle}`}
				>
					<span>Next</span>
					<span aria-hidden>→</span>
				</button>
			</div>
		</nav>
	)
}

function EmptyState({ query, tag, section }: { query: string; tag: string; section: string }) {
	const hasFilters = Boolean(query || tag || section)
	return (
		<div className="grid place-items-center px-4 py-20 text-center">
			<div className="grid max-w-md gap-3">
				<ResearchIcon
					name="research-search-empty"
					className="mx-auto size-12 text-research-heading/25 dark:text-on-brand/25"
					aria-hidden
				/>
				<h2 className="text-[22px] leading-[130%] font-semibold tracking-tight text-research-heading dark:text-research-ink">
					{hasFilters ? 'Nothing matches that.' : 'No research yet.'}
				</h2>
				<p className="text-sm leading-[150%] text-research-heading/65 dark:text-on-brand/65">
					{hasFilters
						? 'Try a different keyword, drop a filter, or browse the sections below.'
						: 'Once research is published, you can search across reports, interviews, and more from here.'}
				</p>
			</div>
		</div>
	)
}

function ResultsTitle({ query, tag }: { query: string; tag: string }) {
	const cls =
		'text-[clamp(22px,2.6vw,30px)] leading-[120%] font-medium tracking-tight text-research-heading dark:text-research-ink'
	if (query) {
		return (
			<h1 className={cls}>
				<span className="text-research-heading/45 dark:text-on-brand/45">Results for </span>
				<span>"{query}"</span>
			</h1>
		)
	}
	if (tag) {
		return (
			<h1 className={cls}>
				<span className="text-research-heading/45 dark:text-on-brand/45">Tagged </span>
				<span>#{tag}</span>
			</h1>
		)
	}
	return <h1 className={cls}>All Research</h1>
}

export default function ResearchSearch() {
	const router = useRouter()
	const { searchQuery, clearSearchParams } = useResearchSearchParams()
	const { query, tag, section, page } = searchQuery
	const PAGE_SIZE = 24

	const {
		data: response,
		isLoading,
		error
	} = useQuery({
		queryKey: ['research', 'articles', searchQuery],
		queryFn: async () => {
			return listArticles({
				sort: 'newest',
				limit: PAGE_SIZE,
				page,
				query,
				tags: tag ? [tag] : undefined,
				section: section as ArticleSection
			})
		},
		retry: false,
		enabled: router.isReady
	})

	const resultsLoading = !router.isReady || isLoading
	const totalItems = response?.totalItems ?? 0
	const totalPages = response ? Math.max(1, response.totalPages) : 1
	const safePage = Math.min(Math.max(1, page), totalPages)
	const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
	const rangeEnd = Math.min(safePage * PAGE_SIZE, totalItems)

	if (error) {
		const message = error instanceof ArticleApiError ? error.message : 'Failed to load articles'
		return (
			<div className="mx-auto grid w-full max-w-3xl gap-3 border border-error/30 bg-error/5 p-6">
				<h1 className="text-xl font-semibold text-research-heading dark:text-research-ink">Couldn't load research</h1>
				<p className="text-sm text-error">{message}</p>
			</div>
		)
	}

	return (
		<div className="mx-auto grid w-full max-w-6xl gap-7 px-3 pt-4 pb-20 sm:px-6 lg:px-8">
			<header className="grid gap-4 pr-16 lg:pr-0">
				<div className="flex items-baseline justify-between gap-6">
					<span className="font-jetbrains text-[10px] tracking-[0.22em] text-research-accent-strong uppercase">
						Research / Archive
					</span>
					<button
						type="button"
						onClick={clearSearchParams}
						className="shrink-0 font-jetbrains text-[10px] tracking-[0.22em] text-research-heading/50 uppercase transition-colors hover:text-research-accent-strong dark:text-on-brand/50 dark:hover:text-research-ink"
						aria-label="Close search"
					>
						<span className="hidden sm:inline">← Back</span>
						<span className="sm:hidden" aria-hidden>
							×
						</span>
					</button>
				</div>

				<ResultsTitle query={query} tag={tag} />

				<div className="flex items-center gap-x-3 text-research-heading/55 dark:text-on-brand/55">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] uppercase tabular-nums">
						{resultsLoading ? 'Loading…' : `${totalItems.toLocaleString()} ${totalItems === 1 ? 'result' : 'results'}`}
					</span>
					<div className="grow border-t border-research-heading/15 dark:border-research-line" />
				</div>

				<SearchBar searchQuery={searchQuery} routePath={router.pathname} />
				<SectionsPills searchQuery={searchQuery} pathname={router.pathname} />
			</header>

			{resultsLoading ? (
				<div className="grid min-h-[280px] place-items-center py-12">
					<ResearchLoader />
				</div>
			) : response.items.length ? (
				<>
					<ul className="grid divide-y divide-research-heading/10 dark:divide-white/10">
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
				<EmptyState query={query} tag={tag} section={section} />
			)}
		</div>
	)
}
