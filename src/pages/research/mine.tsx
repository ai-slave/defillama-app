import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import { deleteArticle as deleteArticleApi, listMyArticles, type ArticleListResponse } from '~/containers/Articles/api'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import { isScheduled } from '~/containers/Articles/articleSchedule'
import { formatArticleDate } from '~/containers/Articles/editor/ArticleEditorUtils'
import type { ArticleDocument, ArticleSection } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import Layout from '~/layout'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { formatNumber } from '~/utils/numberFormat'

type StatusFilter = 'all' | 'draft' | 'published'
type SortKey = 'updated' | 'created' | 'title'
type SectionFilter = ArticleSection | 'all'

const FETCH_LIMIT = 100
const PAGE_SIZE = 12
const EMPTY_ARTICLES: Array<ArticleDocument> = []

const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: 'draft', label: 'Drafts' },
	{ value: 'published', label: 'Published' }
]

const SORT_LABELS: Record<SortKey, string> = {
	updated: 'Recently updated',
	created: 'Recently created',
	title: 'Title (A–Z)'
}

function wordCount(text: string | undefined): number {
	if (!text) return 0
	const trimmed = text.trim()
	return trimmed ? trimmed.split(/\s+/).length : 0
}

function StatusDot({ status }: { status: ArticleDocument['status'] }) {
	const isPublished = status === 'published'
	return (
		<span
			aria-hidden
			className={`inline-block size-1.5 shrink-0 rounded-full ${isPublished ? 'bg-success' : 'bg-warning'}`}
		/>
	)
}

