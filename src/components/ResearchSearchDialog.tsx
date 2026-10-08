import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { listArticles } from '~/containers/Articles/api'
import { articleHref, formatDate, readingMinutes } from '~/containers/Articles/landing/utils'
import { listResearchNewsletterItems, type ResearchNewsletterItem } from '~/containers/Articles/newsletterFeed'
import { ARTICLE_SECTION_LABELS, type ArticleDocument, type ArticleSection } from '~/containers/Articles/types'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogHeader, DialogToolbar, useOpeningKey } from '~/ui/Dialog'
import { Icon, type IIcon } from '~/ui/Icon'
import { SearchField } from '~/ui/SearchField'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'

const RESEARCH_SEARCH_LIMIT = 10
const LATEST_RESEARCH_LIMIT = 6

type SearchContentType = ArticleSection | 'newsletter'
type SearchDialogVariant = 'desktop' | 'article' | 'mobile'

type SectionFilter = {
	value: SearchContentType | null
	label: string
	itemLabel: string
}

const SECTION_FILTERS: Array<SectionFilter> = [
	{ value: null, label: 'All types', itemLabel: 'Content' },
	{ value: 'report', label: 'Reports', itemLabel: 'Report' },
	{ value: 'interview', label: 'Interviews', itemLabel: 'Interview' },
	{ value: 'spotlight', label: 'Spotlights', itemLabel: 'Spotlight' },
	{ value: 'opinion', label: 'Opinions', itemLabel: 'Opinion' },
	{ value: 'roundtables', label: 'Roundtables', itemLabel: 'Roundtable' },
	{ value: 'newsletter', label: 'Newsletters', itemLabel: 'Newsletter' }
]

const SECTION_ICONS = {
	interview: 'chat',
	report: 'file-text',
	spotlight: 'sparkles',
	opinion: 'align-left',
	roundtables: 'users',
	press_release: 'mail'
} as const satisfies Record<ArticleSection, IIcon['name']>

const SEARCH_TRIGGER_STYLES: Record<SearchDialogVariant, string> = {
	mobile:
		'-my-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-on-brand-control text-on-brand shadow transition-colors hover:bg-on-brand-control-hover focus-visible:bg-on-brand-control-hover active:bg-on-brand-control-hover lg:hidden',
	article:
		'hidden h-11 min-w-[113px] items-center justify-center gap-2 rounded-full border border-medium bg-surface px-4 label-md text-primary transition-colors hover:border-brand hover:text-link lg:inline-flex',
	desktop:
		'inline-flex h-[45px] min-w-[113px] items-center justify-center gap-2 rounded-full bg-research-white px-4 label-lg text-research-heading transition-colors hover:bg-research-black hover:text-research-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-research-white'
}

const RESEARCH_TOPICS = [
	{ label: 'DeFi', query: 'DeFi' },
	{ label: 'RWA', query: 'RWA' },
	{ label: 'Stablecoins', query: 'stablecoin' },
	{ label: 'Bitcoin', query: 'bitcoin' },
	{ label: 'Exchanges', query: 'exchange' },
	{ label: 'Regulation', query: 'regulation' }
] as const

type ResearchSearchItem = {
	id: string
	title: string
	description: string
	href: string
	imageUrl: string | null
	publishedAt: string | null
	typeLabel: string
	iconName: IIcon['name']
	readMinutes: number | null
	external: boolean
}

type ResearchSearchResponse = {
	items: Array<ResearchSearchItem>
	totalItems: number
}

function articleSummary(article: ArticleDocument) {
	return article.excerpt || article.subtitle || article.reportDescription || ''
}

function articleCover(article: ArticleDocument) {
	return article.carouselImage?.url || article.coverImage?.url || null
}

function normalizeArticle(article: ArticleDocument): ResearchSearchItem {
	return {
		id: `research-${article.id}`,
		title: article.title,
		description: articleSummary(article),
		href: articleHref(article),
		imageUrl: articleCover(article),
		publishedAt: article.displayDate ?? article.publishedAt ?? null,
		typeLabel: article.section ? ARTICLE_SECTION_LABELS[article.section] : 'Research',
		iconName: article.section ? SECTION_ICONS[article.section] : 'file-text',
		readMinutes: readingMinutes(article),
		external: false
	}
}

