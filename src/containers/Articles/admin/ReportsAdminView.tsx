import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { SavedChangedNotice, sameValue, useSavedDraft, type SameField } from '~/containers/Articles/admin/savedDraft'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import {
	ArticleApiError,
	listArticles,
	publishArticle,
	updateArticleReportFields,
	type ReportFieldsPatch
} from '~/containers/Articles/api'
import type { ArticleDocument, ArticleImage, ArticlePdf } from '~/containers/Articles/types'
import { ImageUploadButton } from '~/containers/Articles/upload/ImageUploadButton'
import { PdfUploadButton } from '~/containers/Articles/upload/PdfUploadButton'
import { Button } from '~/ui/Button'
import { textareaStyles } from '~/ui/Input'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'

function articleEditHref(article: ArticleDocument): string {
	return `/research/edit/${encodeURIComponent(article.id)}`
}

type RowState = {
	reportPdf: ArticlePdf | null
	carouselImage: ArticleImage | null
	sponsorLogo: ArticleImage | null
	reportDescription: string
}

function rowStateFromArticle(article: ArticleDocument): RowState {
	return {
		reportPdf: article.reportPdf ?? null,
		carouselImage: article.carouselImage ?? null,
		sponsorLogo: article.sponsorLogo ?? null,
		reportDescription: article.reportDescription ?? ''
	}
}

const sameRowField: SameField<RowState> = (key, a, b) => {
	if (key === 'reportDescription') return ((a as string) || '').trim() === ((b as string) || '').trim()
	return sameValue(key, a, b)
}

function buildPatch(state: RowState): ReportFieldsPatch {
	const description = state.reportDescription.trim()
	return {
		reportPdf: state.reportPdf,
		carouselImage: state.carouselImage,
		sponsorLogo: state.sponsorLogo,
		reportDescription: description.length > 0 ? description : null
	}
}

