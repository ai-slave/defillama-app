import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { DialogBackButton, DialogBody, DialogHeader, SideSheet } from '~/ui/Dialog'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Keycap } from '~/ui/Keycap'
import { ListRow } from '~/ui/ListRow'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { StatusBadge } from '~/ui/StatusBadge'
import { queryReadFailed } from '~/utils/query'
import {
	deleteArticleRevision,
	getArticleRevision,
	listArticleRevisions,
	restoreArticleRevisionToPending
} from '../api'
import { ArticleRenderer } from '../renderer/ArticleRenderer'
import type {
	ArticleDocument,
	ArticleRevision,
	ArticleRevisionEventType,
	ArticleRevisionSummary,
	LocalArticleDocument
} from '../types'
import { articleWriteKey, cacheWrittenArticle } from './ArticleEditorUtils'
import { diffMetadata, diffParagraphs, diffStats, type FieldChange, type ParagraphDiffOp } from './revisionDiff'

type AuthorizedFetch = (url: string, options?: RequestInit) => Promise<Response | null>

type Props = {
	onClose: () => void
	articleId: string
	authorizedFetch: AuthorizedFetch
	/** Sends the editor's unsaved edits, so a restore never drops them unseen. Resolves false when that save fails. */
	saveEdits: () => Promise<boolean>
	onRestored: (article: ArticleDocument) => void
}

type FilterKey = 'all' | 'edits' | 'publishes' | 'pending' | 'restores'

/** Why the chosen diff base cannot be used: the selected revision is that base, or no such revision exists. */
type BaseUnavailable = 'self' | 'missing'
type ViewMode = 'preview' | 'diff'
type BaseMode = 'previous' | 'live' | 'pending'
const EMPTY_ARTICLE_REVISIONS: Array<ArticleRevisionSummary> = []

const EVENT_LABELS: Record<ArticleRevisionEventType, string> = {
	create: 'Created',
	save: 'Draft saved',
	publish: 'Published',
	schedule: 'Scheduled',
	unpublish: 'Unpublished',
	delete: 'Deleted',
	pending_save: 'Pending edit',
	discard_pending: 'Pending discarded',
	restore_pending: 'Restored from history'
}

const BASE_UNAVAILABLE_TEXT: Record<BaseMode, Record<BaseUnavailable, string>> = {
	previous: {
		self: 'This is the oldest revision. Pick a later revision, or compare against Live or Pending.',
		missing: 'This is the oldest revision. Pick a later revision, or compare against Live or Pending.'
	},
	live: {
		self: 'This is the live revision. Pick another revision, or compare against Previous or Pending.',
		missing: 'No live revision is recorded. Compare against Previous or Pending instead.'
	},
	pending: {
		self: 'This is the pending revision. Pick another revision, or compare against Previous or Live.',
		missing: 'No pending revision is recorded. Compare against Previous or Live instead.'
	}
}

const EVENT_TONES: Record<ArticleRevisionEventType, string> = {
	create: 'text-secondary',
	save: 'text-secondary',
	publish: 'text-success',
	schedule: 'text-link',
	unpublish: 'text-warning',
	delete: 'text-error',
	pending_save: 'text-warning',
	discard_pending: 'text-tertiary',
	restore_pending: 'text-link'
}

const FILTER_LABELS: Record<FilterKey, string> = {
	all: 'All',
	publishes: 'Publishes',
	pending: 'Pending',
	edits: 'Drafts',
	restores: 'Restores'
}

const FILTER_KEYS: Array<FilterKey> = ['all', 'publishes', 'pending', 'edits', 'restores']

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
	{ value: 'preview', label: 'Preview' },
	{ value: 'diff', label: 'Diff' }
]

const BASE_OPTIONS: Array<{ value: BaseMode; label: string }> = [
	{ value: 'previous', label: 'Previous' },
	{ value: 'live', label: 'Live' },
	{ value: 'pending', label: 'Pending' }
]

const FILTER_MATCH: Record<FilterKey, (e: ArticleRevisionEventType) => boolean> = {
	all: () => true,
	publishes: (e) => e === 'publish' || e === 'schedule' || e === 'unpublish' || e === 'create',
	pending: (e) => e === 'pending_save' || e === 'discard_pending',
	edits: (e) => e === 'save',
	restores: (e) => e === 'restore_pending'
}

function formatExact(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	})
}