function normalizeNewsletter(item: ResearchNewsletterItem): ResearchSearchItem {
	return {
		id: `newsletter-${item.id}`,
		title: item.title,
		description:
			item.description === 'Research Notes' ? 'The latest edition of Research Notes.' : (item.description ?? ''),
		href: item.href,
		imageUrl: item.imageUrl,
		publishedAt: item.publishedAt,
		typeLabel: 'Newsletter',
		iconName: 'mail',
		readMinutes: null,
		external: true
	}
}

function publishedAtTimestamp(item: ResearchSearchItem) {
	if (!item.publishedAt) return 0
	const timestamp = new Date(item.publishedAt).getTime()
	return Number.isNaN(timestamp) ? 0 : timestamp
}

async function searchResearchContent(
	query: string,
	section: SearchContentType | null,
	limit: number
): Promise<ResearchSearchResponse> {
	const includeResearch = section !== 'newsletter'
	const includeNewsletters = section === null || section === 'newsletter'
	const articleSection = section && section !== 'newsletter' ? section : undefined

	const [researchResult, newsletterResult] = await Promise.allSettled([
		includeResearch ? listArticles({ query, limit, section: articleSection, sort: 'newest' }) : Promise.resolve(null),
		includeNewsletters ? listResearchNewsletterItems({ query, limit }) : Promise.resolve(null)
	])

	const researchFailed = includeResearch && researchResult.status === 'rejected'
	const newslettersFailed = includeNewsletters && newsletterResult.status === 'rejected'
	if (
		(researchFailed && !includeNewsletters) ||
		(newslettersFailed && !includeResearch) ||
		(researchFailed && newslettersFailed)
	) {
		throw researchResult.status === 'rejected'
			? researchResult.reason
			: newsletterResult.status === 'rejected'
				? newsletterResult.reason
				: new Error('Search failed')
	}

	const research = researchResult.status === 'fulfilled' ? researchResult.value : null
	const newsletters = newsletterResult.status === 'fulfilled' ? newsletterResult.value : null
	const items = [
		...(research?.items.map(normalizeArticle) ?? []),
		...(newsletters?.items.map(normalizeNewsletter) ?? [])
	]
		.sort((left, right) => publishedAtTimestamp(right) - publishedAtTimestamp(left))
		.slice(0, limit)

	return {
		items,
		totalItems: (research?.totalItems ?? 0) + (newsletters?.totalItems ?? 0)
	}
}

