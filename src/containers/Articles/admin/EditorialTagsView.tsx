import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useId } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { ArticlePicker } from '~/containers/Articles/admin/ArticlePicker'
import { EditorialTagRow } from '~/containers/Articles/admin/EditorialTagRow'
import { ReorderableEditorialTagList } from '~/containers/Articles/admin/ReorderableEditorialTagList'
import { SavedChangedNotice, sameValue, useSavedDraft, type SameField } from '~/containers/Articles/admin/savedDraft'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import {
	listArticlesByTag,
	reorderEditorialTag,
	setEditorialTag,
	unsetEditorialTag,
	updateEditorialTagMetadata,
	updateReportHighlightSponsorLogo,
	type ArticleByTagResponse
} from '~/containers/Articles/api'
import type { EditorialTagOrderItem } from '~/containers/Articles/editorialTagOrder'
import { applyEditorialTagOrderPayload } from '~/containers/Articles/editorialTagOrder'
import {
	EDITORIAL_TAG_LIST,
	isEditorialTagReorderable,
	type EditorialTagDefinition
} from '~/containers/Articles/editorialTags'
import type { ArticleDocument, ArticleImage } from '~/containers/Articles/types'
import { ImageUploadButton } from '~/containers/Articles/upload/ImageUploadButton'
import { Button } from '~/ui/Button'
import { passFocusOnLeave } from '~/ui/focus'
import { Textarea } from '~/ui/Input'
import { EmptyState, InlineStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { httpErrorMessage } from '~/utils/async'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'

export function EditorialTagsView() {
	return (
		<div className="mx-auto grid w-full max-w-5xl gap-8 px-1 pb-16">
			<header className="pt-2 pb-2">
				<Link
					href="/research/admin"
					className="inline-flex items-center gap-1 body-sm text-tertiary transition-colors hover:text-primary"
				>
					<span aria-hidden>←</span> Admin
				</Link>
				<h1 className="mt-2 heading-lg tracking-tight text-primary">Curation</h1>
				<p className="mt-1 body-md text-secondary">
					Pick which published articles surface in editor-curated widgets on /research.
				</p>
			</header>

			<div className="grid gap-8">
				{EDITORIAL_TAG_LIST.map((definition) => (
					<EditorialTagSection key={definition.slug} definition={definition} />
				))}
			</div>
		</div>
	)
}

function EditorialTagSection({ definition }: { definition: EditorialTagDefinition }) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const revalidateLanding = useResearchLandingRevalidation()
	const limit = definition.cardinality === 'singleton' ? 1 : 30

	const { data, isPlaceholderData, isLoading, error, errorUpdatedAt, dataUpdatedAt, refetch, isFetching } =
		useQuery<ArticleByTagResponse>({
			queryKey: ['research', 'admin', 'editorial-tag', definition.slug],
			queryFn: () => listArticlesByTag(definition.slug, limit, authorizedFetch),
			retry: false
		})
	// A retry from an error clears `error` while it runs; the failed flag keeps the error and its Try again on screen.
	const read = { data, isPlaceholderData, errorUpdatedAt, dataUpdatedAt }
	const failed = queryReadFailed(read)

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ['research', 'admin', 'editorial-tag', definition.slug] })
		queryClient.invalidateQueries({ queryKey: ['research', 'by-tag', definition.slug] })
		revalidateLanding()
	}

	const setMutation = useMutation({
		mutationFn: (articleId: string) => setEditorialTag(articleId, definition.slug, authorizedFetch),
		onSuccess: () => {
			invalidate()
			toast.success(`Added to ${definition.label}`)
		},
		onError: (err) => {
			toast.error(httpErrorMessage(err, `Couldn't update ${definition.label}.`))
		}
	})

	const unsetMutation = useMutation({
		mutationFn: (articleId: string) => unsetEditorialTag(articleId, definition.slug, authorizedFetch),
		onSuccess: () => {
			invalidate()
			toast.success(`Removed from ${definition.label}`)
		},
		onError: (err) => {
			toast.error(httpErrorMessage(err, `Couldn't update ${definition.label}.`))
		}
	})

	const editorialTagQueryKey = ['research', 'admin', 'editorial-tag', definition.slug] as const

	const reorderMutation = useMutation({
		mutationFn: (payload: Array<EditorialTagOrderItem>) =>
			reorderEditorialTag(definition.slug, payload, authorizedFetch),
		onMutate: async (payload) => {
			await queryClient.cancelQueries({ queryKey: editorialTagQueryKey })
			const previous = queryClient.getQueryData<ArticleByTagResponse>(editorialTagQueryKey)
			if (previous) {
				queryClient.setQueryData<ArticleByTagResponse>(editorialTagQueryKey, {
					...previous,
					items: applyEditorialTagOrderPayload(previous.items, payload)
				})
			}
			return { previous }
		},
		onSuccess: () => {
			invalidate()
			toast.success(`${definition.label} order saved`)
		},
		onError: (err, _payload, context) => {
			if (context?.previous) {
				queryClient.setQueryData(editorialTagQueryKey, context.previous)
			}
			toast.error(httpErrorMessage(err, `Couldn't reorder ${definition.label}.`))
		}
	})

	const items = data?.items ?? []
	const pending = setMutation.isPending || unsetMutation.isPending || reorderMutation.isPending
	const removingId = unsetMutation.isPending ? unsetMutation.variables : null
	const canReorder = isEditorialTagReorderable(definition.slug) && items.length > 1

	return (
		<section className="grid gap-4 rounded-md border border-medium bg-surface p-5">
			<header className="grid gap-2 sm:flex sm:items-end sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<h2 className="heading-sm text-primary">{definition.label}</h2>
						{/* A label badge on the brand tint, not a selected state. */}
						<span className="inline-flex items-center rounded-full bg-brand-muted px-2 py-0.5 label-xs tracking-[0.18em] text-link uppercase">
							{definition.cardinality === 'singleton' ? '1 article' : 'Many articles'}
						</span>
					</div>
					<p className="mt-1 body-md text-secondary">{definition.description}</p>
				</div>
				<span className="label-xs tracking-[0.18em] text-tertiary uppercase tabular-nums">
					Current · {items.length}
				</span>
			</header>

			<div className="grid gap-1.5">
				<span className="label-xs tracking-[0.18em] text-tertiary uppercase">
					{definition.cardinality === 'singleton' ? 'Set article' : 'Add article'}
				</span>
				<ArticlePicker
					value={null}
					onChange={(article) => {
						if (!article || pending) return
						setMutation.mutate(article.id)
					}}
					listArticlesParams={
						definition.slug === 'report-highlight' || definition.slug === 'reports-hero'
							? { section: 'report' }
							: undefined
					}
					hint={
						definition.cardinality === 'singleton'
							? 'Picking an article replaces the current Spotlight.'
							: 'Pick an article to add to this list. Already-tagged articles are skipped.'
					}
				/>
			</div>

			{/* The tag mutations below invalidate this list; a failed refetch keeps rows that may predate the change. */}
			{queryRefreshFailed(read) ? (
				<InlineStatus variant="error" retry={{ refetch, isFetching }}>
					Couldn&apos;t refresh {definition.label}. It may not show your latest change.
				</InlineStatus>
			) : null}
			{failed ? (
				<InlineStatus variant="error" retry={{ refetch, isFetching }}>
					{httpErrorMessage(error, `Couldn't load ${definition.label}.`)}
				</InlineStatus>
			) : isLoading ? (
				<SurfaceBodyLoadingStatus label="Loading articles" className="min-h-32" />
			) : items.length === 0 ? (
				<EmptyState size="md" title={`No articles tagged as ${definition.label.toLowerCase()} yet`} />
			) : canReorder ? (
				<ReorderableEditorialTagList
					items={items}
					onReorder={(payload) => reorderMutation.mutate(payload)}
					onRemove={(articleId) => {
						if (pending) return
						unsetMutation.mutate(articleId)
					}}
					pending={pending}
					removingId={removingId}
					reorderPending={reorderMutation.isPending}
				/>
			) : (
				<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-page">
					{items.map((article) => (
						<EditorialTagRow
							key={article.id}
							article={article}
							onRemove={() => {
								if (pending) return
								unsetMutation.mutate(article.id)
							}}
							pending={pending}
							removing={removingId === article.id}
						/>
					))}
				</ul>
			)}

			{definition.slug === 'report-highlight' && items[0] ? (
				<ReportHighlightControls article={items[0]} pending={pending} invalidate={invalidate} />
			) : null}
		</section>
	)
}