function formatTime(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDayKey(iso: string): { key: string; label: string } {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return { key: iso, label: iso }
	const today = new Date()
	const isToday = d.toDateString() === today.toDateString()
	const yesterday = new Date()
	yesterday.setDate(yesterday.getDate() - 1)
	const isYesterday = d.toDateString() === yesterday.toDateString()
	const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
	const label = isToday
		? 'Today'
		: isYesterday
			? 'Yesterday'
			: d.toLocaleDateString(undefined, {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric'
				})
	return { key, label }
}

function formatRelative(iso: string): string {
	const ts = new Date(iso).getTime()
	if (Number.isNaN(ts)) return ''
	const diff = Date.now() - ts
	const minutes = Math.round(diff / 60_000)
	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes}min ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.round(hours / 24)
	if (days < 7) return `${days}d ago`
	const weeks = Math.round(days / 7)
	if (weeks < 5) return `${weeks}w ago`
	const months = Math.round(days / 30)
	return `${months}mo ago`
}

function EventGlyph({ type, active }: { type: ArticleRevisionEventType; active: boolean }) {
	const tone = EVENT_TONES[type] ?? 'text-secondary'
	const isFilled = type === 'publish' || type === 'create'
	const isHollow = type === 'save' || type === 'discard_pending'
	const isSquare = type === 'delete'
	const isTriangle = type === 'restore_pending'

	return (
		<span
			aria-hidden
			className={`relative grid size-5 place-items-center rounded-full transition-transform ${
				active ? 'scale-110' : ''
			}`}
		>
			{isFilled ? (
				<span className="size-2 rounded-full bg-success" />
			) : isHollow ? (
				<span className={`size-2 rounded-full ring-1 ring-inset ${tone.replace('text-', 'ring-')}`} />
			) : isSquare ? (
				<span className="size-1.5 rotate-45 bg-error" />
			) : isTriangle ? (
				<span
					className="size-0 border-x-[4px] border-b-[6px] border-x-transparent"
					style={{ borderBottomColor: 'var(--text-link)' }}
				/>
			) : (
				<span className={`size-2 rounded-full ring-1 ring-inset ${tone.replace('text-', 'ring-')}`} />
			)}
		</span>
	)
}

function ActorAvatar({ name, url, size = 16 }: { name: string; url?: string | null; size?: number }) {
	const initials = name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('')
	if (url) {
		// eslint-disable-next-line @next/next/no-img-element
		return (
			<img
				src={url}
				alt=""
				style={{ width: size, height: size }}
				className="shrink-0 rounded-full object-cover ring-1 ring-(--border-medium)"
			/>
		)
	}
	// An initials avatar on the brand tint, not a selected state.
	return (
		<span
			style={{ width: size, height: size, fontSize: Math.max(8, size / 2.5) }}
			className="grid shrink-0 place-items-center rounded-full bg-brand-muted text-link"
		>
			{initials || '·'}
		</span>
	)
}