function ResultVisual({ item, featured = false }: { item: ResearchSearchItem; featured?: boolean }) {
	return (
		<span
			className={`relative grid shrink-0 place-items-center overflow-hidden bg-surface-elevated-2 text-link ${
				featured ? 'min-h-28 w-full rounded-lg sm:h-full sm:min-h-36' : 'size-11 rounded-md'
			}`}
			style={
				item.imageUrl
					? { backgroundImage: `url(${item.imageUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' }
					: undefined
			}
			aria-hidden
		>
			{item.imageUrl ? (
				<span className="absolute inset-0 bg-research-black/5" />
			) : (
				<Icon name={item.iconName} className="size-4" />
			)}
		</span>
	)
}

function ResultMetadata({ item, compact = false }: { item: ResearchSearchItem; compact?: boolean }) {
	const publishedLabel = formatDate(item.publishedAt)

	return (
		<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
			<span className="rounded-md bg-brand-faint px-1.5 py-0.5 label-xs text-link">{item.typeLabel}</span>
			{publishedLabel ? (
				<time dateTime={item.publishedAt ?? undefined} className="body-sm text-tertiary">
					{publishedLabel}
				</time>
			) : null}
			{compact || item.readMinutes === null ? null : (
				<>
					<span className="body-sm text-tertiary" aria-hidden>
						·
					</span>
					<span className="body-sm text-tertiary">{item.readMinutes} min read</span>
				</>
			)}
		</span>
	)
}

function SearchResult({ item, onSelect }: { item: ResearchSearchItem; onSelect: () => void }) {
	return (
		<li>
			<Link
				href={item.href}
				target={item.external ? '_blank' : undefined}
				rel={item.external ? 'noreferrer noopener' : undefined}
				onClick={onSelect}
				className="group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover-row focus-visible:bg-hover-row sm:px-3"
			>
				<ResultVisual item={item} />
				<span className="min-w-0 space-y-1">
					<span className="line-clamp-2 label-md text-primary transition-colors group-hover:text-link">
						{item.title}
					</span>
					{item.description ? (
						<span className="hidden truncate body-sm text-tertiary sm:block">{item.description}</span>
					) : null}
					<ResultMetadata item={item} compact />
				</span>
				<span className="grid size-7 place-items-center rounded-md text-tertiary transition-colors group-hover:bg-brand-faint group-hover:text-link">
					<Icon name={item.external ? 'arrow-up-right' : 'chevron-right'} className="size-4" aria-hidden />
				</span>
			</Link>
		</li>
	)
}

function FeaturedResult({ item, label, onSelect }: { item: ResearchSearchItem; label: string; onSelect: () => void }) {
	return (
		<Link
			href={item.href}
			target={item.external ? '_blank' : undefined}
			rel={item.external ? 'noreferrer noopener' : undefined}
			onClick={onSelect}
			className="group grid grid-cols-[104px_minmax(0,1fr)] gap-3 rounded-xl bg-brand-faint p-2.5 hover:bg-brand-tint focus-visible:bg-brand-tint sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4 sm:p-3"
		>
			<ResultVisual item={item} featured />
			<span className="flex min-w-0 flex-col justify-center gap-2 py-0.5 sm:py-1">
				<span className="flex items-center justify-between gap-2">
					<span className="label-sm text-link">{label}</span>
					<Icon name="arrow-up-right" className="size-4 shrink-0 text-link" aria-hidden />
				</span>
				<span className="line-clamp-3 heading-xs text-primary transition-colors group-hover:text-link sm:line-clamp-2">
					{item.title}
				</span>
				{item.description ? (
					<span className="line-clamp-2 hidden body-sm text-secondary sm:block">{item.description}</span>
				) : null}
				<ResultMetadata item={item} />
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
					<Button key={topic.label} size="sm" onClick={() => onSelect(topic.query)}>
						{topic.label}
					</Button>
				))}
			</div>
		</div>
	)
}

function EmptyState({ query, section }: { query: string; section: SearchContentType | null }) {
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
						: 'No published content yet'}
			</h3>
			<p className="max-w-sm body-sm text-tertiary">
				{query
					? 'Try a different keyword, topic, or format.'
					: sectionLabel
						? 'Choose another format or search across all content.'
						: 'Published Research and newsletter content will appear here.'}
			</p>
		</div>
	)
}

function SearchDialogTrigger({ variant }: { variant: SearchDialogVariant }) {
	return (
		<Ariakit.DialogDisclosure
			type="button"
			aria-label="Search DefiLlama Research and Newsletters"
			className={SEARCH_TRIGGER_STYLES[variant]}
		>
			<Icon name="search" height={20} width={20} aria-hidden />
			{variant !== 'mobile' ? <span>Search</span> : null}
		</Ariakit.DialogDisclosure>
	)
}

const SECTION_OPTIONS = SECTION_FILTERS.map((filter) => ({ value: filter.value ?? 'all', label: filter.label }))

function SearchResultsHeader({
	data,
	failed,
	query,
	section,
	activeSection
}: {
	data: ResearchSearchResponse | undefined
	/** The list below says the search failed; the count stays quiet instead of claiming one is running. */
	failed: boolean
	query: string
	section: SearchContentType | null
	activeSection: SectionFilter | undefined
}) {
	let resultCount = failed ? '' : 'Searching…'
	if (data) {
		resultCount = query
			? `${formatNumber(data.totalItems)} ${data.totalItems === 1 ? 'result' : 'results'}`
			: `${data.items.length} newest`
	}

	return (
		<div className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-2">
			<p className="label-sm text-secondary">
				{query ? 'Search results' : section ? activeSection?.label : 'Featured & latest'}
			</p>
			<p className="body-sm text-tertiary" aria-live="polite">
				{resultCount}
			</p>
		</div>
	)
}

function SearchResults({
	data,
	isLoading,
	failed,
	retrying,
	query,
	section,
	activeSection,
	onSelectTopic,
	onSelectResult,
	onRetry
}: {
	data: ResearchSearchResponse | undefined
	isLoading: boolean
	failed: boolean
	retrying: boolean
	onRetry: () => void
	query: string
	section: SearchContentType | null
	activeSection: SectionFilter | undefined
	onSelectTopic: (query: string) => void
	onSelectResult: () => void
}) {
	if (failed) {
		return (
			<div className="p-2">
				<InlineStatus variant="error">
					<span className="flex flex-wrap items-center justify-between gap-2">
						Couldn&rsquo;t load search results.
						<Button type="button" size="sm" pendingLabel={retrying ? 'Retrying…' : null} onClick={onRetry}>
							Try again
						</Button>
					</span>
				</InlineStatus>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite">
				<LoadingIndicator label="Searching Research and newsletters" />
			</div>
		)
	}

	if (!data?.items.length) return <EmptyState query={query} section={section} />

	return (
		<div className="space-y-2">
			{query ? null : <TopicExplorer onSelect={onSelectTopic} />}
			{query ? null : (
				<FeaturedResult
					item={data.items[0]}
					label={section ? `Latest ${activeSection?.itemLabel ?? 'content'}` : 'Latest published'}
					onSelect={onSelectResult}
				/>
			)}
			{data.items.length > 1 || query ? (
				<ul className="space-y-0.5">
					{(query ? data.items : data.items.slice(1)).map((item) => (
						<SearchResult key={item.id} item={item} onSelect={onSelectResult} />
					))}
				</ul>
			) : null}
		</div>
	)
}

export function ResearchSearchDialog({ variant }: { variant: SearchDialogVariant }) {
	const [open, setOpen] = useState(false)
	const opening = useOpeningKey(open)
	return (
		<Ariakit.DialogProvider open={open} setOpen={setOpen}>
			<SearchDialogTrigger variant={variant} />
			<Dialog size="md" fullSheet portal unmountOnHide>
				<ResearchSearch key={opening} onSelectResult={() => setOpen(false)} />
			</Dialog>
		</Ariakit.DialogProvider>
	)
}

/** One opening's search: the query and format start empty each time the dialog opens. */
function ResearchSearch({ onSelectResult }: { onSelectResult: () => void }) {
	const [query, setQuery] = useState('')
	const [section, setSection] = useState<SearchContentType | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const debouncedQuery = useDebouncedValue(query.trim(), 250)
	const resultLimit = debouncedQuery ? RESEARCH_SEARCH_LIMIT : LATEST_RESEARCH_LIMIT
	const activeSection = SECTION_FILTERS.find((filter) => filter.value === section)

	const searchQuery = useQuery({
		queryKey: ['research', 'search-dialog', debouncedQuery, section, resultLimit],
		queryFn: () => searchResearchContent(debouncedQuery, section, resultLimit),
		retry: false,
		staleTime: 60_000
	})
	const { data, isLoading, isFetching, refetch } = searchQuery

	return (
		<>
			<DialogHeader title="Search Research & newsletters" subtitle="Find published analysis and Research Notes." />
			<DialogToolbar>
				<div className="flex flex-col gap-3">
					{/* Opening the search means typing, so the field takes focus on phones too. */}
					<SearchField
						ref={inputRef}
						autoFocus
						label="Search Research and newsletters"
						placeholder="Search topics, protocols, or titles…"
						value={query}
						onChange={setQuery}
					/>
					<SegmentedControl
						label="Content type"
						variant="chips"
						size="md"
						options={SECTION_OPTIONS}
						value={section ?? 'all'}
						onValueChange={(value) => setSection(value === 'all' ? null : (value as SearchContentType))}
					/>
				</div>
			</DialogToolbar>
			<SearchResultsHeader
				data={data}
				failed={queryReadFailed(searchQuery)}
				query={debouncedQuery}
				section={section}
				activeSection={activeSection}
			/>
			<DialogBody kind="list">
				<SearchResults
					data={data}
					isLoading={isLoading}
					failed={queryReadFailed(searchQuery)}
					retrying={isFetching}
					query={debouncedQuery}
					section={section}
					activeSection={activeSection}
					onSelectTopic={(nextQuery) => {
						setQuery(nextQuery)
						inputRef.current?.focus()
					}}
					onSelectResult={onSelectResult}
					onRetry={() => void refetch()}
				/>
			</DialogBody>
		</>
	)
}
