import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { Select } from '~/components/Select/Select'
import { TablePager } from '~/components/Table/TablePager'
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
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles } from '~/ui/Input'
import { RelativeTime } from '~/ui/RelativeTime'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Skeleton } from '~/ui/Skeleton'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { httpErrorMessage } from '~/utils/async'
import { formatNumber } from '~/utils/numberFormat'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'

type StatusFilter = 'all' | 'draft' | 'published'
type SortKey = 'updated' | 'created' | 'title'
type SectionFilter = ArticleSection | 'all'

const FETCH_LIMIT = 100
const PAGE_SIZE = 12
const EMPTY_ARTICLES: Array<ArticleDocument> = []

const SORT_LABELS: Record<SortKey, string> = {
	updated: 'Recently updated',
	created: 'Recently created',
	title: 'Title (A–Z)'
}
const SORT_OPTIONS = [
	{ key: 'updated', name: SORT_LABELS.updated },
	{ key: 'created', name: SORT_LABELS.created },
	{ key: 'title', name: SORT_LABELS.title }
]

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
	// The neighbour row's Delete is read when the confirm opens: the delete's success drops the row from the list.
	const [deleteTarget, setDeleteTarget] = useState<{
		article: ArticleDocument
		neighbour: HTMLElement | null | undefined
	} | null>(null)
	const returnFocusRef = useRef<HTMLElement | null>(null)
	const newArticleRef = useRef<HTMLAnchorElement>(null)
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
	const myArticlesQuery = useQuery({
		queryKey: myArticlesQueryKey,
		queryFn: () => listMyArticles({ limit: FETCH_LIMIT }, authorizedFetch),
		enabled: !loaders.userLoading && isAuthenticated,
		retry: false
	})
	const { data, isLoading, error } = myArticlesQuery
	const failed = queryReadFailed(myArticlesQuery)

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
					key={deleteTarget.article.id}
					title={`Delete ${deleteTarget.article.title || 'Untitled'}?`}
					description="This permanently deletes the article. This cannot be undone."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deleteArticleMutation}
					variables={deleteTarget.article.id}
					errorMessage="Couldn't delete the article."
					finalFocus={returnFocusRef}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => {
						returnFocusRef.current = deleteTarget.neighbour ?? newArticleRef.current
					}}
				/>
			) : null}
			<header className="grid gap-6 border-b border-medium pb-6">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div className="grid gap-2">
						<span className="label-xs tracking-[0.22em] text-tertiary uppercase">Research · Workspace</span>
						<h1 className="heading-lg tracking-tight text-primary">My research</h1>
						{!showLoading ? (
							<p className="body-md text-secondary">
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
						<Button as={Link} variant="secondary" size="md" href="/research/profile">
							Edit profile
						</Button>
						<Button as={Link} variant="secondary" size="md" href="/research">
							Browse all
						</Button>
						<Button ref={newArticleRef} as={Link} variant="primary" size="md" href="/research/new">
							<Icon name="plus" className="size-3.5" />
							New
						</Button>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
					<SegmentedControl<StatusFilter>
						label="Status"
						variant="default"
						size="md"
						options={[
							{
								value: 'all',
								label: (
									<>
										All <span className="tabular-nums opacity-70">{totalCount}</span>
									</>
								)
							},
							{
								value: 'draft',
								label: (
									<>
										Drafts <span className="tabular-nums opacity-70">{draftCount}</span>
									</>
								)
							},
							{
								value: 'published',
								label: (
									<>
										Published <span className="tabular-nums opacity-70">{publishedCount}</span>
									</>
								)
							}
						]}
						value={statusFilter}
						onValueChange={setStatusFilter}
					/>

					{/* One row at every width: on a phone the search takes what the sort select leaves. */}
					<div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
						<label className="relative flex min-w-0 flex-1 items-center">
							<Icon name="search" className={searchFieldIconStyles} aria-hidden />
							<Input
								type="search"
								onInput={(e) => setSearchInput(e.currentTarget.value)}
								placeholder="Search title, slug…"
								className="w-full pl-8 sm:w-56"
							/>
						</label>
						<Select
							allValues={SORT_OPTIONS}
							selectedValues={sortKey}
							setSelectedValues={(value: string) => setSortKey(value as SortKey)}
							label={SORT_LABELS[sortKey]}
							labelType="none"
							heading="Sort"
							variant="input"
							size="md"
							className="shrink-0"
							triggerProps={{ 'aria-label': 'Sort' }}
						/>
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

			{/* A failed refresh keeps the list below, with this notice above it. */}
			{failed || queryRefreshFailed(myArticlesQuery) ? (
				<InlineStatus variant="error" retry={myArticlesQuery}>
					{httpErrorMessage(error, "Couldn't load your research.")}
				</InlineStatus>
			) : null}

			{/* A failed first read has no list to show: the error above says why, rather than an empty list. */}
			{failed ? null : showLoading ? (
				<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
					{Array.from({ length: 6 }).map((_, i) => (
						// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
						<li key={i} className="flex items-center gap-3 px-4 py-3.5">
							<Skeleton className="size-1.5 shrink-0 rounded-full" />
							<Skeleton className="h-3.5 w-2/3" />
							<Skeleton className="ml-auto h-3 w-20" />
						</li>
					))}
				</ul>
			) : filtered.length === 0 ? (
				<div className="grid gap-3 px-4 py-16 text-center">
					<h2 className="heading-sm tracking-tight text-primary">
						{totalCount === 0 ? 'Nothing here yet' : 'No matches'}
					</h2>
					<p className="mx-auto max-w-md body-md text-secondary">
						{totalCount === 0
							? "Notes turn into drafts the moment you start typing. Publish when you're ready."
							: search || sectionFilter !== 'all' || statusFilter !== 'all'
								? 'Try adjusting the filters or clearing the search.'
								: 'Nothing here.'}
					</p>
					{totalCount === 0 ? (
						<Button as={Link} variant="primary" size="md" href="/research/new" className="mx-auto mt-3">
							Write your first
						</Button>
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
									className="group relative grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-hover-row"
								>
									<span
										aria-hidden
										className={`absolute top-2 bottom-2 left-0 w-[2px] rounded-r ${
											scheduled ? 'bg-brand' : article.status === 'draft' ? 'bg-warning' : 'bg-transparent'
										}`}
									/>
									<Link href={`/research/edit/${article.id}`} className="grid min-w-0 gap-1">
										<div className="flex min-w-0 flex-wrap items-center gap-2">
											<StatusDot status={article.status} />
											<h3 className="truncate title-lg tracking-tight text-primary group-hover:text-link">
												{article.title || 'Untitled'}
											</h3>
											{scheduled ? (
												<span
													className="rounded-sm bg-brand-muted px-1.5 py-0.5 label-xs tracking-[0.12em] text-link uppercase"
													title={`Goes live ${formatArticleDate(article.goLiveAt)}`}
												>
													Scheduled
												</span>
											) : null}
											{article.viewerRole === 'collaborator' ? (
												<span className="rounded-sm bg-brand-muted px-1.5 py-0.5 label-xs tracking-wide text-link uppercase">
													Co-author
												</span>
											) : null}
											{article.section ? (
												<span className="label-xs tracking-[0.14em] text-tertiary uppercase">
													{ARTICLE_SECTION_LABELS[article.section]}
												</span>
											) : null}
										</div>
										<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 body-sm text-tertiary">
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
											<span className="truncate mono-sm">/{article.slug}</span>
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
										<Tooltip
											content="Preview in editor"
											render={
												<Button
													as={Link}
													variant="ghost"
													size="md"
													square
													href={{
														pathname: '/research/edit/[id]',
														query: { id: article.id, view: 'preview' }
													}}
													aria-label="Preview in editor"
												/>
											}
										>
											<Icon name="eye" className="size-4" />
										</Tooltip>
										<Button
											as={Link}
											variant="secondary"
											size="md"
											href={`/research/edit/${article.id}`}
											className="max-sm:hidden"
										>
											Edit
										</Button>
										{article.viewerRole !== 'collaborator' ? (
											<Tooltip
												content="Delete"
												render={
													<Button
														variant="ghostDestructive"
														size="md"
														square
														aria-label={`Delete ${article.title || 'untitled article'}`}
														disabled={isDeleting}
														onClick={(event) => {
															returnFocusRef.current = null
															setDeleteTarget({
																article,
																neighbour: neighbourRowControl(event.currentTarget.closest('li')!, event.currentTarget)
															})
														}}
													/>
												}
											>
												<Icon name="trash-2" className="size-4" />
											</Tooltip>
										) : null}
									</div>
								</li>
							)
						})}
					</ul>

					{totalPages > 1 ? (
						<TablePager
							pageIndex={safePage - 1}
							pageCount={totalPages}
							onPageChange={(index) => setPage(index + 1)}
							range={{ from: rangeStart, to: rangeEnd, total: filtered.length }}
							className="px-1"
						/>
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