export function RevisionHistoryDrawer({ onClose, articleId, authorizedFetch, saveEdits, onRestored }: Props) {
	const [selectedIdState, setSelectedIdState] = useState<string | null>(null)
	const [filter, setFilter] = useState<FilterKey>('all')
	const [confirming, setConfirming] = useState<null | 'restore' | 'delete'>(null)
	const [viewMode, setViewMode] = useState<ViewMode>('preview')
	const [baseMode, setBaseMode] = useState<BaseMode>('previous')
	// Below md one pane shows at a time: the list, or the picked revision with a back button.
	const [narrowPane, setNarrowPane] = useState<'list' | 'detail'>('list')
	const listRef = useRef<HTMLDivElement | null>(null)
	const detailRef = useRef<HTMLElement | null>(null)
	const restoreRef = useRef<HTMLButtonElement | null>(null)
	// Not the mutation's own error: that one clears while a retry runs.
	const [restoreError, setRestoreError] = useState<string | null>(null)
	const queryClient = useQueryClient()
	const revisionsQueryKey = useMemo(() => ['research', 'article-revisions', articleId] as const, [articleId])
	const revisionsQuery = useInfiniteQuery({
		queryKey: revisionsQueryKey,
		queryFn: ({ pageParam }) => listArticleRevisions(articleId, { limit: 30, cursor: pageParam }, authorizedFetch),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		retry: false
	})
	const items = useMemo(
		() => revisionsQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY_ARTICLE_REVISIONS,
		[revisionsQuery.data]
	)
	// A pick that left the list (a deleted revision) falls back to the newest one.
	const selectedId =
		selectedIdState && items.some((entry) => entry.id === selectedIdState) ? selectedIdState : (items[0]?.id ?? null)
	const selectedRevisionQuery = useQuery({
		queryKey: ['research', 'article-revision', articleId, selectedId],
		queryFn: () => getArticleRevision(articleId, selectedId!, authorizedFetch),
		enabled: !!selectedId,
		retry: false
	})
	const selectedRevision = selectedRevisionQuery.data ?? null
	const restoreRevisionMutation = useMutation({
		mutationKey: articleWriteKey(articleId),
		mutationFn: async (revisionId: string) => {
			// The restore replaces the editor's document; edits it has not saved yet go to the history first.
			if (!(await saveEdits())) throw new Error('Save the latest edits before restoring.')
			return restoreArticleRevisionToPending(articleId, revisionId, authorizedFetch).catch((error: unknown) => {
				throw new Error("Couldn't restore this revision. Try again.", { cause: error })
			})
		},
		onSuccess: (saved) => cacheWrittenArticle(queryClient, saved)
	})
	const deleteRevisionMutation = useMutation({
		mutationFn: (revisionId: string) => deleteArticleRevision(articleId, revisionId, authorizedFetch),
		onSuccess: (_, revisionId) =>
			queryClient.setQueryData<typeof revisionsQuery.data>(revisionsQueryKey, (current) =>
				current
					? {
							...current,
							pages: current.pages.map((page) => ({
								...page,
								items: page.items.filter((entry) => entry.id !== revisionId)
							}))
						}
					: current
			)
	})
	const isRestoring = restoreRevisionMutation.isPending

	// The restore confirmation starts without the error of an earlier attempt. It cannot open while its request runs,
	// because the open confirmation cannot close until the request settles.
	const askRestore = () => {
		setRestoreError(null)
		setConfirming('restore')
	}

	// A restore belongs to this opening. The drawer cannot close while it runs, and its result replaces the
	// editor only from these per-call callbacks, which React Query drops if the reader leaves the article first.
	// A failure keeps the confirmation open with its error.
	const handleRestore = () => {
		if (!selectedId) return
		restoreRevisionMutation.mutate(selectedId, {
			onSuccess: (saved) => {
				onRestored(saved)
				onClose()
				// The drawer is closing, so the confirmation can toast.
				toast.success('Restored as pending')
			},
			onError: (error) => setRestoreError(error.message)
		})
	}

	const liveAnchorId = useMemo(() => {
		const anchor = items.find((entry) => entry.eventType === 'publish' || entry.eventType === 'create')
		return anchor?.id ?? null
	}, [items])

	const pendingAnchorId = useMemo(() => {
		if (!liveAnchorId) return null
		const livePos = items.findIndex((entry) => entry.id === liveAnchorId)
		const beforeLive = livePos === -1 ? items : items.slice(0, livePos)
		const anchor = beforeLive.find(
			(entry) => entry.eventType === 'pending_save' || entry.eventType === 'restore_pending'
		)
		return anchor?.id ?? null
	}, [items, liveAnchorId])

	const filtered = useMemo(() => items.filter((entry) => FILTER_MATCH[filter](entry.eventType)), [items, filter])

	const grouped = useMemo(() => {
		const groups: Array<{ key: string; label: string; items: Array<ArticleRevisionSummary> }> = []
		for (const entry of filtered) {
			const day = formatDayKey(entry.createdAt)
			const last = groups[groups.length - 1]
			if (last && last.key === day.key) {
				last.items.push(entry)
			} else {
				groups.push({ key: day.key, label: day.label, items: [entry] })
			}
		}
		return groups
	}, [filtered])

	const selectedIndex = useMemo(() => filtered.findIndex((entry) => entry.id === selectedId), [filtered, selectedId])

	// The next row is already rendered, so the keyboard move reaches it without waiting for the commit. A move made
	// from the list takes focus to the new row; one made elsewhere only scrolls it into view.
	const moveSelection = (delta: number, focusRow: boolean) => {
		if (filtered.length === 0) return
		const next = filtered[Math.min(filtered.length - 1, Math.max(0, selectedIndex + delta))]
		setSelectedIdState(next.id)
		const row = listRef.current?.querySelector<HTMLElement>(`[data-revision-id="${next.id}"] button`)
		if (focusRow) row?.focus()
		else row?.scrollIntoView({ block: 'nearest' })
	}

	const previewArticle = useMemo<LocalArticleDocument | null>(() => {
		if (!selectedRevision) return null
		const snapshot = selectedRevision.snapshot ?? {}
		return {
			contentVersion: 1,
			rendererVersion: 1,
			editorSchemaVersion: 1,
			title: 'Untitled',
			slug: 'preview',
			status: 'draft',
			contentJson: { type: 'doc', content: [] },
			plainText: '',
			entities: [],
			charts: [],
			citations: [],
			embeds: [],
			tags: [],
			createdAt: selectedRevision.createdAt,
			updatedAt: selectedRevision.createdAt,
			publishedAt: null,
			...(snapshot as Partial<LocalArticleDocument>)
		}
	}, [selectedRevision])

	const wordCount = useMemo(() => {
		const text = (selectedRevision?.snapshot as { plainText?: string } | undefined)?.plainText ?? ''
		const trimmed = text.trim()
		return trimmed ? trimmed.split(/\s+/).length : 0
	}, [selectedRevision])

	const previousId = useMemo(() => {
		if (!selectedId) return null
		const idx = items.findIndex((entry) => entry.id === selectedId)
		if (idx < 0) return null
		const next = items[idx + 1]
		return next?.id ?? null
	}, [items, selectedId])

	const baseAvailability = useMemo(() => {
		const previous = previousId && previousId !== selectedId ? previousId : null
		const live = liveAnchorId && liveAnchorId !== selectedId ? liveAnchorId : null
		const pending = pendingAnchorId && pendingAnchorId !== selectedId ? pendingAnchorId : null
		return { previous, live, pending }
	}, [previousId, liveAnchorId, pendingAnchorId, selectedId])

	// The chosen base is never switched behind the user's back. When it has nothing to diff against, the pane
	// says why: the selected revision is that base itself, or no such revision exists.
	const baseAnchorId = baseMode === 'previous' ? previousId : baseMode === 'live' ? liveAnchorId : pendingAnchorId
	const baseUnavailable: BaseUnavailable | null = baseAvailability[baseMode]
		? null
		: baseAnchorId === selectedId && selectedId
			? 'self'
			: 'missing'

	const baseId = baseAvailability[baseMode]

	const baseRevisionQuery = useQuery({
		queryKey: ['research', 'article-revision', articleId, baseId],
		queryFn: () => getArticleRevision(articleId, baseId!, authorizedFetch),
		enabled: viewMode === 'diff' && !!baseId,
		retry: false
	})

	const baseRevision = baseRevisionQuery.data ?? null

	const diff = useMemo(() => {
		if (viewMode !== 'diff' || !selectedRevision || !baseRevision) return null
		const before = baseRevision.snapshot ?? {}
		const after = selectedRevision.snapshot ?? {}
		const beforeText = (before as { plainText?: string }).plainText ?? ''
		const afterText = (after as { plainText?: string }).plainText ?? ''
		const paragraphs = diffParagraphs(beforeText, afterText)
		const metadata = diffMetadata(before as Record<string, unknown>, after as Record<string, unknown>)
		const stats = diffStats(paragraphs)
		return { paragraphs, metadata, stats }
	}, [viewMode, selectedRevision, baseRevision])

	const isLive = selectedId !== null && selectedId === liveAnchorId

	return (
		<SideSheet
			size="lg"
			open
			onClose={onClose}
			pending={isRestoring}
			onKeyDown={(event) => {
				if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
				const target = event.target as HTMLElement
				// Nested controls own their keys; history shortcuts only act inside this drawer, not in its confirmations.
				if (target.closest('[role="dialog"], [role="alertdialog"]') !== event.currentTarget) return
				if (
					target.closest(
						'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="menu"], [role="listbox"]'
					)
				)
					return
				// The arrows move through the list only from inside it; elsewhere they scroll the preview as usual.
				const inList = listRef.current?.contains(target) === true
				if (event.key === 'j' || (inList && event.key === 'ArrowDown')) {
					event.preventDefault()
					moveSelection(1, inList)
				} else if (event.key === 'k' || (inList && event.key === 'ArrowUp')) {
					event.preventDefault()
					moveSelection(-1, inList)
				} else if (event.key === 'r' && selectedRevision) {
					event.preventDefault()
					askRestore()
				}
			}}
		>
			<DialogHeader
				title="Revision history"
				leading={
					narrowPane === 'detail' ? (
						<div className="flex md:hidden">
							<DialogBackButton
								label="Back to revisions"
								onClick={() =>
									keepFocus(
										() => setNarrowPane('list'),
										() =>
											listRef.current?.querySelector<HTMLElement>(
												`[data-revision-id="${selectedId}"] button[aria-current="true"]`
											)
									)
								}
							/>
						</div>
					) : null
				}
				subtitle={
					revisionsQuery.data ? (
						<>
							{items.length}
							{revisionsQuery.hasNextPage ? '+' : ''} {items.length === 1 ? 'entry' : 'entries'}
							{/* Keyboard hints mean nothing on a touch screen. */}
							<span className="max-sm:hidden pointer-coarse:hidden">
								<span aria-hidden> · </span>
								<Keycap>J</Keycap> <Keycap>K</Keycap> move, <Keycap>R</Keycap> restore, <Keycap>Esc</Keycap> close
							</span>
						</>
					) : null
				}
			/>

			<DialogBody kind="flush">
				<div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
					<aside
						className={`flex min-h-0 flex-col md:border-r md:border-subtle ${narrowPane === 'detail' ? 'max-md:hidden' : ''}`}
					>
						<div className="border-b border-subtle px-3 py-2">
							<SegmentedControl<FilterKey>
								label="Filter revisions"
								value={filter}
								onValueChange={setFilter}
								// No per-filter counts: five labels with numbers overflow the 360px list, and the header already
								// counts the entries.
								options={FILTER_KEYS.map((key) => ({ value: key, label: FILTER_LABELS[key] }))}
								variant="default"
								size="md"
								className="max-w-full"
							/>
						</div>

						<div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
							{queryReadFailed(revisionsQuery) ? (
								<LoadError
									message="Couldn't load the revision history."
									retrying={revisionsQuery.isFetching}
									onRetry={() => void revisionsQuery.refetch()}
								/>
							) : revisionsQuery.isLoading ? (
								<SurfaceBodyLoadingStatus label="Loading revisions" />
							) : grouped.length === 0 ? (
								<SurfaceBodyStatus variant="empty">
									{filter === 'all'
										? 'No revisions yet. Saving or publishing adds the first one.'
										: 'No revisions match this filter.'}
								</SurfaceBodyStatus>
							) : (
								<div className="relative">
									{grouped.map((group) => (
										<section key={group.key}>
											<header className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-b border-subtle bg-overlay px-5 py-2">
												<span className="label-sm text-secondary">{group.label}</span>
											</header>
											{/* The inset puts each row's 12px padding under the 20px of the day header. */}
											<ul className="px-2">
												{group.items.map((entry, index) => {
													const isSelected = entry.id === selectedId
													const isDeleting =
														deleteRevisionMutation.isPending && deleteRevisionMutation.variables === entry.id
													return (
														<li
															key={entry.id}
															data-revision-id={entry.id}
															className={`group relative ${isDeleting ? 'opacity-50' : ''}`}
														>
															<ListRow
																selected={isSelected}
																// Below md the list hides as the revision shows, so focus moves to the revision pane.
																onClick={() =>
																	keepFocus(
																		() => {
																			setSelectedIdState(entry.id)
																			setNarrowPane('detail')
																		},
																		() => detailRef.current
																	)
																}
																aria-current={isSelected}
																className="relative items-start gap-3"
															>
																{/* The day's timeline: segments above and below each glyph, centered on it (the 12px inset
																    plus half the 20px glyph), so no backdrop has to hide a line behind the glyph. */}
																{index > 0 ? (
																	<span
																		aria-hidden
																		className="absolute top-0 left-5.5 h-2 w-px -translate-x-1/2 bg-border-medium"
																	/>
																) : null}
																{index < group.items.length - 1 ? (
																	<span
																		aria-hidden
																		className="absolute top-8 bottom-0 left-5.5 w-px -translate-x-1/2 bg-border-medium"
																	/>
																) : null}
																<span className="mt-0.5 grid size-5 shrink-0 place-items-center">
																	<EventGlyph type={entry.eventType} active={isSelected} />
																</span>
																<div className="min-w-0 flex-1">
																	{/* The event names the row; the glyph and the Live/Pending badge carry its tone. */}
																	<div className="flex items-center gap-2">
																		<span className="label-md text-primary">
																			{EVENT_LABELS[entry.eventType] ?? entry.eventType}
																		</span>
																		{entry.id === liveAnchorId ? <StatusBadge status="good">Live</StatusBadge> : null}
																		{entry.id === pendingAnchorId ? (
																			<StatusBadge status="caution">Pending</StatusBadge>
																		) : null}
																	</div>
																	<p className="mt-0.5 body-sm text-secondary tabular-nums">
																		{formatTime(entry.createdAt)}
																		<span className="text-tertiary"> · {formatRelative(entry.createdAt)}</span>
																	</p>
																	{entry.actor ? (
																		<div className="mt-1.5 flex items-center gap-1.5 body-sm text-tertiary">
																			<ActorAvatar
																				name={entry.actor.displayName}
																				url={entry.actor.avatarUrl}
																				size={14}
																			/>
																			<span className="truncate">{entry.actor.displayName}</span>
																		</div>
																	) : null}
																</div>
															</ListRow>
														</li>
													)
												})}
											</ul>
										</section>
									))}
									{revisionsQuery.hasNextPage ? (
										<div className="grid gap-2 px-5 py-4">
											{revisionsQuery.isFetchNextPageError ? (
												<InlineStatus variant="error">Couldn't load older revisions. Try again.</InlineStatus>
											) : null}
											<Button
												type="button"
												size="md"
												onClick={() => void revisionsQuery.fetchNextPage()}
												pendingLabel="Loading…"
												pending={revisionsQuery.isFetchingNextPage}
											>
												Load older revisions
											</Button>
										</div>
									) : null}
								</div>
							)}
						</div>
					</aside>

					<section
						ref={detailRef}
						tabIndex={-1}
						aria-label="Selected revision"
						className={`flex min-h-0 min-w-0 flex-col bg-page ${narrowPane === 'list' ? 'max-md:hidden' : ''}`}
					>
						{selectedId ? (
							<PreviewSpecimenHeader
								revision={selectedRevision}
								isLoading={selectedRevisionQuery.isLoading}
								wordCount={wordCount}
								isLive={isLive}
								isPendingAnchor={selectedId === pendingAnchorId}
								restoreRef={restoreRef}
								onAskRestore={askRestore}
								onAskDelete={() => setConfirming('delete')}
								viewMode={viewMode}
								onChangeView={setViewMode}
								baseMode={baseMode}
								onChangeBase={setBaseMode}
								baseRevision={baseRevision}
								diffStats={diff?.stats ?? null}
							/>
						) : null}
						<div className="min-h-0 flex-1 overflow-y-auto">
							{queryReadFailed(selectedRevisionQuery) ? (
								<LoadError
									message="Couldn't load this revision."
									retrying={selectedRevisionQuery.isFetching}
									onRetry={() => void selectedRevisionQuery.refetch()}
								/>
							) : revisionsQuery.isLoading || selectedRevisionQuery.isLoading ? (
								<SurfaceBodyLoadingStatus label="Loading revision" />
							) : !previewArticle ? (
								<SurfaceBodyStatus variant="empty">No revision selected.</SurfaceBodyStatus>
							) : viewMode === 'diff' ? (
								baseUnavailable ? (
									<SurfaceBodyStatus variant="empty">
										{BASE_UNAVAILABLE_TEXT[baseMode][baseUnavailable]}
									</SurfaceBodyStatus>
								) : queryReadFailed(baseRevisionQuery) ? (
									<LoadError
										message="Couldn't load the revision to compare against."
										retrying={baseRevisionQuery.isFetching}
										onRetry={() => void baseRevisionQuery.refetch()}
									/>
								) : diff ? (
									<DiffPane diff={diff} />
								) : (
									<SurfaceBodyLoadingStatus label="Loading comparison" />
								)
							) : (
								<div className="article-page-frame">
									{/* The page's share and contents rail belongs to the page, not to a preview pane. */}
									<ArticleRenderer article={previewArticle} hideSidePanel />
								</div>
							)}
						</div>
					</section>
				</div>
			</DialogBody>

			<ConfirmDialog
				open={confirming === 'restore'}
				onClose={() => setConfirming(null)}
				unmountOnHide
				finalFocus={restoreRef}
				tone="primary"
				title="Restore as pending?"
				description="This snapshot loads into the editor as a pending edit."
				confirmLabel="Restore"
				pendingLabel="Restoring…"
				pending={isRestoring}
				error={restoreError}
				onConfirm={handleRestore}
			/>
			{/* The entry leaves the list from the mutation's own onSuccess. */}
			{confirming === 'delete' && selectedId ? (
				<ConfirmActionDialog
					title="Delete this revision?"
					description="The snapshot is removed from the history permanently."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deleteRevisionMutation}
					variables={selectedId}
					errorMessage="Couldn't delete this revision."
					onClose={() => setConfirming(null)}
				/>
			) : null}
		</SideSheet>
	)
}

