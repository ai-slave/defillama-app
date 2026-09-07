import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
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
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'

const LAST_TARGET_KEY = 'llamaai-last-article-target'
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
		<button
			type="button"
			onClick={onClick}
			className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left body-sm transition-colors ${
				selected
					? 'bg-brand-muted text-link'
					: 'text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary'
			}`}
		>
			<span className={`grid size-4 shrink-0 place-items-center text-link ${selected ? '' : 'invisible'}`}>
				<Icon name="check" className="size-3" />
			</span>
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{trailing}
		</button>
	)
}

// Loaded at module scope: the compiler cannot lower an import expression inside a component, and the
// export helpers are only needed once the reader confirms the export.
const loadExportBlocks = () =>
	import('~/containers/LlamaAI/utils/articleExport').then((module) => module.buildExportBlocks)

export function AddToArticleModal({ dialogStore, request, sessionTitle }: AddToArticleModalProps) {
	const open = Ariakit.useStoreState(dialogStore, 'open')

	return (
		<Ariakit.Dialog
			store={dialogStore}
			className={`${dialogSurfaceStyles} [--dialog-width:448px]`}
			unmountOnHide
			portal
			hideOnInteractOutside
		>
			{open && request ? (
				<AddToArticleForm dialogStore={dialogStore} request={request} sessionTitle={sessionTitle} />
			) : null}
		</Ariakit.Dialog>
	)
}

function readLastArticleId() {
	return typeof window === 'undefined' ? null : window.sessionStorage.getItem(LAST_TARGET_KEY)
}

function AddToArticleForm({
	dialogStore,
	request,
	sessionTitle
}: Omit<AddToArticleModalProps, 'request'> & { request: ArticleExportRequest }) {
	const router = useRouter()
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const { uploadFile } = useImageUpload({ scope: 'article-inline' })

	const [search, setSearch] = useState('')
	const [isCreatingNew, setIsCreatingNew] = useState(false)
	const [selectedArticleId, setSelectedArticleId] = useState<string | null>(readLastArticleId)
	const [newTitle, setNewTitle] = useState(sessionTitle ?? '')
	const [includeText, setIncludeText] = useState(true)
	const [excludedCharts, setExcludedCharts] = useState<Set<string>>(new Set())
	const [excludedTables, setExcludedTables] = useState<Set<number>>(new Set())
	const [excludedImages, setExcludedImages] = useState<Set<string>>(new Set())

	const { data, isLoading } = useQuery({
		queryKey: ['my-articles-for-export'],
		queryFn: () => listMyArticles({ limit: 50 }, authorizedFetch),
		enabled: isAuthenticated,
		staleTime: 60_000
	})

	const drafts = data?.items ?? EMPTY_ARTICLE_DOCUMENTS
	const effectiveArticleId = drafts.some((draft) => draft.id === selectedArticleId) ? selectedArticleId : null
	const filtered = useMemo(() => {
		if (!search.trim()) return drafts
		return matchSorter(drafts, search, { keys: ['title'] })
	}, [drafts, search])

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

	const mutation = useMutation({
		mutationFn: async () => {
			const buildExportBlocks = await loadExportBlocks()

			const include: ArticleExportInclude = {
				text: request.kind === 'message' ? includeText : true,
				chartIds: chartEntries.filter(([id]) => !excludedCharts.has(id)).map(([id]) => id),
				imageIds: imageEntries.filter(([id]) => !excludedImages.has(id)).map(([id]) => id),
				tableIndices: tableEntries.filter(({ index }) => !excludedTables.has(index)).map(({ index }) => index)
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
			let targetArticleId: string | null = isCreatingNew ? null : effectiveArticleId
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
			if (blocks.length === 0) throw new Error('Nothing selected to export')

			const article =
				targetArticleId !== null
					? await appendBlocksToArticle(targetArticleId, blocks, authorizedFetch)
					: await createArticleWithBlocks(newTitle, blocks, authorizedFetch)

			return { article, notes, isNew: isCreatingNew }
		},
		onSuccess: ({ article, notes, isNew }) => {
			if (typeof window !== 'undefined') window.sessionStorage.setItem(LAST_TARGET_KEY, article.id)
			dialogStore.hide()
			const suffix = notes.length > 0 ? ` (${notes.join('; ')})` : ''
			showViewToast(
				isNew ? `Draft "${article.title}" created${suffix}` : `Added to ${article.title}${suffix}`,
				`/research/edit/${article.id}`,
				(href) => void router.push(href)
			)
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : 'Export failed')
		}
	})

	const canSubmit = isCreatingNew ? newTitle.trim().length > 0 : effectiveArticleId !== null
	const isSubmitting = mutation.isPending

	const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
		setter((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				if (canSubmit && !isSubmitting) mutation.mutate()
			}}
			className="flex min-h-0 flex-1 flex-col"
		>
			<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
				<DialogHeading>Add to article</DialogHeading>
				<DialogCloseButton className="-mr-1" />
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-3">
				<label className="relative block">
					<span className="sr-only">Search drafts</span>
					<Icon
						name="search"
						className="pointer-events-none absolute top-0 bottom-0 left-3 my-auto size-4 text-tertiary"
					/>
					<Input
						type="text"
						onInput={(e) => setSearch(e.currentTarget.value)}
						placeholder="Search drafts..."
						className="w-full pl-8"
					/>
				</label>

				<div className="max-h-56 overflow-y-auto overscroll-contain">
					{isLoading ? (
						<div role="status" aria-live="polite" className="flex items-center justify-center py-8">
							<div className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
							<span className="sr-only">Loading drafts</span>
						</div>
					) : filtered.length === 0 ? (
						<p role="status" aria-live="polite" className="py-6 text-center body-sm text-tertiary">
							{search.trim() ? 'No matches found' : 'No drafts yet'}
						</p>
					) : (
						<div className="flex flex-col gap-0.5">
							{filtered.map((article) => (
								<SelectableRow
									key={article.id}
									selected={!isCreatingNew && effectiveArticleId === article.id}
									onClick={() => {
										setSelectedArticleId(article.id)
										setIsCreatingNew(false)
									}}
									trailing={
										<span className="shrink-0 label-sm text-tertiary">
											{article.status === 'published' ? 'published' : new Date(article.updatedAt).toLocaleDateString()}
										</span>
									}
								>
									{article.title}
								</SelectableRow>
							))}
						</div>
					)}
				</div>

				<div>
					{isCreatingNew ? (
						<Input
							type="text"
							name="newArticleTitle"
							autoFocus
							required
							value={newTitle}
							onChange={(e) => setNewTitle(e.target.value)}
							placeholder="New article title..."
							className="w-full"
						/>
					) : (
						<Button type="button" size="md" onClick={() => setIsCreatingNew(true)} className="w-full">
							<Icon name="plus" className="size-4" />
							<span>Create new article</span>
						</Button>
					)}
				</div>

				{exportSummary.length > 0 ? (
					<div className="border-t border-subtle pt-4">
						<p className="mb-1.5 label-sm text-tertiary">Exporting</p>
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
						<p className="mb-1.5 label-sm text-tertiary">Include from this answer</p>
						<div className="flex flex-col gap-0.5">
							<SelectableRow selected={includeText} onClick={() => setIncludeText((v) => !v)}>
								Text
							</SelectableRow>
							{tableEntries.map(({ index, rows, title }) => (
								<SelectableRow
									key={`table-${index}`}
									selected={!excludedTables.has(index)}
									onClick={() =>
										setExcludedTables((prev) => {
											const next = new Set(prev)
											if (next.has(index)) next.delete(index)
											else next.add(index)
											return next
										})
									}
								>
									Table · {title || `${rows} row${rows === 1 ? '' : 's'}`}
								</SelectableRow>
							))}
							{chartEntries.map(([id, entry]) => (
								<SelectableRow
									key={id}
									selected={!excludedCharts.has(id)}
									onClick={() => toggleSet(setExcludedCharts, id)}
								>
									Chart · {entry?.config?.title || id}
								</SelectableRow>
							))}
							{imageEntries.map(([id]) => (
								<SelectableRow
									key={id}
									selected={!excludedImages.has(id)}
									onClick={() => toggleSet(setExcludedImages, id)}
								>
									Image · {id}
								</SelectableRow>
							))}
						</div>
					</div>
				) : null}
			</div>

			<div className="flex gap-2 border-t border-subtle px-4 py-3">
				<Ariakit.DialogDismiss disabled={isSubmitting} render={<Button type="button" size="md" className="flex-1" />}>
					Cancel
				</Ariakit.DialogDismiss>
				<Button type="submit" variant="primary" size="md" disabled={isSubmitting || !canSubmit} className="flex-1">
					{isSubmitting ? <LoadingSpinner size={16} /> : isCreatingNew ? 'Create draft' : 'Add to article'}
				</Button>
			</div>
		</form>
	)
}
