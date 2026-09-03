import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { listArticles } from '~/containers/Articles/api'
import { articleHref, formatDate, readingMinutes } from '~/containers/Articles/landing/utils'
import { ARTICLE_SECTION_LABELS, type ArticleDocument, type ArticleSection } from '~/containers/Articles/types'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon, type IIcon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { LoadingIndicator } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'

const RESEARCH_SEARCH_LIMIT = 10
const LATEST_RESEARCH_LIMIT = 6

type SectionFilter = {
	value: ArticleSection | null
	label: string
}

const SECTION_FILTERS: SectionFilter[] = [
	{ value: null, label: 'All types' },
	{ value: 'report', label: 'Reports' },
	{ value: 'interview', label: 'Interviews' },
	{ value: 'spotlight', label: 'Spotlights' },
	{ value: 'opinion', label: 'Opinions' },
	{ value: 'roundtables', label: 'Roundtables' },
	{ value: 'press_release', label: 'Press Releases' }
]

const SECTION_ICONS = {
	interview: 'chat',
	report: 'file-text',
	spotlight: 'sparkles',
	opinion: 'align-left',
	roundtables: 'users',
	press_release: 'mail'
} as const satisfies Record<ArticleSection, IIcon['name']>

const RESEARCH_TOPICS = [
	{ label: 'DeFi', query: 'DeFi' },
	{ label: 'RWA', query: 'RWA' },
	{ label: 'Stablecoins', query: 'stablecoin' },
	{ label: 'Bitcoin', query: 'bitcoin' },
	{ label: 'Exchanges', query: 'exchange' },
	{ label: 'Regulation', query: 'regulation' }
] as const

function articleSummary(article: ArticleDocument) {
	return article.excerpt || article.subtitle || article.reportDescription || ''
}

function articleCover(article: ArticleDocument) {
	return article.carouselImage?.url || article.coverImage?.url || null
}