function LoadError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
	return (
		<div className="p-4">
			<InlineStatus
				variant="error"
				action={
					<Button type="button" size="sm" onClick={onRetry} pendingLabel="Retrying…" pending={retrying}>
						Try again
					</Button>
				}
			>
				{message}
			</InlineStatus>
		</div>
	)
}

function PreviewSpecimenHeader({
	revision,
	isLoading,
	wordCount,
	isLive,
	isPendingAnchor,
	restoreRef,
	onAskRestore,
	onAskDelete,
	viewMode,
	onChangeView,
	baseMode,
	onChangeBase,
	baseRevision,
	diffStats: stats
}: {
	revision: ArticleRevision | null
	isLoading: boolean
	wordCount: number
	isLive: boolean
	isPendingAnchor: boolean
	restoreRef: RefObject<HTMLButtonElement | null>
	onAskRestore: () => void
	onAskDelete: () => void
	viewMode: ViewMode
	onChangeView: (mode: ViewMode) => void
	baseMode: BaseMode
	onChangeBase: (mode: BaseMode) => void
	baseRevision: ArticleRevision | null
	diffStats: { added: number; removed: number } | null
}) {
	const eventType = revision?.eventType ?? 'save'
	const tone = EVENT_TONES[eventType] ?? 'text-secondary'
	const snapshot = (revision?.snapshot ?? {}) as { title?: string; slug?: string; status?: string }
	const title = snapshot.title || (isLoading ? 'Loading…' : '—')
	const slug = snapshot.slug ?? '—'
	const status = snapshot.status
	const baseRevisionLabel = baseRevision
		? `${EVENT_LABELS[baseRevision.eventType] ?? baseRevision.eventType} · ${formatExact(baseRevision.createdAt)}`
		: null

	return (
		<div className="border-b border-subtle bg-overlay">
			<div className="grid grid-cols-1 items-start gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6 lg:px-6">
				<div className="grid min-w-0 gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={`inline-flex items-center gap-1.5 rounded-sm border border-medium bg-page px-2 py-0.5 label-sm ${tone}`}
						>
							{revision ? <EventGlyph type={eventType} active={false} /> : null}
							{revision ? EVENT_LABELS[eventType] : '—'}
						</span>
						{isLive ? <StatusBadge status="good">Currently live</StatusBadge> : null}
						{isPendingAnchor ? <StatusBadge status="caution">Currently pending</StatusBadge> : null}
						{status ? <span className="label-sm text-tertiary capitalize">{status}</span> : null}
					</div>
					<h3
						className="heading-sm tracking-tight break-words text-primary"
						style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" }}
						title={title}
					>
						{title}
					</h3>
					<dl className="flex flex-wrap items-center gap-x-5 gap-y-1 body-sm">
						<div className="flex items-center gap-1.5">
							<dt className="text-tertiary">Slug</dt>
							<dd className="text-secondary">{slug}</dd>
						</div>
						<div className="flex items-center gap-1.5">
							<dt className="text-tertiary">Words</dt>
							<dd className="text-secondary tabular-nums">{wordCount}</dd>
						</div>
						{revision ? (
							<>
								<div className="flex items-center gap-1.5">
									<dt className="text-tertiary">When</dt>
									<dd className="text-secondary tabular-nums" title={revision.createdAt}>
										{formatExact(revision.createdAt)}
									</dd>
								</div>
								{revision.actor ? (
									<div className="flex items-center gap-1.5">
										<dt className="text-tertiary">By</dt>
										<dd className="flex items-center gap-1.5 text-secondary">
											<ActorAvatar name={revision.actor.displayName} url={revision.actor.avatarUrl} size={14} />
											{revision.actor.displayName}
										</dd>
									</div>
								) : null}
							</>
						) : null}
					</dl>
				</div>

				<div className="grid justify-items-start gap-1.5 lg:justify-items-end">
					<div className="flex items-center gap-2">
						<Button
							ref={restoreRef}
							type="button"
							variant="primary"
							size="md"
							onClick={onAskRestore}
							disabled={!revision}
						>
							<Icon name="repeat" className="size-3.5" aria-hidden="true" />
							Restore as pending
						</Button>
						{/* Stays focusable while unavailable, so a closing delete confirmation can hand focus back to it. */}
						<Button
							type="button"
							size="md"
							variant="destructive"
							disabled={!revision || isLive}
							accessibleWhenDisabled
							onClick={onAskDelete}
						>
							<Icon name="trash-2" className="size-3.5" aria-hidden="true" />
							Delete
						</Button>
					</div>
					{isLive ? <p className="body-sm text-tertiary">The live revision can't be deleted.</p> : null}
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle px-4 py-2.5 lg:px-6">
				<SegmentedControl
					label="View"
					value={viewMode}
					onValueChange={onChangeView}
					options={VIEW_OPTIONS}
					variant="default"
					size="md"
				/>

				{viewMode === 'diff' ? (
					<div className="flex flex-wrap items-center gap-3">
						<span className="label-sm text-secondary">Compare against</span>
						{/* Every base stays pickable; one with nothing to compare says why in the pane. */}
						<SegmentedControl
							label="Compare against"
							value={baseMode}
							onValueChange={onChangeBase}
							options={BASE_OPTIONS}
							variant="default"
							size="md"
						/>
						{stats ? (
							<div className="flex items-center gap-2 mono-sm">
								<span className="inline-flex items-center gap-1 text-success">
									<span aria-hidden>+</span>
									{stats.added}
								</span>
								<span aria-hidden className="text-tertiary">
									/
								</span>
								<span className="inline-flex items-center gap-1 text-error">
									<span aria-hidden>−</span>
									{stats.removed}
								</span>
								<span className="body-sm text-tertiary">words</span>
							</div>
						) : null}
						{baseRevisionLabel ? (
							<span className="hidden truncate body-sm text-tertiary lg:inline">Base: {baseRevisionLabel}</span>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	)
}

function DiffPane({
	diff
}: {
	diff: {
		paragraphs: Array<ParagraphDiffOp>
		metadata: Array<FieldChange>
		stats: { added: number; removed: number }
	}
}) {
	const noBodyChanges =
		diff.stats.added === 0 && diff.stats.removed === 0 && diff.paragraphs.every((op) => op.type === 'equal')
	const noMetadataChanges = diff.metadata.length === 0

	if (noBodyChanges && noMetadataChanges) {
		return <SurfaceBodyStatus variant="empty">No text or metadata changes between these revisions.</SurfaceBodyStatus>
	}

	return (
		<div className="mx-auto w-full max-w-[860px] px-6 py-8">
			{!noMetadataChanges ? <MetadataDiffSection changes={diff.metadata} /> : null}
			{noBodyChanges ? (
				<div className="mt-2 rounded-md border border-dashed border-medium bg-page px-4 py-3 body-sm text-tertiary">
					Body unchanged.
				</div>
			) : (
				<BodyDiffSection ops={diff.paragraphs} />
			)}
		</div>
	)
}

function MetadataDiffSection({ changes }: { changes: Array<FieldChange> }) {
	return (
		<section className="mb-8 grid gap-2">
			<header className="flex items-baseline justify-between gap-2">
				<h4 className="label-sm text-secondary">
					Metadata · {changes.length} change{changes.length === 1 ? '' : 's'}
				</h4>
			</header>
			<dl className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
				{changes.map((change) => (
					<div key={change.key} className="grid grid-cols-[120px_1fr] gap-4 px-4 py-3">
						<dt className="label-sm text-tertiary">{change.label}</dt>
						<dd className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
							<MetaValue value={change.before} tone="remove" />
							<span aria-hidden className="hidden mono-sm text-tertiary sm:inline">
								→
							</span>
							<MetaValue value={change.after} tone="add" />
						</dd>
					</div>
				))}
			</dl>
		</section>
	)
}

function MetaValue({ value, tone }: { value: string | null; tone: 'add' | 'remove' }) {
	if (value == null) {
		return <span className="mono-sm text-tertiary italic">empty</span>
	}
	const styles =
		tone === 'remove'
			? 'border-error-muted bg-error-faint text-error line-through'
			: 'border-success-muted bg-success-faint text-success'
	return (
		<span className={`inline-block max-w-full truncate rounded-sm border px-2 py-0.5 body-sm ${styles}`}>{value}</span>
	)
}

function BodyDiffSection({ ops }: { ops: Array<ParagraphDiffOp> }) {
	return (
		<section className="grid gap-3">
			<header>
				<h4 className="label-sm text-secondary">Body</h4>
			</header>
			<div className="grid gap-2 rounded-md border border-medium bg-surface p-2">
				{ops.map((op, idx) => (
					// oxlint-disable-next-line react/no-array-index-key -- Diff paragraphs are a read-only snapshot and may contain identical text.
					<DiffParagraph key={idx} op={op} />
				))}
			</div>
		</section>
	)
}

function DiffParagraph({ op }: { op: ParagraphDiffOp }) {
	const baseClasses = 'group relative grid grid-cols-[18px_1fr] items-start gap-2 rounded-sm px-3 py-2 leading-relaxed'
	if (op.type === 'equal') {
		return (
			<div className={`${baseClasses} text-secondary`}>
				<span aria-hidden className="pt-0.5 text-center mono-sm text-tertiary">
					·
				</span>
				<p className="body-md">{op.value}</p>
			</div>
		)
	}
	if (op.type === 'add') {
		return (
			<div className={`${baseClasses} bg-success-faint text-primary ring-1 ring-(--border-success-muted) ring-inset`}>
				<span aria-hidden className="pt-0.5 text-center mono-sm text-success">
					+
				</span>
				<p className="body-md">{op.value}</p>
			</div>
		)
	}
	if (op.type === 'remove') {
		return (
			<div
				className={`${baseClasses} bg-error-faint text-error line-through ring-1 ring-(--border-error-muted) ring-inset`}
			>
				<span aria-hidden className="pt-0.5 text-center mono-sm text-error no-underline">
					−
				</span>
				<p className="body-md">{op.value}</p>
			</div>
		)
	}
	return (
		<div className={`${baseClasses} bg-warning-faint text-primary ring-1 ring-(--border-warning-muted) ring-inset`}>
			<span aria-hidden className="pt-0.5 text-center mono-sm text-warning">
				~
			</span>
			<p className="body-md [overflow-wrap:anywhere]">
				{op.words.map((word, idx) => {
					// oxlint-disable-next-line react/no-array-index-key -- Repeated syntax fragments have positional identity and no local state.
					if (word.type === 'equal') return <span key={idx}>{word.value}</span>
					if (word.type === 'add')
						return (
							<span
								// oxlint-disable-next-line react/no-array-index-key -- Repeated syntax fragments have positional identity and no local state.
								key={idx}
								className="rounded-[2px] bg-success-tint px-0.5 text-success"
							>
								{word.value}
							</span>
						)
					return (
						// oxlint-disable-next-line react/no-array-index-key -- Repeated syntax fragments have positional identity and no local state.
						<span key={idx} className="rounded-[2px] bg-error-tint px-0.5 text-error line-through">
							{word.value}
						</span>
					)
				})}
			</p>
		</div>
	)
}
