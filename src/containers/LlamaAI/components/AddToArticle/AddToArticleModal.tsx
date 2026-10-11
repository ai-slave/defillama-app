import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { listMyArticles } from '~/containers/Articles/api'
import { appendBlocksToArticle, createArticleWithBlocks } from '~/containers/Articles/import/appendToArticle'
import type { LlamaAIImportImage } from '~/containers/Articles/import/llamaaiToTiptap'
import type { ArticleDocument } from '~/containers/Articles/types'
import { useImageUpload } from '~/containers/Articles/upload/useImageUpload'
import { saveChartToLibrary } from '~/containers/LlamaAI/api/saveChartToLibrary'
import {
	splitMarkdownTables,
	summarizeSelectionHtml,
	type ArticleExportInclude,
	type ArticleExportRequest
} from '~/containers/LlamaAI/utils/articleExport'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogCancelButton, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { Field, FieldGroup } from '~/ui/Field'
import { passFocusOnLeave, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { ListRow } from '~/ui/ListRow'
import { ListLoading } from '~/ui/NoResults'
import { SearchField } from '~/ui/SearchField'
import { InlineStatus } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'

const LAST_TARGET_KEY = 'llamaai-last-article-target'
const NOTHING_SELECTED = 'Select at least one item to include.'
const EMPTY_ARTICLE_DOCUMENTS: Array<ArticleDocument> = []

interface AddToArticleModalProps {
	dialogStore: Ariakit.DialogStore
	request: ArticleExportRequest | null
	sessionTitle?: string
}

function showViewToast(message: string, href: string, onNavigate: (href: string) => void) {
	toast.success(
		(t) => (
			<div>
				{message}{' '}
				<button
					type="button"
					className="underline"
					onClick={() => {
						toast.dismiss(t.id)
						onNavigate(href)
					}}
				>
					View →
				</button>
			</div>
		),
		{ duration: 6000 }
	)
}

async function fetchImageAsFile(url: string): Promise<File | null> {
	try {
		const res = await fetch(url)
		if (!res.ok) return null
		const blob = await res.blob()
		const name = url.split('/').pop()?.split('?')[0] || 'image.png'
		return new File([blob], name, { type: blob.type || 'image/png' })
	} catch {
		return null
	}
}

function SelectableRow({
	selected,
	onClick,
	children,
	trailing
}: {
	selected: boolean
	onClick: () => void
	children: React.ReactNode
	trailing?: React.ReactNode
}) {
	return (
		<ListRow selected={selected} onClick={onClick} aria-pressed={selected}>
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{trailing}
			<Icon name="check" className={`size-4 shrink-0 text-link ${selected ? '' : 'invisible'}`} />
		</ListRow>
	)
}

// Loaded at module scope: the compiler cannot lower an import expression inside a component, and the
// export helpers are only needed once the reader confirms the export.
const loadExportBlocks = () =>
	import('~/containers/LlamaAI/utils/articleExport').then((module) => module.buildExportBlocks)

export function AddToArticleModal({ dialogStore, request, sessionTitle }: AddToArticleModalProps) {
	const open = Ariakit.useStoreState(dialogStore, 'open')
	// Each opening starts a fresh form; the closing dialog keeps the last one on screen through its fade.
	const openingKey = useOpeningKey(open)
	if (!request) return null
	return (
		<AddToArticleForm
			key={openingKey}
			open={open}
			dialogStore={dialogStore}
			request={request}
			sessionTitle={sessionTitle}
		/>
	)
}

type ExportTarget = { kind: 'draft'; id: string | null } | { kind: 'new' }

function AddToArticleForm({
	open,
	dialogStore,
	request,
	sessionTitle
}: Omit<AddToArticleModalProps, 'request'> & { open: boolean; request: ArticleExportRequest }) {
	const searchRef = useRef<HTMLInputElement>(null)
	const router = useRouter()
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const { uploadFile } = useImageUpload({ scope: 'article-inline' })

	const [search, setSearch] = useState('')
	const [target, setTarget] = useState<ExportTarget>(() => ({
		kind: 'draft',
		id: window.sessionStorage.getItem(LAST_TARGET_KEY)
	}))
	const isCreatingNew = target.kind === 'new'
	const [newTitle, setNewTitle] = useState(sessionTitle ?? '')
	const [includeText, setIncludeText] = useState(true)
	// Parts left out of the export, keyed `chart:<id>`, `table:<index>` and `image:<id>`.
	const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set())
	const toggleExcluded = (key: string) =>
		setExcluded((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})

	const drafts = useQuery({
		queryKey: ['my-articles-for-export'],
		queryFn: () => listMyArticles({ limit: 50 }, authorizedFetch),
		// The form stays mounted after its dialog closes, until the next opening replaces it.
		enabled: isAuthenticated && open,
		staleTime: 60_000
	})

	const draftItems = drafts.data?.items ?? EMPTY_ARTICLE_DOCUMENTS
	const effectiveArticleId =
		target.kind === 'draft' && draftItems.some((draft) => draft.id === target.id) ? target.id : null
	const filtered = useMemo(() => {
		if (!search.trim()) return draftItems
		return matchSorter(draftItems, search, { keys: ['title'] })
	}, [draftItems, search])

	const chartEntries = useMemo(() => {
		if (request.kind === 'chart') return [[request.chartId, request.charts[request.chartId]] as const]
		if (request.kind === 'message') {
			const referenced = new Set(
				(request.markdown.match(/\[CHART:([^\]]+)\]/g) ?? []).map((m: string) => m.slice('[CHART:'.length, -1))
			)
			return Object.entries(request.charts).filter(([id]) => referenced.has(id))
		}
		return []
	}, [request])

	const imageEntries = useMemo(() => {
		if (request.kind !== 'message' || !request.images) return []
		return Object.entries(request.images)
	}, [request])

	const tableEntries = useMemo(() => {
		if (request.kind !== 'message') return []
		return splitMarkdownTables(request.markdown)
			.filter(
				(segment): segment is Extract<ReturnType<typeof splitMarkdownTables>[number], { kind: 'table' }> =>
					segment.kind === 'table'
			)
			.map((segment, index) => ({ index, rows: segment.rows, title: segment.title }))
	}, [request])

	// Read-only summary of what a chart/selection export carries (message exports
	// get interactive include-rows instead).
	const exportSummary = useMemo(() => {
		if (request.kind === 'message') return []
		if (request.kind === 'chart') {
			const entry = request.charts[request.chartId]
			return [{ icon: 'bar-chart-2' as const, label: `Chart · ${entry?.config?.title || request.chartId}` }]
		}
		return summarizeSelectionHtml(request.html, request.charts)
	}, [request])

	// The last failed export, not the mutation's error: that one clears as soon as a retry starts.
	const [exportError, setExportError] = useState<string | null>(null)
	const mutation = useMutation({
		mutationFn: async () => {
			const buildExportBlocks = await loadExportBlocks()

			const include: ArticleExportInclude = {
				text: request.kind === 'message' ? includeText : true,
				chartIds: chartEntries.filter(([id]) => !excluded.has(`chart:${id}`)).map(([id]) => id),
				imageIds: imageEntries.filter(([id]) => !excluded.has(`image:${id}`)).map(([id]) => id),
				tableIndices: tableEntries.filter(({ index }) => !excluded.has(`table:${index}`)).map(({ index }) => index)
			}

			const saveChart =
				'messageId' in request && (request.messageId || request.sessionId)
					? (chartId: string) =>
							saveChartToLibrary(authorizedFetch, {
								chartId,
								sessionId: request.sessionId,
								messageId: request.messageId,
								frozen: true
							})
					: undefined

			const hasImages = include.imageIds.length > 0
			let targetArticleId = effectiveArticleId
			let createdEmptyDraft: Awaited<ReturnType<typeof createArticleWithBlocks>> | null = null
			if (isCreatingNew && hasImages) {
				createdEmptyDraft = await createArticleWithBlocks(newTitle, [], authorizedFetch)
				targetArticleId = createdEmptyDraft.id
			}

			const uploadImage = async (_imageId: string, url: string): Promise<LlamaAIImportImage | null> => {
				const file = await fetchImageAsFile(url)
				if (!file) return null
				const result = await uploadFile(file, targetArticleId)
				return { imageId: result.id, src: result.url, width: result.width, height: result.height }
			}

			const { blocks, notes } = await buildExportBlocks(request, include, { saveChart, uploadImage })
			if (blocks.length === 0) throw new Error(NOTHING_SELECTED)

			const article =
				targetArticleId !== null
					? await appendBlocksToArticle(targetArticleId, blocks, authorizedFetch)
					: await createArticleWithBlocks(newTitle, blocks, authorizedFetch)

			return { article, notes, isNew: isCreatingNew }
		},
		onSuccess: ({ article, notes, isNew }) => {
			window.sessionStorage.setItem(LAST_TARGET_KEY, article.id)
			dialogStore.hide()
			const suffix = notes.length > 0 ? ` (${notes.join('; ')})` : ''
			showViewToast(
				isNew ? `Draft "${article.title}" created${suffix}` : `Added to ${article.title}${suffix}`,
				`/research/edit/${article.id}`,
				(href) => void router.push(href)
			)
		},
		onError: (error) => {
			console.error('Article export failed:', error)
			setExportError(
				error.message === NOTHING_SELECTED
					? NOTHING_SELECTED
					: isCreatingNew
						? "Couldn't create the draft. Try again."
						: "Couldn't add to the article. Try again."
			)
		}
	})

	const [submitted, setSubmitted] = useState(false)
	const titleError = isCreatingNew && !newTitle.trim() ? 'Enter a title for the new article.' : null
	const draftError = !isCreatingNew && effectiveArticleId === null ? 'Choose a draft or create a new article.' : null
	const isSubmitting = mutation.isPending

	return (
		<Dialog store={dialogStore} size="sm" fullSheet pending={isSubmitting} unmountOnHide portal hideOnInteractOutside>
			<form
				noValidate
				onSubmit={(e) => {
					e.preventDefault()
					if (isSubmitting) return
					if (titleError || draftError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
					// The fields lock while the export runs; the footer's submit, outside them, holds focus and its label.
					;(e.nativeEvent as SubmitEvent).submitter?.focus()
					mutation.mutate()
				}}
				className="flex min-h-0 flex-auto flex-col"
			>
				<DialogHeader title="Add to article" />
				<DialogBody>
					{/* Locked while the export runs, so the article it goes to and its parts cannot change under it. */}
					<fieldset disabled={isSubmitting} className="contents">
						<FieldGroup label="Add to a draft" error={submitted ? draftError : null}>
							<SearchField
								ref={searchRef}
								label="Search drafts"
								value={search}
								onChange={setSearch}
								// Enter finishes a search, not the form: it would add to whichever draft is picked, or say none is.
								onKeyDown={(e) => {
									if (e.key === 'Enter') e.preventDefault()
								}}
								placeholder="Search drafts…"
							/>

							<div className="max-h-56 overflow-y-auto overscroll-contain">
								{queryReadFailed(drafts) ? (
									<InlineStatus
										variant="error"
										action={
											<Button
												// The list replaces this button once the retry loads it, so focus moves to the search field above.
												ref={passFocusOnLeave(() => searchRef.current)}
												type="button"
												size="sm"
												pendingLabel="Retrying…"
												pending={drafts.isFetching}
												onClick={() => void drafts.refetch()}
											>
												Try again
											</Button>
										}
									>
										Couldn&apos;t load your drafts.
									</InlineStatus>
								) : drafts.isLoading ? (
									<ListLoading label="Loading drafts" />
								) : filtered.length === 0 ? (
									<p role="status" aria-live="polite" className="py-6 text-center body-sm text-tertiary">
										{search.trim() ? 'No matches found' : 'No drafts yet'}
									</p>
								) : (
									<div className="flex flex-col gap-0.5">
										{filtered.map((article) => (
											<SelectableRow
												key={article.id}
												selected={effectiveArticleId === article.id}
												onClick={() => setTarget({ kind: 'draft', id: article.id })}
												trailing={
													<span className="shrink-0 label-sm text-tertiary">
														{article.status === 'published'
															? 'published'
															: new Date(article.updatedAt).toLocaleDateString()}
													</span>
												}
											>
												{article.title}
											</SelectableRow>
										))}
									</div>
								)}
							</div>
						</FieldGroup>

						{isCreatingNew ? (
							<Field label="New article title" error={submitted ? titleError : null}>
								{(control) => (
									/* Replaces the button that revealed it, so focus follows into the field. */
									<Input
										{...control}
										type="text"
										name="newArticleTitle"
										autoFocus
										required
										value={newTitle}
										onChange={(e) => setNewTitle(e.target.value)}
										placeholder="e.g. Weekly DeFi recap"
										className="w-full"
									/>
								)}
							</Field>
						) : (
							<Button type="button" size="md" onClick={() => setTarget({ kind: 'new' })} className="w-full">
								<Icon name="plus" className="size-4" />
								<span>Create new article</span>
							</Button>
						)}

						{exportSummary.length > 0 ? (
							<div className="border-t border-subtle pt-4">
								<p className="mb-1.5 label-sm text-secondary">Exporting</p>
								<div className="flex flex-col gap-1">
									{exportSummary.map((item) => (
										<p key={item.label} className="flex items-center gap-2.5 px-3 py-1 body-sm text-secondary">
											<Icon name={item.icon} className="size-4 shrink-0 text-tertiary" />
											<span className="truncate">{item.label}</span>
										</p>
									))}
								</div>
							</div>
						) : null}

						{request.kind === 'message' ? (
							<div className="border-t border-subtle pt-4">
								<p className="mb-1.5 label-sm text-secondary">Include from this answer</p>
								<div className="flex flex-col gap-0.5">
									<SelectableRow selected={includeText} onClick={() => setIncludeText((v) => !v)}>
										Text
									</SelectableRow>
									{tableEntries.map(({ index, rows, title }) => (
										<SelectableRow
											key={`table-${index}`}
											selected={!excluded.has(`table:${index}`)}
											onClick={() => toggleExcluded(`table:${index}`)}
										>
											Table · {title || `${rows} row${rows === 1 ? '' : 's'}`}
										</SelectableRow>
									))}
									{chartEntries.map(([id, entry]) => (
										<SelectableRow
											key={id}
											selected={!excluded.has(`chart:${id}`)}
											onClick={() => toggleExcluded(`chart:${id}`)}
										>
											Chart · {entry?.config?.title || id}
										</SelectableRow>
									))}
									{imageEntries.map(([id]) => (
										<SelectableRow
											key={id}
											selected={!excluded.has(`image:${id}`)}
											onClick={() => toggleExcluded(`image:${id}`)}
										>
											Image · {id}
										</SelectableRow>
									))}
								</div>
							</div>
						) : null}
					</fieldset>
					{exportError ? <InlineStatus variant="error">{exportError}</InlineStatus> : null}
				</DialogBody>

				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button
						type="submit"
						variant="primary"
						size="md"
						pendingLabel={isCreatingNew ? 'Creating…' : 'Adding…'}
						pending={isSubmitting}
					>
						{isCreatingNew ? 'Create draft' : 'Add to article'}
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	)
}
