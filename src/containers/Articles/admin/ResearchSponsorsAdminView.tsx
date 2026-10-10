import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import Link from 'next/link'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import {
	ArticleApiError,
	createResearchSponsor,
	deleteResearchSponsor,
	linkResearchSponsorReport,
	listResearchSponsors,
	setArticleClient,
	unlinkResearchSponsorReport,
	updateResearchSponsor
} from '~/containers/Articles/api'
import type {
	ArticleClientRelation,
	ResearchSponsorAdmin,
	ResearchSponsorAdminReport,
	ResearchSponsorPayload
} from '~/containers/Articles/types'
import { ARTICLE_CLIENT_RELATION_LABELS, ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { Button, StableLabel } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Field } from '~/ui/Field'
import {
	keepFocus,
	neighbourRowControl,
	pageContent,
	passFocusOnLeave,
	showFieldErrors,
	focusRegionOnLeave
} from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { EmptyState, InlineStatus, PanelLoadingStatus } from '~/ui/Status'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { SponsorArticlePicker } from './SponsorArticlePicker'
import { SponsorEntityPicker, type SponsorEntitySelection } from './SponsorEntityPicker'

const SPONSORS_QUERY_KEY = ['research', 'admin', 'sponsors'] as const

// An unlinked report's row leaves once the list reloads; its Unlink hands focus to the next row's, the one above, or
// the page.
const passUnlinkFocus = passFocusOnLeave((node) => neighbourRowControl(node.closest('li')!, node) ?? pageContent())

function payloadFromEntity(entity: SponsorEntitySelection): ResearchSponsorPayload {
	return {
		displayName: entity.label,
		entityType: entity.entityType,
		entitySlug: entity.slug
	}
}

type RelationValue = ArticleClientRelation | 'none'

const RELATION_OPTIONS: ReadonlyArray<SegmentedControlOption<RelationValue>> = [
	{ value: 'none', label: 'None' },
	{ value: 'sponsored', label: ARTICLE_CLIENT_RELATION_LABELS.sponsored },
	{ value: 'collaboration', label: ARTICLE_CLIENT_RELATION_LABELS.collaboration }
]

function mutationMessage(error: unknown, fallback: string) {
	return error instanceof ArticleApiError ? error.message : fallback
}