function ArticleVisual({ article, featured = false }: { article: ArticleDocument; featured?: boolean }) {
	const cover = articleCover(article)
	const iconName = article.section ? SECTION_ICONS[article.section] : 'file-text'

	return (
		<span
			className={`relative grid shrink-0 place-items-center overflow-hidden bg-surface-elevated-2 text-link ${
				featured ? 'min-h-28 w-full rounded-lg sm:h-full sm:min-h-36' : 'size-11 rounded-md'
			}`}
			style={
				cover ? { backgroundImage: `url(${cover})`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined
			}
			aria-hidden
		>
			{cover ? <span className="absolute inset-0 bg-research-black/5" /> : <Icon name={iconName} className="size-4" />}
		</span>
	)
}

function ArticleMetadata({ article, compact = false }: { article: ArticleDocument; compact?: boolean }) {
	const sectionLabel = article.section ? ARTICLE_SECTION_LABELS[article.section] : 'Research'
	const publishedLabel = formatDate(article.displayDate ?? article.publishedAt)

	return (
		<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
			<span className="rounded-md bg-brand-faint px-1.5 py-0.5 label-xs text-link-on-tint">{sectionLabel}</span>
			{publishedLabel ? (
				<time dateTime={article.displayDate ?? article.publishedAt ?? undefined} className="body-sm text-tertiary">
					{publishedLabel}
				</time>
			) : null}
			{compact ? null : (
				<>
					<span className="body-sm text-tertiary" aria-hidden>
						·
					</span>
					<span className="body-sm text-tertiary">{readingMinutes(article)} min read</span>
				</>
			)}
		</span>
	)
}

function SearchResult({ article, onSelect }: { article: ArticleDocument; onSelect: () => void }) {
	const summary = articleSummary(article)

	return (
		<li>
			<Link
				href={articleHref(article)}
				onClick={onSelect}
				className="group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover-row focus-visible:bg-hover-row sm:px-3"
			>
				<ArticleVisual article={article} />
				<span className="min-w-0 space-y-1">
					<span className="line-clamp-2 label-md text-primary transition-colors group-hover:text-link">
						{article.title}
					</span>
					{summary ? <span className="hidden truncate body-sm text-tertiary sm:block">{summary}</span> : null}
					<ArticleMetadata article={article} compact />
				</span>
				<span className="grid size-7 place-items-center rounded-md text-tertiary transition-colors group-hover:bg-brand-faint group-hover:text-link">
					<Icon name="chevron-right" className="size-4" aria-hidden />
				</span>
			</Link>
		</li>
	)
}

function FeaturedResult({
	article,
	label,
	onSelect
}: {
	article: ArticleDocument
	label: string
	onSelect: () => void
}) {
	const summary = articleSummary(article)

	return (
		<Link
			href={articleHref(article)}
			onClick={onSelect}
			className="hover-wash group grid grid-cols-[104px_minmax(0,1fr)] gap-3 rounded-xl bg-brand-faint p-2.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4 sm:p-3"
		>
			<ArticleVisual article={article} featured />
			<span className="flex min-w-0 flex-col justify-center gap-2 py-0.5 sm:py-1">
				<span className="flex items-center justify-between gap-2">
					<span className="label-sm text-link-on-tint">{label}</span>
					<Icon name="arrow-up-right" className="size-4 shrink-0 text-link-on-tint" aria-hidden />
				</span>
				<span className="line-clamp-3 heading-xs text-primary transition-colors group-hover:text-link sm:line-clamp-2">
					{article.title}
				</span>
				{summary ? <span className="line-clamp-2 hidden body-sm text-secondary sm:block">{summary}</span> : null}
				<ArticleMetadata article={article} />
			</span>
		</Link>
	)
}

function TopicExplorer({ onSelect }: { onSelect: (query: string) => void }) {
	return (
		<div className="space-y-2 px-2 pt-1 pb-2 sm:px-3">
			<p className="label-sm text-secondary">Explore by topic</p>
			<div className="flex scrollbar-none touch-pan-x gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch]">
				{RESEARCH_TOPICS.map((topic) => (
					<button
						key={topic.label}
						type="button"
						onClick={() => onSelect(topic.query)}
						className="hover-wash shrink-0 rounded-full bg-brand-faint px-2.5 py-1.5 label-sm text-link-on-tint"
					>
						{topic.label}
					</button>
				))}
			</div>
		</div>
	)
}

function EmptyState({ query, section }: { query: string; section: ArticleSection | null }) {
	const sectionLabel = section ? SECTION_FILTERS.find((filter) => filter.value === section)?.label : null

	return (
		<div className="flex min-h-56 flex-col items-center justify-center gap-2 px-6 text-center">
			<span className="mb-1 grid size-10 place-items-center rounded-full bg-brand-faint text-link" aria-hidden>
				<Icon name="search" className="size-4" />
			</span>
			<h3 className="label-lg text-primary">
				{query
					? `No results for “${query}”`
					: sectionLabel
						? `No ${sectionLabel.toLowerCase()} yet`
						: 'No published research yet'}
			</h3>
			<p className="max-w-sm body-sm text-tertiary">
				{query
					? 'Try a different keyword, topic, or format.'
					: sectionLabel
						? 'Choose another format or search across all Research.'
						: 'Published Research content will appear here.'}
			</p>
		</div>
	)
}

export function ResearchSearchDialog({ variant }: { variant: 'desktop' | 'mobile' }) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [section, setSection] = useState<ArticleSection | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const debouncedQuery = useDebouncedValue(query.trim(), 250)
	const resultLimit = debouncedQuery ? RESEARCH_SEARCH_LIMIT : LATEST_RESEARCH_LIMIT
	const activeSection = SECTION_FILTERS.find((filter) => filter.value === section)

	const { data, isLoading, error } = useQuery({
		queryKey: ['research', 'search-dialog', debouncedQuery, section, resultLimit],
		queryFn: () =>
			listArticles({
				query: debouncedQuery,
				limit: resultLimit,
				section: section ?? undefined,
				sort: 'newest'
			}),
		enabled: open,
		retry: false,
		staleTime: 60_000
	})

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) {
			setQuery('')
			setSection(null)
		}
	}

	const selectTopic = (nextQuery: string) => {
		setQuery(nextQuery)
		requestAnimationFrame(() => inputRef.current?.focus())
	}

	const triggerClassName =
		variant === 'mobile'
			? '-my-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-surface/15 text-on-brand shadow transition-colors hover:bg-surface/25 focus-visible:bg-surface/25 active:bg-surface/25 lg:hidden'
			: 'inline-flex h-[45px] min-w-[113px] items-center justify-center gap-2 rounded-full bg-research-white px-4 text-base font-medium text-research-heading transition-colors hover:bg-research-black hover:text-research-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-research-white'

	return (
		<Ariakit.DialogProvider open={open} setOpen={handleOpenChange}>
			<Ariakit.DialogDisclosure type="button" aria-label="Search DefiLlama Research" className={triggerClassName}>
				<Icon name="search" height={20} width={20} aria-hidden />
				{variant === 'desktop' ? <span>Search</span> : null}
			</Ariakit.DialogDisclosure>

			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:700px]`}
				backdrop={<div className="fixed inset-0 z-50 bg-screen-dim" />}
				initialFocus={inputRef}
				portal
			>
				<div className="flex items-start gap-3 px-4 pt-4 pb-3">
					<div className="min-w-0">
						<DialogHeading>Search Research</DialogHeading>
						<p className="mt-0.5 body-sm text-tertiary">Discover analysis across every Research format.</p>
					</div>
					<DialogCloseButton className="-mt-1 -mr-1 ml-auto" ariaLabel="Close Research search" />
				</div>

				<div className="px-4 pb-3">
					<div className="relative">
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} aria-hidden />
						<Input
							ref={inputRef}
							type="text"
							role="searchbox"
							inputMode="search"
							enterKeyHint="search"
							aria-label="Search Research"
							value={query}
							onChange={(event) => setQuery(event.currentTarget.value)}
							placeholder="Search topics, protocols, or titles…"
							className={`${searchFieldInputPlacementStyles} ${query ? 'pr-9' : ''}`}
						/>
						{query ? (
							<button
								type="button"
								onClick={() => {
									setQuery('')
									inputRef.current?.focus()
								}}
								aria-label="Clear search"
								className="absolute top-0 right-1 bottom-0 my-auto grid size-7 place-items-center rounded-md text-tertiary transition-colors hover:bg-hover-row hover:text-primary"
							>
								<Icon name="x" className="size-4" aria-hidden />
							</button>
						) : null}
					</div>
				</div>

				<nav className="border-t border-subtle px-4 py-3" aria-label="Research content types">
					<p className="mb-2 label-sm text-secondary">Browse by format</p>
					<div className="flex scrollbar-none touch-pan-x gap-1 overflow-x-auto rounded-lg bg-surface-elevated-1 p-1 [-webkit-overflow-scrolling:touch]">
						{SECTION_FILTERS.map((filter) => {
							const active = filter.value === section
							return (
								<button
									key={filter.label}
									type="button"
									onClick={() => setSection(filter.value)}
									aria-pressed={active}
									className={`shrink-0 rounded-md px-2.5 py-1.5 label-sm transition-colors ${
										active ? 'bg-brand text-on-brand' : 'text-secondary hover:bg-hover-row hover:text-primary'
									}`}
								>
									{filter.label}
								</button>
							)
						})}
					</div>
				</nav>

				<div className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-2">
					<p className="label-sm text-secondary">
						{debouncedQuery ? 'Search results' : section ? activeSection?.label : 'Featured & latest'}
					</p>
					<p className="body-sm text-tertiary" aria-live="polite">
						{data
							? debouncedQuery
								? `${formatNumber(data.totalItems)} ${data.totalItems === 1 ? 'result' : 'results'}`
								: `${data.items.length} newest`
							: 'Searching…'}
					</p>
				</div>

				<div className={`${dialogScrollableBodyStyles} min-h-64 border-t border-subtle p-2`}>
					{isLoading ? (
						<div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite">
							<LoadingIndicator label="Searching Research" />
						</div>
					) : error ? (
						<div className="flex min-h-64 items-center justify-center px-6 text-center">
							<p role="alert" className="body-sm text-data-down">
								Couldn&apos;t load Research results. Please try again.
							</p>
						</div>
					) : data?.items.length ? (
						<div className="space-y-2">
							{debouncedQuery ? null : <TopicExplorer onSelect={selectTopic} />}
							{debouncedQuery ? null : (
								<FeaturedResult
									article={data.items[0]}
									label={section ? `Latest ${ARTICLE_SECTION_LABELS[section]}` : 'Latest from Research'}
									onSelect={() => handleOpenChange(false)}
								/>
							)}
							{data.items.length > 1 || debouncedQuery ? (
								<ul className="space-y-0.5">
									{(debouncedQuery ? data.items : data.items.slice(1)).map((article) => (
										<SearchResult key={article.id} article={article} onSelect={() => handleOpenChange(false)} />
									))}
								</ul>
							) : null}
						</div>
					) : (
						<EmptyState query={debouncedQuery} section={section} />
					)}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
