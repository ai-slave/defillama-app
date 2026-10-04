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
	unlinkResearchSponsorReport,
	updateResearchSponsor
} from '~/containers/Articles/api'
import type { ResearchSponsorAdmin, ResearchSponsorPayload } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { keepFocus, neighbourRowControl, pageContent, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
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
						{editing ? 'Cancel edit' : 'Change page'}
					</Button>
					<Button size="sm" variant="destructive" type="button" onClick={() => setConfirmDelete(true)}>
						Remove
					</Button>
				</div>
			</div>

			{confirmDelete ? (
				<ConfirmActionDialog
					title={`Remove ${sponsor.displayName}?`}
					description="This removes the sponsor page and all its report links. The articles themselves stay unchanged."
					confirmLabel="Remove"
					pendingLabel="Removing…"
					mutation={deleteMutation}
					variables={undefined}
					onClose={() => setConfirmDelete(false)}
				/>
			) : null}
			{editing ? (
				<SponsorPageEditor
					sponsor={sponsor}
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
					<p className="body-sm text-secondary">Drafts stay hidden publicly until they are published.</p>
				</div>
				<SponsorArticlePicker
					excludedIds={linkedIds}
					disabled={linkMutation.isPending}
					onSelect={(article) => linkMutation.mutate(article.id)}
				/>
			</div>

			{sponsor.reports.length === 0 ? (
				<div className="rounded-lg border border-dashed border-medium p-4 body-sm text-secondary">
					No Research articles are linked yet. Search above to add the first one.
				</div>
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
									<span className={report.lifecycleStatus === 'published' ? 'text-data-up' : 'text-warning'}>
										{report.lifecycleStatus}
									</span>
								</p>
							</div>
							<Button
								size="sm"
								variant="ghost"
								type="button"
								pendingLabel={unlinkMutation.isPending && unlinkMutation.variables === report.id ? 'Unlinking…' : null}
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
	const { data, isLoading, error } = useQuery({
		queryKey: SPONSORS_QUERY_KEY,
		queryFn: () => listResearchSponsors(authorizedFetch),
		retry: false
	})
	const createMutation = useMutation({
		mutationFn: (entity: SponsorEntitySelection) => createResearchSponsor(payloadFromEntity(entity), authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: SPONSORS_QUERY_KEY })
			setSelectedEntity(null)
			toast.success('Sponsor page added')
		},
		onError: (mutationError) => toast.error(mutationMessage(mutationError, 'Failed to add sponsor page'))
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
				<h1 className="heading-lg text-primary">Sponsored reports</h1>
				<p className="max-w-[72ch] body-md text-secondary">
					Link Research articles to canonical protocol, chain, or CEX pages. Public pages show up to three published
					articles, newest first.
				</p>
			</header>

			<Card as="section" padding="md" className="grid gap-4">
				<div>
					<h2 className="heading-xs text-primary">Add a sponsor page</h2>
					<p className="body-sm text-secondary">Search by company name, then confirm the exact DefiLlama page.</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
					{/* Only the picker locks: a disabled fieldset would also disable the button that holds focus. */}
					<fieldset disabled={createMutation.isPending} className="min-w-0">
						<SponsorEntityPicker value={selectedEntity} onChange={setSelectedEntity} />
					</fieldset>
					<Button
						size="md"
						variant="primary"
						type="button"
						disabled={!selectedEntity}
						accessibleWhenDisabled
						pendingLabel={createMutation.isPending ? 'Adding…' : null}
						onClick={() => selectedEntity && createMutation.mutate(selectedEntity)}
					>
						Add sponsor
					</Button>
				</div>
			</Card>

			{isLoading ? <div className="py-16 text-center body-sm text-tertiary">Loading sponsor pages…</div> : null}
			{error ? (
				<Card padding="md" className="grid gap-2">
					<h2 className="heading-xs text-primary">Couldn't load sponsor pages</h2>
					<p className="body-sm text-data-down">{mutationMessage(error, 'Failed to load sponsor pages')}</p>
				</Card>
			) : null}
			{!isLoading && !error && data?.length === 0 ? (
				<div className="rounded-lg border border-dashed border-medium bg-surface p-8 text-center">
					<p className="label-md text-primary">No sponsor pages configured</p>
					<p className="mt-1 body-sm text-secondary">Use the search above to create the first association.</p>
				</div>
			) : null}
			{data?.map((sponsor) => (
				<SponsorPanel key={sponsor.id} sponsor={sponsor} />
			))}
		</div>
	)
}

function SponsorPageEditor({
	sponsor,
	update,
	onSaved
}: {
	sponsor: ResearchSponsorAdmin
	update: UseMutationResult<unknown, Error, SponsorEntitySelection>
	onSaved: () => void
}) {
	const [replacement, setReplacement] = useState<SponsorEntitySelection | null>(null)
	return (
		<form
			className="grid gap-3 border-t border-subtle pt-4"
			onSubmit={(event) => {
				event.preventDefault()
				if (!replacement) return
				update.mutate(replacement, { onSuccess: onSaved })
			}}
		>
			<fieldset disabled={update.isPending} className="grid min-w-0 gap-3">
				<label className="label-sm text-primary" htmlFor={`replacement-${sponsor.id}`}>
					Replacement DefiLlama page
				</label>
				<SponsorEntityPicker inputId={`replacement-${sponsor.id}`} value={replacement} onChange={setReplacement} />
			</fieldset>
			<Button
				size="md"
				variant="primary"
				type="submit"
				className="justify-self-start"
				disabled={!replacement}
				pendingLabel={update.isPending ? 'Saving…' : null}
			>
				Save page
			</Button>
			{update.error ? (
				<p role="alert" className="body-sm text-data-down">
					{mutationMessage(update.error, 'Failed to update sponsor page')}
				</p>
			) : null}
		</form>
	)
}