function SponsorPanel({ sponsor }: { sponsor: ResearchSponsorAdmin }) {
	const [confirmDelete, setConfirmDelete] = useState(false)
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const [editing, setEditing] = useState(false)
	const editToggleRef = useRef<HTMLButtonElement>(null)
	const linkedIds = new Set(sponsor.reports.map((report) => report.id))

	const invalidate = () => queryClient.invalidateQueries({ queryKey: SPONSORS_QUERY_KEY })
	const linkMutation = useMutation({
		mutationFn: (articleId: string) => linkResearchSponsorReport(sponsor.id, articleId, authorizedFetch),
		onSuccess: () => {
			invalidate()
			toast.success('Research article linked')
		},
		onError: (error) => toast.error(mutationMessage(error, 'Failed to link article'))
	})
	const unlinkMutation = useMutation({
		mutationFn: (articleId: string) => unlinkResearchSponsorReport(sponsor.id, articleId, authorizedFetch),
		onSuccess: () => {
			invalidate()
			toast.success('Research article unlinked')
		},
		onError: (error) => toast.error(mutationMessage(error, 'Failed to unlink article'))
	})
	const relationMutation = useMutation({
		mutationFn: ({ articleId, relation }: { articleId: string; relation: ArticleClientRelation | null }) =>
			setArticleClient(articleId, { sponsorId: sponsor.id, relation }, authorizedFetch),
		onSuccess: invalidate,
		onError: (error) => toast.error(mutationMessage(error, 'Failed to update relation'))
	})
	const deleteMutation = useMutation({
		mutationFn: () => deleteResearchSponsor(sponsor.id, authorizedFetch),
		onSuccess: invalidate
	})
	// Owned here, not by the editor: Cancel edit waits while a save runs, so the save's error always has the editor
	// to show in.
	const updateMutation = useMutation({
		mutationFn: (entity: SponsorEntitySelection) =>
			updateResearchSponsor(sponsor.id, payloadFromEntity(entity), authorizedFetch),
		onSuccess: invalidate
	})

	return (
		<Card as="section" padding="md" className="grid gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="grid min-w-0 gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="heading-xs text-primary">{sponsor.displayName}</h2>
						<span className="rounded-full border border-medium px-2 py-0.5 label-xs text-secondary uppercase">
							{sponsor.entityType}
						</span>
					</div>
					<Link href={`/${sponsor.entityType}/${sponsor.entitySlug}`} className="body-sm text-link hover:underline">
						/{sponsor.entityType}/{sponsor.entitySlug}
					</Link>
				</div>
				<div className="flex items-center gap-2">
					<Button
						ref={editToggleRef}
						size="sm"
						type="button"
						aria-expanded={editing}
						disabled={updateMutation.isPending}
						accessibleWhenDisabled
						onClick={() => {
							updateMutation.reset()
							setEditing((value) => !value)
						}}
					>
						<StableLabel labels={['Change page', 'Cancel edit']} current={editing ? 'Cancel edit' : 'Change page'} />
					</Button>
					<Button size="sm" variant="destructive" type="button" onClick={() => setConfirmDelete(true)}>
						Remove
					</Button>
				</div>
			</div>

			{confirmDelete ? (
				<ConfirmActionDialog
					title={`Remove ${sponsor.displayName}?`}
					description="This removes the client and its links to articles. The articles themselves stay unchanged."
					confirmLabel="Remove"
					pendingLabel="Removing…"
					mutation={deleteMutation}
					variables={undefined}
					onClose={() => setConfirmDelete(false)}
				/>
			) : null}
			{editing ? (
				<SponsorPageEditor
					update={updateMutation}
					// The saved editor closes with its Save button, so the toggle that opened it takes focus.
					onSaved={() =>
						keepFocus(
							() => setEditing(false),
							() => editToggleRef.current
						)
					}
				/>
			) : null}

			<div className="grid gap-2 border-t border-subtle pt-4">
				<div>
					<h3 className="label-md text-primary">Linked Research articles</h3>
					<p className="body-sm text-secondary">
						An article has one client: linking it here moves it from any other client. Drafts stay hidden publicly until
						they are published.
					</p>
				</div>
				<SponsorArticlePicker
					excludedIds={linkedIds}
					disabled={linkMutation.isPending}
					onSelect={(article) => linkMutation.mutate(article.id)}
				/>
			</div>

			{sponsor.reports.length === 0 ? (
				<EmptyState size="md" title="No Research articles linked yet">
					Search above to add the first one.
				</EmptyState>
			) : (
				<ul className="divide-y divide-(--border-subtle) overflow-hidden rounded-lg border border-subtle">
					{sponsor.reports.map((report) => (
						<li key={report.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
							<div className="grid min-w-0 flex-1 gap-1">
								<Link
									href={`/research/edit/${encodeURIComponent(report.id)}`}
									className="line-clamp-2 label-md text-primary hover:text-link"
								>
									{report.title}
								</Link>
								<p className="flex flex-wrap items-center gap-2 body-sm text-tertiary">
									<span>{report.section ? ARTICLE_SECTION_LABELS[report.section] : 'No section'}</span>
									<span aria-hidden>·</span>
									<span className={report.lifecycleStatus === 'published' ? 'text-success' : 'text-warning'}>
										{report.lifecycleStatus}
									</span>
								</p>
							</div>
							<ReportRelationControl
								report={report}
								disabled={relationMutation.isPending && relationMutation.variables?.articleId === report.id}
								onChange={(relation) => relationMutation.mutate({ articleId: report.id, relation })}
							/>
							<Button
								size="sm"
								variant="ghost"
								type="button"
								pendingLabel="Unlinking…"
								pending={unlinkMutation.isPending && unlinkMutation.variables === report.id}
								onClick={() => unlinkMutation.mutate(report.id)}
								ref={passUnlinkFocus}
							>
								<Icon name="x" height={12} width={12} /> Unlink
							</Button>
						</li>
					))}
				</ul>
			)}
		</Card>
	)
}

export function ResearchSponsorsAdminView() {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const [selectedEntity, setSelectedEntity] = useState<SponsorEntitySelection | null>(null)
	const [submitted, setSubmitted] = useState(false)
	const { data, isPlaceholderData, isLoading, error, errorUpdatedAt, dataUpdatedAt, refetch, isFetching } = useQuery({
		queryKey: SPONSORS_QUERY_KEY,
		queryFn: () => listResearchSponsors(authorizedFetch),
		retry: false
	})
	// A retry from an error clears `error` while it runs; the failed flag keeps the error and its Try again on screen.
	// The clients render below the error, so a failed refresh shows it above the list it kept.
	const read = { data, isPlaceholderData, errorUpdatedAt, dataUpdatedAt }
	const failed = queryReadFailed(read) || queryRefreshFailed(read)
	const createMutation = useMutation({
		mutationFn: (entity: SponsorEntitySelection) => createResearchSponsor(payloadFromEntity(entity), authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: SPONSORS_QUERY_KEY })
			setSelectedEntity(null)
			setSubmitted(false)
			toast.success('Client added')
		},
		onError: (mutationError) => toast.error(mutationMessage(mutationError, 'Failed to add client'))
	})

	return (
		<div className="mx-auto grid w-full max-w-5xl gap-6 px-1 pb-16">
			<header className="grid gap-2 pt-2">
				<Link
					href="/research/admin"
					className="inline-flex items-center gap-1 body-sm text-secondary hover:text-primary"
				>
					<span aria-hidden>←</span> Admin
				</Link>
				<h1 className="heading-lg text-primary">Clients</h1>
				<p className="max-w-[72ch] body-md text-secondary">
					Each client is tied to its protocol, chain, or CEX page. Linked articles show the client and its relation,
					readers can filter Research by client, and the client's page shows up to three published articles, newest
					first.
				</p>
			</header>

			<Card as="section" padding="md" className="grid gap-4">
				<div>
					<h2 className="heading-xs text-primary">Add a client</h2>
					<p className="body-sm text-secondary">Search by company name, then confirm the exact DefiLlama page.</p>
				</div>
				<form
					noValidate
					className="grid gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						if (!selectedEntity) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
						createMutation.mutate(selectedEntity)
					}}
				>
					{/* Only the picker locks: a disabled fieldset would also disable the button that holds focus. */}
					<fieldset disabled={createMutation.isPending} className="min-w-0">
						<Field label="DefiLlama page" error={submitted && !selectedEntity ? 'Choose a DefiLlama page.' : null}>
							{(control) => <SponsorEntityPicker {...control} value={selectedEntity} onChange={setSelectedEntity} />}
						</Field>
					</fieldset>
					<Button
						size="md"
						variant="primary"
						type="submit"
						className="justify-self-start"
						pendingLabel="Adding…"
						pending={createMutation.isPending}
					>
						Add client
					</Button>
				</form>
			</Card>

			{isLoading && !failed ? <PanelLoadingStatus label="Loading clients" className="min-h-40" /> : null}
			{failed ? (
				<InlineStatus
					variant="error"
					action={
						<Button
							// The retry leaves once the read succeeds; the region keeps focus.
							ref={focusRegionOnLeave}
							size="sm"
							onClick={() => void refetch()}
							pendingLabel="Retrying…"
							pending={isFetching}
						>
							Try again
						</Button>
					}
				>
					Couldn't load clients. {mutationMessage(error, 'Try again in a moment.')}
				</InlineStatus>
			) : null}
			{!isLoading && !failed && data?.length === 0 ? (
				<EmptyState size="md" title="No clients yet" framed>
					Use the search above to add the first client.
				</EmptyState>
			) : null}
			{data?.map((sponsor) => (
				<SponsorPanel key={sponsor.id} sponsor={sponsor} />
			))}
		</div>
	)
}

