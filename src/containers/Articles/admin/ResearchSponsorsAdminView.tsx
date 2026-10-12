import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import Link from 'next/link'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import {
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
import { focusNeighborOnLeave, keepFocus, pageContent, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { MetaLine } from '~/ui/MetaLine'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { EmptyState, InlineStatus, PanelLoadingStatus } from '~/ui/Status'
import { Tag } from '~/ui/Tag'
import { TextLink } from '~/ui/TextLink'
import { httpErrorMessage } from '~/utils/async'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { SponsorArticlePicker } from './SponsorArticlePicker'
import { SponsorEntityPicker, type SponsorEntitySelection } from './SponsorEntityPicker'

const SPONSORS_QUERY_KEY = ['research', 'admin', 'sponsors'] as const

function payloadFromEntity(entity: SponsorEntitySelection): ResearchSponsorPayload {
	return {
		displayName: entity.label,
		entityType: entity.entityType,
		entitySlug: entity.slug
	}
}

type RelationValue = ArticleClientRelation | 'none'

type AddMode = 'page' | 'website'

const ADD_MODE_OPTIONS: ReadonlyArray<SegmentedControlOption<AddMode>> = [
	{ value: 'page', label: 'Pick a page' },
	{ value: 'website', label: 'Name and website' }
]

function websiteError(website: string) {
	if (!website) return 'Enter the website.'
	if (!/^https?:\/\/\S+$/.test(website)) return 'Enter a valid URL starting with http:// or https://.'
	return null
}

const RELATION_OPTIONS: ReadonlyArray<SegmentedControlOption<RelationValue>> = [
	{ value: 'none', label: 'None' },
	{ value: 'sponsored', label: ARTICLE_CLIENT_RELATION_LABELS.sponsored },
	{ value: 'collaboration', label: ARTICLE_CLIENT_RELATION_LABELS.collaboration }
]

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
		onError: (error) => toast.error(httpErrorMessage(error, "Couldn't link the article."))
	})
	const unlinkMutation = useMutation({
		mutationFn: (articleId: string) => unlinkResearchSponsorReport(sponsor.id, articleId, authorizedFetch),
		onSuccess: () => {
			invalidate()
			toast.success('Research article unlinked')
		},
		onError: (error) => toast.error(httpErrorMessage(error, "Couldn't unlink the article."))
	})
	const relationMutation = useMutation({
		mutationFn: ({ articleId, relation }: { articleId: string; relation: ArticleClientRelation | null }) =>
			setArticleClient(articleId, { sponsorId: sponsor.id, relation }, authorizedFetch),
		onSuccess: invalidate,
		onError: (error) => toast.error(httpErrorMessage(error, "Couldn't update the relation."))
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
						<Tag>{sponsor.entityType ?? 'website'}</Tag>
					</div>
					{sponsor.entityType ? (
						<TextLink href={`/${sponsor.entityType}/${sponsor.entitySlug}`} size="inherit" className="body-sm">
							/{sponsor.entityType}/{sponsor.entitySlug}
						</TextLink>
					) : null}
					{sponsor.websiteUrl ? (
						<TextLink
							href={sponsor.websiteUrl}
							target="_blank"
							rel="noopener noreferrer"
							size="inherit"
							className="body-sm"
						>
							{sponsor.websiteUrl}
						</TextLink>
					) : null}
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
						<StableLabel
							labels={['Change page', 'Add page', 'Cancel edit']}
							current={editing ? 'Cancel edit' : sponsor.entityType ? 'Change page' : 'Add page'}
						/>
					</Button>
					<Button size="sm" variant="destructive" type="button" onClick={() => setConfirmDelete(true)}>
						Remove
					</Button>
				</div>
			</div>

			{confirmDelete ? (
				<ConfirmActionDialog
					title={`Remove ${sponsor.displayName}?`}
					description="This removes it from the Trusted by filter and unlinks its articles. The articles themselves stay unchanged."
					confirmLabel="Remove"
					pendingLabel="Removing…"
					mutation={deleteMutation}
					variables={undefined}
					errorMessage="Couldn't remove it."
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
						An article has one Trusted by company: linking it here moves it from any other. Drafts stay hidden publicly
						until they are published.
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
						<li key={report.id} data-row className="flex flex-wrap items-center justify-between gap-3 p-3">
							<div className="grid min-w-0 flex-1 gap-1">
								<Link
									href={`/research/edit/${encodeURIComponent(report.id)}`}
									className="line-clamp-2 label-md text-primary hover:text-link"
								>
									{report.title}
								</Link>
								<MetaLine>
									{report.section ? ARTICLE_SECTION_LABELS[report.section] : 'No section'}
									<span className={report.lifecycleStatus === 'published' ? 'text-success' : 'text-warning'}>
										{report.lifecycleStatus}
									</span>
								</MetaLine>
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
								ref={focusNeighborOnLeave(pageContent)}
							>
								<Icon name="x" className="size-3" /> Unlink
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
	const [mode, setMode] = useState<AddMode>('page')
	const [selectedEntity, setSelectedEntity] = useState<SponsorEntitySelection | null>(null)
	const [name, setName] = useState('')
	const [website, setWebsite] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const errors =
		mode === 'page'
			? { entity: selectedEntity ? null : 'Choose a DefiLlama page.', name: null, website: null }
			: { entity: null, name: name.trim() ? null : 'Enter the name.', website: websiteError(website.trim()) }
	const hasError = Boolean(errors.entity || errors.name || errors.website)
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
		mutationFn: (payload: ResearchSponsorPayload) => createResearchSponsor(payload, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: SPONSORS_QUERY_KEY })
			setSelectedEntity(null)
			setName('')
			setWebsite('')
			setSubmitted(false)
			toast.success('Added to Trusted by')
		},
		onError: (mutationError) => toast.error(httpErrorMessage(mutationError, "Couldn't add it."))
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
				<h1 className="heading-lg text-primary">Trusted by filter</h1>
				<p className="max-w-[72ch] body-md text-secondary">
					Companies readers can filter Research by. Each one has a DefiLlama page, a website, or both. Linked articles
					show the company and its relation, and a company with a DefiLlama page shows up to three published articles
					there, newest first.
				</p>
			</header>

			<Card as="section" padding="md" className="grid gap-4">
				<div>
					<h2 className="heading-xs text-primary">Add a company</h2>
					<p className="body-sm text-secondary">
						Pick its DefiLlama page, or enter its name and website when it has no page.
					</p>
				</div>
				<SegmentedControl
					label="Add by"
					variant="field"
					size="md"
					options={ADD_MODE_OPTIONS}
					value={mode}
					onValueChange={(next) => {
						setMode(next)
						setSubmitted(false)
					}}
				/>
				<form
					noValidate
					className="grid gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						if (hasError) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
						createMutation.mutate(
							mode === 'page' && selectedEntity
								? payloadFromEntity(selectedEntity)
								: { displayName: name.trim(), websiteUrl: website.trim() }
						)
					}}
				>
					{/* Only the fields lock: a disabled fieldset would also disable the button that holds focus. */}
					<fieldset disabled={createMutation.isPending} className="grid min-w-0 gap-3">
						{mode === 'page' ? (
							<Field label="DefiLlama page" error={submitted ? errors.entity : null}>
								{(control) => (
									<SponsorEntityPicker
										{...control}
										label="DefiLlama page"
										value={selectedEntity}
										onChange={setSelectedEntity}
									/>
								)}
							</Field>
						) : (
							<>
								<Field label="Name" error={submitted ? errors.name : null}>
									{(control) => (
										<Input
											{...control}
											type="text"
											value={name}
											onChange={(event) => setName(event.target.value)}
											placeholder="e.g. Forgd"
											className="w-full"
										/>
									)}
								</Field>
								<Field label="Website" error={submitted ? errors.website : null}>
									{(control) => (
										<Input
											{...control}
											type="url"
											value={website}
											onChange={(event) => setWebsite(event.target.value)}
											placeholder="https://…"
											className="w-full"
										/>
									)}
								</Field>
							</>
						)}
					</fieldset>
					<Button
						size="md"
						variant="primary"
						type="submit"
						className="justify-self-start"
						pendingLabel="Adding…"
						pending={createMutation.isPending}
					>
						Add
					</Button>
				</form>
			</Card>

			{isLoading && !failed ? <PanelLoadingStatus label="Loading the Trusted by list" className="min-h-40" /> : null}
			{failed ? (
				<InlineStatus variant="error" retry={{ refetch, isFetching }}>
					{httpErrorMessage(error, "Couldn't load the Trusted by list.")}
				</InlineStatus>
			) : null}
			{!isLoading && !failed && data?.length === 0 ? (
				<EmptyState size="md" title="No companies yet" framed>
					Use the form above to add the first one.
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
			label={`Trusted by relation for ${report.title}`}
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
					{(control) => (
						<SponsorEntityPicker
							{...control}
							label="Replacement DefiLlama page"
							value={replacement}
							onChange={setReplacement}
						/>
					)}
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
				<InlineStatus variant="error">
					{httpErrorMessage(update.error, "Couldn't update the sponsor page.")}
				</InlineStatus>
			) : null}
		</form>
	)
}