export function ReportRow({ article }: { article: ArticleDocument }) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const revalidateLanding = useResearchLandingRevalidation()
	const {
		draft: state,
		setDraft: setState,
		dirty,
		conflict,
		loadSaved,
		acceptSaved
	} = useSavedDraft(article, article.id, rowStateFromArticle, sameRowField)
	const isPublished = article.status === 'published'
	const hasPending = article.pending != null

	// The draft at click time travels as the mutation variable: by the time the request settles the user
	// may have typed more, and those edits must survive the acknowledgement.
	const saveMutation = useMutation({
		mutationFn: (submitted: RowState) => updateArticleReportFields(article.id, buildPatch(submitted), authorizedFetch),
		onSuccess: (saved, submitted) => {
			acceptSaved(rowStateFromArticle(saved), submitted)
			queryClient.invalidateQueries({ queryKey: ['research', 'admin', 'reports'] })
			revalidateLanding()
			toast.success(isPublished ? 'Saved — publish to push live' : 'Saved')
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to save')
		}
	})

	const publishMutation = useMutation({
		mutationFn: async ({ submitted, save }: { submitted: RowState; save: boolean }) => {
			if (save) {
				await updateArticleReportFields(article.id, buildPatch(submitted), authorizedFetch)
			}
			return publishArticle(article.id, authorizedFetch)
		},
		onSuccess: (saved, { submitted }) => {
			acceptSaved(rowStateFromArticle(saved), submitted)
			queryClient.invalidateQueries({ queryKey: ['research', 'admin', 'reports'] })
			revalidateLanding()
			toast.success('Published')
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to publish')
		}
	})

	const isMutating = saveMutation.isPending || publishMutation.isPending

	return (
		<li className="grid gap-4 px-4 py-5">
			{conflict ? <SavedChangedNotice noun="report" onLoadSaved={loadSaved} /> : null}
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 label-xs tracking-[0.18em] uppercase ${
								isPublished ? 'bg-success-tint text-success' : 'bg-surface-elevated-1 text-tertiary'
							}`}
						>
							<span aria-hidden className="size-1 rounded-full bg-current" />
							{isPublished ? 'Live' : 'Draft'}
						</span>
						{hasPending ? (
							<span className="inline-flex items-center rounded-full bg-warning-tint px-2 py-0.5 label-xs tracking-[0.18em] text-warning uppercase">
								Pending edits
							</span>
						) : null}
					</div>
					<Link href={articleEditHref(article)} className="mt-1 block truncate title-lg text-primary hover:text-link">
						{article.title}
					</Link>
					<p className="label-xs tracking-[0.16em] text-tertiary uppercase">/research/report/{article.slug}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						disabled={!dirty || isMutating}
						accessibleWhenDisabled
						pendingLabel={saveMutation.isPending ? 'Saving…' : null}
						onClick={() => saveMutation.mutate(state)}
					>
						Save
					</Button>
					{isPublished ? (
						<Button
							variant="primary"
							size="sm"
							disabled={isMutating || (!dirty && !hasPending)}
							accessibleWhenDisabled
							pendingLabel={publishMutation.isPending ? 'Publishing…' : null}
							onClick={() => publishMutation.mutate({ submitted: state, save: dirty })}
						>
							Save &amp; publish
						</Button>
					) : null}
					<Button as={BasicLink} variant="ghost" size="sm" href={articleEditHref(article)}>
						Open editor →
					</Button>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
				<div className="grid gap-1.5">
					<span className="label-xs tracking-[0.18em] text-tertiary uppercase">PDF</span>
					<PdfUploadButton
						articleId={article.id}
						currentPdf={state.reportPdf}
						onUploaded={(result) =>
							setState((prev) => ({
								...prev,
								reportPdf: {
									id: result.id,
									url: result.url,
									sizeBytes: result.sizeBytes,
									...(result.originalName ? { originalName: result.originalName } : {})
								}
							}))
						}
						onCleared={() => setState((prev) => ({ ...prev, reportPdf: null }))}
					/>
				</div>
				<div className="grid gap-1.5">
					<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Carousel image</span>
					<ImageUploadButton
						scope="report-carousel"
						articleId={article.id}
						currentUrl={state.carouselImage?.url ?? null}
						label="carousel image"
						previewShape="wide"
						onUploaded={(result) =>
							setState((prev) => ({
								...prev,
								carouselImage: {
									url: result.url,
									width: result.width,
									height: result.height
								}
							}))
						}
						onCleared={() => setState((prev) => ({ ...prev, carouselImage: null }))}
					/>
				</div>
				<div className="grid gap-1.5">
					<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Sponsor logo</span>
					<ImageUploadButton
						scope="report-sponsor-logo"
						articleId={article.id}
						currentUrl={state.sponsorLogo?.url ?? null}
						label="sponsor logo"
						previewShape="square"
						onUploaded={(result) =>
							setState((prev) => ({
								...prev,
								sponsorLogo: {
									url: result.url,
									width: result.width,
									height: result.height
								}
							}))
						}
						onCleared={() => setState((prev) => ({ ...prev, sponsorLogo: null }))}
					/>
				</div>
			</div>

			<label className="grid gap-1.5">
				<span className="flex items-baseline justify-between gap-2 label-xs tracking-[0.18em] text-tertiary uppercase">
					<span>Description</span>
					<span className="text-tertiary">{state.reportDescription.length}/600</span>
				</span>
				<textarea
					value={state.reportDescription}
					onChange={(event) => setState((prev) => ({ ...prev, reportDescription: event.target.value.slice(0, 600) }))}
					placeholder="Shown on hover over the report card on /research."
					rows={3}
					maxLength={600}
					className={`${textareaStyles} resize-none`}
				/>
			</label>
		</li>
	)
}

type StatusFilter = 'all' | 'published' | 'draft'

const STATUS_FILTERS: ReadonlyArray<SegmentedControlOption<StatusFilter>> = [
	{ value: 'all', label: 'All' },
	{ value: 'published', label: 'Published' },
	{ value: 'draft', label: 'Drafts' }
]

export function ReportsAdminView() {
	const { authorizedFetch } = useAuthContext()
	const [filter, setFilter] = useState<StatusFilter>('all')

	const {
		data: reports,
		isLoading,
		error
	} = useQuery({
		queryKey: ['research', 'admin', 'reports'],
		queryFn: async () => {
			const response = await listArticles({ section: 'report', limit: 100 }, authorizedFetch)
			return response.items
		},
		retry: false
	})

	if (isLoading) {
		return <div className="mx-auto py-24 text-center body-md text-tertiary">Loading…</div>
	}

	if (error) {
		const message = error instanceof ArticleApiError ? error.message : 'Failed to load reports'
		return (
			<div className="mx-auto grid max-w-xl gap-3 rounded-md border border-error-muted bg-error-faint p-6">
				<h1 className="heading-sm text-primary">Couldn't load reports</h1>
				<p className="body-md text-secondary">{message}</p>
			</div>
		)
	}

	const all = reports ?? []
	const filtered = filter === 'all' ? all : all.filter((a) => a.status === filter)

	return (
		<div className="mx-auto grid w-full max-w-5xl gap-6 px-1 pb-16">
			<header className="flex flex-wrap items-end justify-between gap-3 pt-2 pb-2">
				<div>
					<Link
						href="/research/admin"
						className="inline-flex items-center gap-1 body-sm text-tertiary transition-colors hover:text-primary"
					>
						<span aria-hidden>←</span> Admin
					</Link>
					<h1 className="mt-2 heading-lg tracking-tight text-primary">Reports</h1>
					<p className="mt-1 body-md text-secondary">
						Attach a PDF, carousel image, sponsor logo, and description to each Report article. Changes to published
						reports go to a pending revision — use <span className="font-medium">Save &amp; publish</span> to push them
						live.
					</p>
				</div>
				<SegmentedControl<StatusFilter>
					label="Status"
					variant="default"
					size="md"
					options={STATUS_FILTERS}
					value={filter}
					onValueChange={setFilter}
				/>
			</header>

			{filtered.length === 0 ? (
				<div className="rounded-md border border-dashed border-medium bg-surface p-10 text-center">
					<p className="body-md text-secondary">
						{all.length === 0 ? 'No Report articles yet.' : 'No reports match this filter.'}
					</p>
				</div>
			) : (
				<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
					{filtered.map((article) => (
						<ReportRow key={article.id} article={article} />
					))}
				</ul>
			)}
		</div>
	)
}