function ReportRelationControl({
	report,
	disabled,
	onChange
}: {
	report: ResearchSponsorAdminReport
	disabled: boolean
	onChange: (relation: ArticleClientRelation | null) => void
}) {
	return (
		<SegmentedControl
			label={`Client relation for ${report.title}`}
			variant="default"
			size="sm"
			options={RELATION_OPTIONS.map((option) => ({ ...option, disabled }))}
			value={report.relation ?? 'none'}
			onValueChange={(relation) => onChange(relation === 'none' ? null : relation)}
		/>
	)
}

function SponsorPageEditor({
	update,
	onSaved
}: {
	update: UseMutationResult<unknown, Error, SponsorEntitySelection>
	onSaved: () => void
}) {
	const [replacement, setReplacement] = useState<SponsorEntitySelection | null>(null)
	const [submitted, setSubmitted] = useState(false)
	return (
		<form
			noValidate
			className="grid gap-3 border-t border-subtle pt-4"
			onSubmit={(event) => {
				event.preventDefault()
				if (!replacement) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
				update.mutate(replacement, { onSuccess: onSaved })
			}}
		>
			<fieldset disabled={update.isPending} className="min-w-0">
				<Field label="Replacement DefiLlama page" error={submitted && !replacement ? 'Choose a DefiLlama page.' : null}>
					{(control) => <SponsorEntityPicker {...control} value={replacement} onChange={setReplacement} />}
				</Field>
			</fieldset>
			<Button
				size="md"
				variant="primary"
				type="submit"
				className="justify-self-start"
				pendingLabel="Saving…"
				pending={update.isPending}
			>
				Save page
			</Button>
			{update.error ? (
				<InlineStatus variant="error">{mutationMessage(update.error, 'Failed to update sponsor page')}</InlineStatus>
			) : null}
		</form>
	)
}