type HighlightForm = { highlightText: string; sponsorLogo: ArticleImage | null }

// A cleared override removes Clear override, which held focus; the highlight field takes it.
// The button sits outside the field's label (so it stays out of the textarea's name), so it finds the field through
// their shared group.
const focusHighlightFieldOnLeave = passFocusOnLeave((node) =>
	node.closest('[data-highlight-field]')?.querySelector('textarea')
)

function highlightFormFromArticle(article: ArticleDocument): HighlightForm {
	return { highlightText: article.editorialTagMetadata?.highlightText ?? '', sponsorLogo: article.sponsorLogo ?? null }
}

const sameHighlightField: SameField<HighlightForm> = (key, a, b) => {
	if (key === 'highlightText') return (a as string).trim() === (b as string).trim()
	return sameValue(key, a, b)
}

export function ReportHighlightControls({
	article,
	pending,
	invalidate
}: {
	article: ArticleDocument
	pending: boolean
	invalidate: () => void
}) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const highlightId = useId()
	const { draft, saved, setDraft, conflict, loadSaved, acceptSaved } = useSavedDraft(
		article,
		article.id,
		highlightFormFromArticle,
		sameHighlightField
	)
	const { highlightText, sponsorLogo } = draft
	const currentText = saved.highlightText
	const setHighlightText = (next: string) => setDraft((prev) => ({ ...prev, highlightText: next }))
	const setSponsorLogo = (next: ArticleImage | null) => setDraft((prev) => ({ ...prev, sponsorLogo: next }))

	const textDirty = highlightText.trim() !== currentText.trim()
	const previewText =
		highlightText.trim() ||
		article.reportDescription?.trim() ||
		article.excerpt?.trim() ||
		article.subtitle?.trim() ||
		''

	const metadataMutation = useMutation({
		mutationFn: (nextText: string) =>
			updateEditorialTagMetadata(
				article.id,
				'report-highlight',
				{ highlightText: nextText.trim() || null },
				authorizedFetch
			),
		// Each control saves one field, so only that field is acknowledged and the other draft is left alone.
		onSuccess: (result, submittedText) => {
			acceptSaved({ highlightText: result.metadata.highlightText ?? '' }, { highlightText: submittedText })
			invalidate()
			toast.success('Highlight text saved')
		},
		onError: (err) => {
			toast.error(httpErrorMessage(err, "Couldn't save the highlight text."))
		}
	})

	const logoMutation = useMutation({
		mutationFn: (nextLogo: ArticleImage | null) =>
			updateReportHighlightSponsorLogo(article.id, nextLogo, authorizedFetch),
		onSuccess: (updated, submittedLogo) => {
			acceptSaved({ sponsorLogo: updated.sponsorLogo ?? null }, { sponsorLogo: submittedLogo })
			invalidate()
			queryClient.invalidateQueries({ queryKey: ['research', 'admin', 'reports'] })
			toast.success('Sponsor logo updated')
		},
		// The draft showed the new logo optimistically; a failed request puts the saved logo back so the UI
		// never claims a change the server rejected. A newer logo action already replaced the draft, so it is
		// left alone. Highlight text is untouched either way.
		onError: (err, submittedLogo) => {
			setDraft((prev) => (prev.sponsorLogo === submittedLogo ? { ...prev, sponsorLogo: saved.sponsorLogo } : prev))
			toast.error(httpErrorMessage(err, "Couldn't update the sponsor logo."))
		}
	})

	return (
		<div className="grid gap-4 border-t border-medium pt-4">
			{conflict ? <SavedChangedNotice noun="highlight" onLoadSaved={loadSaved} /> : null}
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
				{/* The label names only the field: the count describes it, and the buttons sit outside, so neither joins
				    the textarea's name. */}
				<div data-highlight-field className="grid gap-1.5">
					<span className="flex items-baseline justify-between gap-2 label-xs tracking-[0.18em] text-tertiary uppercase">
						<label htmlFor={highlightId}>Highlight text</label>
						<span id={`${highlightId}-count`}>{highlightText.length}/2000</span>
					</span>
					<Textarea
						id={highlightId}
						aria-describedby={`${highlightId}-count`}
						value={highlightText}
						onChange={(event) => setHighlightText(event.target.value.slice(0, 2000))}
						placeholder="Custom text shown on the right side of the Report highlight block."
						rows={4}
						maxLength={2000}
						className="resize-none"
					/>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							disabled={!textDirty || pending || metadataMutation.isPending}
							accessibleWhenDisabled
							pendingLabel="Saving…"
							pending={metadataMutation.isPending && metadataMutation.variables.trim() !== ''}
							onClick={() => metadataMutation.mutate(highlightText)}
						>
							Save highlight text
						</Button>
						{currentText ? (
							<Button
								ref={focusHighlightFieldOnLeave}
								variant="ghost"
								size="sm"
								disabled={pending || metadataMutation.isPending}
								accessibleWhenDisabled
								pendingLabel="Clearing…"
								pending={metadataMutation.isPending && !metadataMutation.variables.trim()}
								onClick={() => {
									setHighlightText('')
									metadataMutation.mutate('')
								}}
							>
								Clear override
							</Button>
						) : null}
					</div>
				</div>

				<div className="grid content-start gap-1.5">
					<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Sponsor logo</span>
					<ImageUploadButton
						scope="report-sponsor-logo"
						articleId={article.id}
						currentUrl={sponsorLogo?.url ?? null}
						label="sponsor logo"
						previewShape="square"
						helperText={
							logoMutation.isPending ? 'Updating highlighted report…' : 'Updates the live highlighted report.'
						}
						onUploaded={(result) => {
							const next = { url: result.url, width: result.width, height: result.height }
							setSponsorLogo(next)
							logoMutation.mutate(next)
						}}
						onCleared={() => {
							setSponsorLogo(null)
							logoMutation.mutate(null)
						}}
					/>
				</div>
			</div>

			<div className="grid gap-2 bg-page p-3">
				<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Current highlight</span>
				<div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
					<div className="grid gap-2">
						{sponsorLogo?.url ? (
							<div className="flex items-center gap-2">
								<span className="body-xs tracking-[0.18em] text-tertiary uppercase">Sponsored by</span>
								<img src={sponsorLogo.url} alt="" className="h-5 max-w-24 object-contain" />
							</div>
						) : null}
						<span className="title-md text-primary">{article.title}</span>
					</div>
					<p className="line-clamp-4 body-md text-secondary">
						{previewText || 'No highlight text, report description, excerpt, or subtitle set.'}
					</p>
				</div>
			</div>
		</div>
	)
}