function MyArticlesContent() {
	const [deleteTarget, setDeleteTarget] = useState<ArticleDocument | null>(null)
	const { authorizedFetch, isAuthenticated, loaders } = useAuthContext()
	const queryClient = useQueryClient()
	const revalidateLanding = useResearchLandingRevalidation()

	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
	const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all')
	const [sortKey, setSortKey] = useState<SortKey>('updated')
	const [searchInput, setSearchInput] = useState('')
	const [page, setPage] = useState(1)
	const search = useDebouncedValue(searchInput, 200).trim().toLowerCase()

	const myArticlesQueryKey = ['research', 'my-articles'] as const
	const { data, isLoading, error } = useQuery({
		queryKey: myArticlesQueryKey,
		queryFn: () => listMyArticles({ limit: FETCH_LIMIT }, authorizedFetch),
		enabled: !loaders.userLoading && isAuthenticated,
		retry: false
	})

	const deleteArticleMutation = useMutation({
		mutationFn: (articleId: string) => deleteArticleApi(articleId, authorizedFetch),
		onSuccess: (_, articleId) => {
			queryClient.setQueryData<ArticleListResponse | undefined>(myArticlesQueryKey, (current) =>
				current ? { ...current, items: current.items.filter((a) => a.id !== articleId) } : current
			)
			revalidateLanding()
		}
	})

	const allArticles = data?.items ?? EMPTY_ARTICLES
	// The access gate renders this list after hydration only, so the clock reads the browser from the first render.
	const nowMs = useNowSeconds() * 1000
	const scheduledCount = useMemo(() => allArticles.filter((a) => isScheduled(a, nowMs)).length, [allArticles, nowMs])
	const draftCount = useMemo(
		() => allArticles.filter((a) => a.status === 'draft' && !isScheduled(a, nowMs)).length,
		[allArticles, nowMs]
	)
	const publishedCount = allArticles.filter((a) => a.status === 'published').length
	const totalCount = allArticles.length
	const capped = data ? data.totalItems > FETCH_LIMIT : false

	const availableSections = useMemo(() => {
		const seen = new Set<ArticleSection>()
		for (const a of allArticles) if (a.section) seen.add(a.section)
		return Array.from(seen)
	}, [allArticles])

	const filtered = useMemo(() => {
		const byStatus = statusFilter === 'all' ? allArticles : allArticles.filter((a) => a.status === statusFilter)
		const bySection = sectionFilter === 'all' ? byStatus : byStatus.filter((a) => a.section === sectionFilter)
		const bySearch = search
			? bySection.filter(
					(a) =>
						(a.title ?? '').toLowerCase().includes(search) ||
						(a.slug ?? '').toLowerCase().includes(search) ||
						(a.excerpt ?? '').toLowerCase().includes(search)
				)
			: bySection
		const sorted = [...bySearch]
		if (sortKey === 'title') {
			sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
		} else if (sortKey === 'created') {
			sorted.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
		} else {
			sorted.sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
		}
		return sorted
	}, [allArticles, statusFilter, sectionFilter, search, sortKey])

	// Any change to the filters or sort restarts at the first page, in the same render as the change.
	const filterKey = `${statusFilter}|${sectionFilter}|${search}|${sortKey}`
	const [syncedFilterKey, setSyncedFilterKey] = useState(filterKey)
	if (filterKey !== syncedFilterKey) {
		setSyncedFilterKey(filterKey)
		setPage(1)
	}

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
	const safePage = Math.min(page, totalPages)
	const paged = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage])
	const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
	const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

	const showLoading = loaders.userLoading || (isAuthenticated && isLoading)

	return (
		<div className="mx-auto grid w-full max-w-5xl gap-8 px-3 pt-2 pb-20 lg:px-0">
			{deleteTarget ? (
				<ConfirmActionDialog
					key={deleteTarget.id}
					title={`Delete ${deleteTarget.title || 'Untitled'}?`}
					description="This permanently deletes the article. This cannot be undone."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deleteArticleMutation}
					variables={deleteTarget.id}
					onClose={() => setDeleteTarget(null)}
				/>
			) : null}
			<header className="grid gap-6 border-b border-medium pb-6">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div className="grid gap-2">
						<span className="font-jetbrains text-[10px] tracking-[0.22em] text-tertiary uppercase">
							Research · Workspace
						</span>
						<h1 className="text-4xl font-semibold tracking-tight text-primary sm:text-5xl">My research</h1>
						{!showLoading ? (
							<p className="text-sm text-secondary">
								<span className="text-primary tabular-nums">{draftCount}</span> draft
								{draftCount === 1 ? '' : 's'}
								{scheduledCount > 0 ? (
									<>
										<span className="mx-2 text-tertiary">·</span>
										<span className="text-primary tabular-nums">{scheduledCount}</span> scheduled
									</>
								) : null}
								<span className="mx-2 text-tertiary">·</span>
								<span className="text-primary tabular-nums">{publishedCount}</span> published
								{capped ? (
									<>
										<span className="mx-2 text-tertiary">·</span>
										<span className="text-tertiary">
											showing latest {FETCH_LIMIT} of {formatNumber(data?.totalItems)}
										</span>
									</>
								) : null}
							</p>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						<Link
							href="/research/profile"
							className="rounded-md border border-medium px-3 py-2 text-sm text-secondary hover:border-link/40 hover:text-primary"
						>
							Edit profile
						</Link>
						<Link
							href="/research"
							className="rounded-md border border-medium px-3 py-2 text-sm text-secondary hover:border-link/40 hover:text-primary"
						>
							Browse all
						</Link>
						<Link
							href="/research/new"
							className="inline-flex items-center gap-1.5 rounded-md bg-link px-3 py-2 text-sm font-medium text-on-brand hover:opacity-90"
						>
							<Icon name="plus" className="size-4" aria-hidden />
							New
						</Link>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
					<SegmentedControl<StatusFilter>
						label="Status"
						variant="default"
						size="md"
						options={STATUS_FILTERS.map(({ value, label }) => ({
							value,
							label: (
								<>
									{label}{' '}
									<span className="tabular-nums opacity-70">
										{value === 'all' ? totalCount : value === 'draft' ? draftCount : publishedCount}
									</span>
								</>
							)
						}))}
						value={statusFilter}
						onValueChange={setStatusFilter}
					/>

					<div className="ml-auto flex flex-wrap items-center gap-2">
						<label className="relative flex items-center">
							<Icon
								name="search"
								className="pointer-events-none absolute left-2.5 size-3.5 text-tertiary"
								aria-hidden
							/>
							<input
								type="search"
								onInput={(e) => setSearchInput(e.currentTarget.value)}
								placeholder="Search title, slug…"
								className="w-44 rounded-md border border-medium bg-surface py-1.5 pr-2 pl-8 text-sm text-primary placeholder:text-tertiary focus:border-link/50 focus:outline-hidden sm:w-56"
							/>
						</label>
						<select
							value={sortKey}
							onChange={(e) => setSortKey(e.target.value as SortKey)}
							className="rounded-md border border-medium bg-surface py-1.5 pr-2 pl-2.5 text-sm text-primary focus:border-link/50 focus:outline-hidden"
							aria-label="Sort"
						>
							{(Object.keys(SORT_LABELS) as Array<SortKey>).map((k) => (
								<option key={k} value={k}>
									{SORT_LABELS[k]}
								</option>
							))}
						</select>
					</div>
				</div>

				{availableSections.length > 0 ? (
					<SegmentedControl<SectionFilter>
						label="Section"
						variant="chips"
						size="sm"
						className="-mt-2"
						options={[
							{ value: 'all', label: 'Any section' },
							...availableSections.map((section) => ({ value: section, label: ARTICLE_SECTION_LABELS[section] }))
						]}
						value={sectionFilter}
						onValueChange={setSectionFilter}
					/>
				) : null}
			</header>

			{error ? (
				<div className="rounded-md border border-error/30 bg-error/5 p-4 text-sm text-error">
					{error instanceof Error ? error.message : 'Failed to load research'}
				</div>
			) : null}

			{showLoading ? (
				<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
					{Array.from({ length: 6 }).map((_, i) => (
						// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
						<li key={i} className="flex items-center gap-3 px-4 py-3.5">
							<span className="size-1.5 shrink-0 rounded-full bg-border-medium" />
							<span className="h-3.5 w-2/3 animate-pulse rounded-sm bg-border-medium" />
							<span className="ml-auto h-3 w-20 animate-pulse rounded-sm bg-border-medium" />
						</li>
					))}
				</ul>
			) : filtered.length === 0 ? (
				<div className="grid gap-3 px-4 py-16 text-center">
					<h2 className="text-2xl font-semibold tracking-tight text-primary">
						{totalCount === 0 ? 'Nothing here yet' : 'No matches'}
					</h2>
					<p className="mx-auto max-w-md text-sm text-secondary">
						{totalCount === 0
							? "Notes turn into drafts the moment you start typing. Publish when you're ready."
							: search || sectionFilter !== 'all' || statusFilter !== 'all'
								? 'Try adjusting the filters or clearing the search.'
								: 'Nothing here.'}
					</p>
					{totalCount === 0 ? (
						<Link
							href="/research/new"
							className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-md bg-link px-3 py-2 text-sm font-medium text-on-brand"
						>
							Write your first
						</Link>
					) : null}
				</div>
			) : (
				<>
					<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
						{paged.map((article) => {
							const words = wordCount(article.plainText) || wordCount(article.excerpt)
							const minutes = words > 0 ? Math.max(1, Math.ceil(words / 220)) : 0
							const isDeleting = deleteArticleMutation.variables === article.id && deleteArticleMutation.isPending
							const scheduled = isScheduled(article, nowMs)
							return (
								<li
									key={article.id}
									className="group relative grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-research-tint-hover"
								>
									<span
										aria-hidden
										className={`absolute top-2 bottom-2 left-0 w-[2px] rounded-r ${
											scheduled
												? 'bg-research-accent/70'
												: article.status === 'draft'
													? 'bg-warning/70'
													: 'bg-transparent'
										}`}
									/>
									<Link href={`/research/edit/${article.id}`} className="grid min-w-0 gap-1">
										<div className="flex min-w-0 flex-wrap items-center gap-2">
											<StatusDot status={article.status} />
											<h3 className="truncate text-base font-semibold tracking-tight text-primary group-hover:text-link">
												{article.title || 'Untitled'}
											</h3>
											{scheduled ? (
												<span
													className="rounded-sm bg-research-tint px-1.5 py-0.5 font-jetbrains text-[10px] tracking-[0.12em] text-link uppercase"
													title={`Goes live ${formatArticleDate(article.goLiveAt)}`}
												>
													Scheduled
												</span>
											) : null}
											{article.viewerRole === 'collaborator' ? (
												<span className="rounded-sm bg-research-tint px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-link uppercase">
													Co-author
												</span>
											) : null}
											{article.section ? (
												<span className="font-jetbrains text-[10px] tracking-[0.14em] text-tertiary uppercase">
													{ARTICLE_SECTION_LABELS[article.section]}
												</span>
											) : null}
										</div>
										<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-tertiary">
											{scheduled ? (
												<span>Scheduled {formatArticleDate(article.goLiveAt)}</span>
											) : (
												<RelativeTime
													value={article.updatedAt}
													prefix={article.status === 'draft' ? 'Saved' : 'Updated'}
													fallback="—"
												/>
											)}
											<span aria-hidden>·</span>
											<span className="truncate font-jetbrains text-[11px]">/{article.slug}</span>
											{words > 0 ? (
												<>
													<span aria-hidden>·</span>
													<span className="tabular-nums">
														{formatNumber(words)} words · {minutes} min
													</span>
												</>
											) : null}
										</div>
									</Link>

									<div className="flex shrink-0 items-center gap-1">
										<Link
											href={{
												pathname: '/research/edit/[id]',
												query: { id: article.id, view: 'preview' }
											}}
											aria-label="Preview in editor"
											title="Preview in editor"
											className="flex size-8 items-center justify-center rounded-md text-tertiary hover:bg-surface hover:text-primary"
										>
											<Icon name="eye" className="size-4" />
										</Link>
										<Link
											href={`/research/edit/${article.id}`}
											className="hidden h-8 items-center gap-1.5 rounded-md border border-medium px-3 text-xs text-secondary hover:border-link/40 hover:text-primary sm:flex"
										>
											Edit
										</Link>
										{article.viewerRole !== 'collaborator' ? (
											<button
												type="button"
												aria-label="Delete"
												title="Delete"
												disabled={isDeleting}
												onClick={() => setDeleteTarget(article)}
												className="flex size-8 items-center justify-center rounded-md text-tertiary hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
											>
												<Icon name="x" className="size-3.5" />
											</button>
										) : null}
									</div>
								</li>
							)
						})}
					</ul>

					{totalPages > 1 ? (
						<div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-tertiary">
							<span className="font-jetbrains text-xs tabular-nums">
								{rangeStart}–{rangeEnd} of {formatNumber(filtered.length)}
							</span>
							<div className="flex items-center gap-1">
								<Ariakit.Button
									type="button"
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={safePage <= 1}
									accessibleWhenDisabled
									className="flex h-8 items-center gap-1 rounded-md border border-medium px-2.5 text-xs text-secondary hover:border-link/40 hover:text-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-medium aria-disabled:hover:text-secondary"
								>
									<span aria-hidden>←</span> Prev
								</Ariakit.Button>
								<span className="px-3 font-jetbrains text-xs tabular-nums">
									{safePage} / {totalPages}
								</span>
								<Ariakit.Button
									type="button"
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									disabled={safePage >= totalPages}
									accessibleWhenDisabled
									className="flex h-8 items-center gap-1 rounded-md border border-medium px-2.5 text-xs text-secondary hover:border-link/40 hover:text-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-medium aria-disabled:hover:text-secondary"
								>
									Next <span aria-hidden>→</span>
								</Ariakit.Button>
							</div>
						</div>
					) : null}
				</>
			)}
		</div>
	)
}

export default function MyArticlesPage() {
	return (
		<Layout
			title="My research - DefiLlama"
			description="Drafts and published research."
			canonicalUrl="/research/mine"
			noIndex
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<ArticlesAccessGate>
					<MyArticlesContent />
				</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
