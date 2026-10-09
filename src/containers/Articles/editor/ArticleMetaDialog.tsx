import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Select } from '~/components/Select/Select'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { DialogBody, DialogCancelButton, DialogFooter, DialogHeader, SideSheet, useOpeningKey } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { keepFocus, neighbourRowControl, showFieldErrors } from '~/ui/focus'
import { Input, Textarea } from '~/ui/Input'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { emailError } from '~/utils/email'
import { EDITORIAL_TAGS, isEditorialTagSlug } from '../editorialTags'
import type {
	ArticleClient,
	ArticleGuestAuthor,
	ArticleGuestAuthorType,
	ArticleImage,
	ArticleSection,
	LocalArticleDocument
} from '../types'
import { ARTICLE_SECTIONS, ARTICLE_SECTION_LABELS, ARTICLE_SECTION_SLUGS } from '../types'
import { ImageUploadButton } from '../upload/ImageUploadButton'
import { PdfUploadButton } from '../upload/PdfUploadButton'
import { ArticleClientField } from './ArticleClientField'
import { Icon } from './ArticleEditorIcon'
import type { ArticleFieldUpdater, PublishResult } from './ArticleEditorTypes'
import { formatArticleDate, fromDateTimeLocal, slugFromTitle, toDateTimeLocal } from './ArticleEditorUtils'
import { MetaSection, MetaSwitch } from './ArticleMetaFields'
import { ArticlePageAssetPicker } from './ArticlePageAssetPicker'
import type { useArticleCollaborators } from './useArticleCollaborators'

type DialogStore = ReturnType<typeof Ariakit.useDialogStore>

const SECTION_OPTIONS = ARTICLE_SECTIONS.map((section) => ({ key: section, name: ARTICLE_SECTION_LABELS[section] }))

const GUEST_AUTHOR_TYPE_OPTIONS: ReadonlyArray<SegmentedControlOption<ArticleGuestAuthorType>> = [
	{
		value: 'Person',
		label: (
			<>
				<Icon name="user" className="size-3.5" />
				Person
			</>
		)
	},
	{
		value: 'Organization',
		label: (
			<>
				<Icon name="building" className="size-3.5" />
				Organization
			</>
		)
	}
]

// Publish checks fields that are edited on the page, not in this sheet; their errors are listed above the footer.
const PAGE_FIELDS = ['title', 'coverImage', 'coverImage.caption', 'coverImage.credit', 'coverImage.copyright']

// The action this sheet started, so its button shows the progress and the sheet stays open until it settles.
type SheetAction = 'publish' | 'publishNow' | 'save'

type ArticleMetaDialogProps = {
	article: LocalArticleDocument
	articleIsScheduled: boolean
	collaborators: ReturnType<typeof useArticleCollaborators>
	hasPendingEdits: boolean
	isCollaborator: boolean
	isOwner: boolean
	isPublished: boolean
	isSaving: boolean
	publishErrors: Record<string, string>
	store: DialogStore
	handlePublish: (opts?: { goLiveAt?: string | null }) => Promise<PublishResult>
	saveArticle: (opts?: { silent?: boolean }) => Promise<boolean>
	setClient: (client: ArticleClient | null) => void
	updateArticle: ArticleFieldUpdater
}

const MAX_TOPICS = 12

const parseTopics = (raw: string) =>
	raw
		.split(',')
		.map((tag) => tag.trim())
		.filter(Boolean)

// Each opening starts from the article as it is then: the schedule, guest rows, topics text and errors of an
// earlier opening never carry over, and a closing sheet keeps its fields through the slide-out.
export function ArticleMetaDialog(props: ArticleMetaDialogProps) {
	return <MetaSheet key={useOpeningKey(Ariakit.useStoreState(props.store, 'open'))} {...props} />
}

function MetaSheet({
	article,
	articleIsScheduled,
	collaborators,
	handlePublish,
	hasPendingEdits,
	isCollaborator,
	isOwner,
	isPublished,
	isSaving,
	publishErrors,
	saveArticle,
	setClient,
	store,
	updateArticle
}: ArticleMetaDialogProps) {
	const [scheduleMode, setScheduleMode] = useState(() => articleIsScheduled || article.goLiveAt != null)
	const [scheduleAtLocal, setScheduleAtLocal] = useState(() => toDateTimeLocal(article.goLiveAt) || '')
	// Set by a Schedule press with a time that has passed; the field then says so until it holds a future time.
	const [submitted, setSubmitted] = useState(false)
	const [guestRows, setGuestRows] = useState<Array<ArticleGuestAuthor & { id: string }>>(() =>
		(article.guestAuthors ?? []).map((guest) => ({ ...guest, id: crypto.randomUUID() }))
	)
	// The text as typed: the article keeps the parsed list, which drops the trailing comma or space being typed.
	const [topicsText, setTopicsText] = useState(() => (article.tags ?? []).join(', '))
	const [running, setRunning] = useState<SheetAction | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	// A failed author action: an add failure belongs to the email field, a row action's to the list.
	const [authorError, setAuthorError] = useState<{ source: 'add' | 'list'; message: string } | null>(null)
	const [addSubmitted, setAddSubmitted] = useState(false)
	const [transferTarget, setTransferTarget] = useState<{ pbUserId: string; name: string } | null>(null)

	const nowSeconds = useNowSeconds()
	const minScheduleLocal = toDateTimeLocal(new Date(nowSeconds * 1000).toISOString())
	const goLiveAt = fromDateTimeLocal(scheduleAtLocal)
	const scheduleInPast = !goLiveAt || new Date(goLiveAt).getTime() <= nowSeconds * 1000
	const scheduleError = submitted && scheduleMode && scheduleInPast ? 'Choose a date and time in the future.' : null

	const commitGuestAuthors = (rows: Array<ArticleGuestAuthor & { id: string }>) =>
		updateArticle(
			'guestAuthors',
			rows
				.filter((guest) => guest.name.trim().length > 0)
				.map(({ name, type, url }) => ({ name, type, ...(url !== undefined ? { url } : {}) }))
		)
	const addGuestAuthor = () => setGuestRows((rows) => [...rows, { id: crypto.randomUUID(), name: '', type: 'Person' }])
	const updateGuestAuthor = (index: number, patch: Partial<ArticleGuestAuthor>) => {
		const next = guestRows.map((guest, i) => (i === index ? { ...guest, ...patch } : guest))
		setGuestRows(next)
		commitGuestAuthors(next)
	}
	const addGuestRef = useRef<HTMLButtonElement>(null)
	// The removed row's × hands focus to the next row's ×, the one above, or Add guest co-author.
	const removeGuestAuthor = (index: number, remove: HTMLElement) => {
		const neighbour = neighbourRowControl(remove.closest('li')!, remove)
		keepFocus(
			() => {
				const next = guestRows.filter((_, i) => i !== index)
				setGuestRows(next)
				commitGuestAuthors(next)
			},
			() => neighbour ?? addGuestRef.current
		)
	}

	// A request can outlive the sheet: the reader may leave the editor while it runs, and the store still reads
	// open then. Only a sheet still in the document can show the result; otherwise only a toast can.
	const sheetRef = useRef<HTMLDivElement>(null)
	const sheetOnScreen = () => sheetRef.current?.isConnected === true && store.getState().open
	const fieldsRef = useRef<HTMLDivElement>(null)

	const runAction = async (action: SheetAction, request: () => Promise<PublishResult>) => {
		setActionError(null)
		setRunning(action)
		const result = await request()
		// Publish marked fields: they unlock, then the first one marked takes focus.
		if (result.ok === false && result.error === null && sheetOnScreen()) {
			showFieldErrors(fieldsRef.current!, () => setRunning(null))
			return
		}
		setRunning(null)
		if (result.ok === true) {
			store.hide()
			toast.success(result.message)
		} else if (sheetOnScreen()) {
			setActionError(result.error)
		} else if (result.error) {
			toast.error(result.error)
		}
	}

	// `show` puts a failure on screen while the sheet is: a row action's in the list, an add's under the email field.
	const runAuthorAction = async (request: Promise<string | null>, show: (message: string) => void) => {
		setAuthorError(null)
		const message = await request
		if (!message) return true
		if (sheetOnScreen()) show(message)
		else toast.error(message)
		return false
	}
	const showListError = (message: string) => setAuthorError({ source: 'list', message })
	const authorListRef = useRef<HTMLUListElement>(null)
	const addInputRef = useRef<HTMLInputElement>(null)
	// A removed co-author's row leaves once the list reloads. While its Remove still holds focus, focus moves on to
	// the next co-author's Remove, the previous one's, or the add field.
	const removeCollaborator = async (remove: HTMLButtonElement, pbUserId: string) => {
		if (!(await runAuthorAction(handleRemoveCollaborator(pbUserId), showListError))) return
		if (document.activeElement !== remove) return
		const neighbour = neighbourRowControl(remove.closest('li')!, remove) ?? addInputRef.current
		neighbour?.focus()
	}
	const publish = () => {
		if (!scheduleMode) {
			void runAction('publish', () => handlePublish(article.goLiveAt != null ? { goLiveAt: null } : {}))
			return
		}
		if (scheduleInPast) {
			showFieldErrors(fieldsRef.current!, () => setSubmitted(true))
			return
		}
		void runAction('publish', () => handlePublish({ goLiveAt }))
	}

	const saveChanges = () =>
		void runAction('save', async () => {
			if (await saveArticle({ silent: true })) return { ok: true, message: 'Changes saved' }
			return { ok: false, error: "Couldn't save your changes. Try again." }
		})

	const pageFieldErrors = PAGE_FIELDS.flatMap((field) => (publishErrors[field] ? [publishErrors[field]] : []))
	// An autosave that is still running would make publish fail its own save first, so publish waits for it.
	const waitingForSave = running === null && isSaving ? 'Saving…' : null
	const slugCandidate = slugFromTitle(article.title)
	const tagSuggestions = (() => {
		const current = new Set(parseTopics(topicsText).map((t) => t.toLowerCase()))
		return (article.entities ?? [])
			.map((e) => e.label || e.slug)
			.filter((label) => label && !current.has(label.toLowerCase()))
			.slice(0, 8)
	})()

	const {
		collaboratorAdding,
		collaboratorEmail,
		collaboratorRemovingId,
		collaboratorUpdatingId,
		collaborators: authors,
		collaboratorsLoadFailed,
		collaboratorsRetrying,
		collaboratorsLoading,
		handleAddCollaborator,
		handleRemoveCollaborator,
		handleToggleHidden,
		retryCollaborators,
		setCollaboratorEmail,
		transferOwnershipMutation
	} = collaborators
	const topics = parseTopics(topicsText)
	const changeTopics = (text: string) => {
		setTopicsText(text)
		updateArticle('tags', parseTopics(text).slice(0, MAX_TOPICS))
	}

	const authorWriteRunning = collaboratorRemovingId !== null || collaboratorUpdatingId !== null

	const addEmailMessage = emailError(collaboratorEmail)
	const addError =
		(addSubmitted ? addEmailMessage : null) ?? (authorError?.source === 'add' ? authorError.message : null)
	const addCollaborator = async (form: HTMLFormElement) => {
		if (addEmailMessage) return showFieldErrors(form, () => setAddSubmitted(true))
		// The server refused the address (no account, already an author): focus returns to it with the reason.
		const showAddError = (message: string) => showFieldErrors(form, () => setAuthorError({ source: 'add', message }))
		if (await runAuthorAction(handleAddCollaborator(), showAddError)) setAddSubmitted(false)
	}

	return (
		<SideSheet
			ref={sheetRef}
			store={store}
			size="sm"
			// Co-author writes lock it too: their failure shows here, so the sheet stays until they settle.
			pending={running !== null || collaboratorAdding || authorWriteRunning}
			portal
		>
			<DialogHeader
				title={isPublished ? 'Edit listing' : 'Review & publish'}
				subtitle={
					isPublished
						? 'These details appear on the public article page and in shares.'
						: 'A quick review before this goes live.'
				}
			/>
			<DialogBody>
				{/* Publishing sends what these fields hold, so they lock until it settles. */}
				<fieldset disabled={running !== null} className="contents">
					{/* The fields publish checks: a failed publish focuses the first one it marks. They sit in no form, so Enter
					    in a field never publishes. */}
					<div ref={fieldsRef} className="contents">
						<MetaSection title="Section">
							<Field
								label="Article section"
								hint={
									<>
										Required. Drives the URL path:{' '}
										<span className="font-mono text-secondary">
											/research/{article.section ?? '…'}/{article.slug || '…'}
										</span>
									</>
								}
								error={publishErrors.section}
							>
								{(control) => (
									<Select
										allValues={SECTION_OPTIONS}
										selectedValues={article.section ?? ''}
										setSelectedValues={(value: string) =>
											updateArticle('section', (value || null) as ArticleSection | null)
										}
										label={
											article.section ? (
												ARTICLE_SECTION_LABELS[article.section]
											) : (
												<span className="text-tertiary">Select a section…</span>
											)
										}
										labelType="none"
										heading="Section"
										variant="input"
										size="md"
										className="w-full justify-between"
										triggerProps={{ ...control }}
									/>
								)}
							</Field>
						</MetaSection>

						<MetaSection title="Client">
							<ArticleClientField articleId={article.id} client={article.client ?? null} onSaved={setClient} />
						</MetaSection>

						{article.section === 'report' ? (
							<MetaSection title="Report">
								<div className="flex flex-col gap-1.5">
									<span className="label-sm text-secondary">Carousel image</span>
									<ImageUploadButton
										scope="report-carousel"
										articleId={article.id ?? null}
										currentUrl={article.carouselImage?.url ?? null}
										label="carousel image"
										helperText="Used on the rotating hero carousel on /research. Falls back to the cover image."
										previewShape="wide"
										onUploaded={(result) =>
											updateArticle('carouselImage', {
												url: result.url,
												width: result.width,
												height: result.height
											} as ArticleImage)
										}
										onCleared={() => updateArticle('carouselImage', null)}
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<span className="label-sm text-secondary">Sponsor logo</span>
									<ImageUploadButton
										scope="report-sponsor-logo"
										articleId={article.id ?? null}
										currentUrl={article.sponsorLogo?.url ?? null}
										label="sponsor logo"
										helperText="Shown as a 'Sponsored by' badge on the report card."
										previewShape="square"
										onUploaded={(result) =>
											updateArticle('sponsorLogo', {
												url: result.url,
												width: result.width,
												height: result.height
											} as ArticleImage)
										}
										onCleared={() => updateArticle('sponsorLogo', null)}
									/>
								</div>
								<Field
									label="Report description"
									action={<FieldCount>{`${(article.reportDescription ?? '').length}/600`}</FieldCount>}
								>
									{(control) => (
										<Textarea
											{...control}
											value={article.reportDescription ?? ''}
											onChange={(event) => updateArticle('reportDescription', event.target.value.slice(0, 600))}
											placeholder="Shown on hover over the report card in the /research carousel."
											rows={4}
											maxLength={600}
											className="resize-none"
										/>
									)}
								</Field>
								<div className="flex flex-col gap-1.5">
									<span className="label-sm text-secondary">Report PDF</span>
									<PdfUploadButton
										articleId={article.id ?? null}
										currentPdf={article.reportPdf ?? null}
										helperText="Downloadable from the article page and the /research carousel."
										onUploaded={(result) =>
											updateArticle('reportPdf', {
												id: result.id,
												url: result.url,
												sizeBytes: result.sizeBytes,
												...(result.originalName ? { originalName: result.originalName } : {})
											})
										}
										onCleared={() => updateArticle('reportPdf', null)}
									/>
								</div>
							</MetaSection>
						) : null}

						<MetaSection title="Publishing">
							<Field
								label="Display date"
								action={
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={() => updateArticle('displayDate', new Date().toISOString())}
									>
										Set to now
									</Button>
								}
								hint="Shown on cards and the article header. Defaults to publish time."
								error={publishErrors.displayDate}
							>
								{(control) => (
									<Input
										{...control}
										type="datetime-local"
										value={toDateTimeLocal(article.displayDate)}
										onChange={(event) => updateArticle('displayDate', fromDateTimeLocal(event.target.value))}
										onClick={(event) => {
											const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
											input.showPicker?.()
										}}
										className="cursor-pointer"
									/>
								)}
							</Field>
							{!isPublished ? (
								<>
									{articleIsScheduled ? (
										<p className="rounded-lg bg-surface-elevated-1 px-3 py-2 body-sm text-secondary">
											Scheduled to go live {formatArticleDate(article.goLiveAt)}.
										</p>
									) : null}
									<div className="-mx-3 grid">
										<MetaSwitch
											checked={scheduleMode}
											onCheckedChange={(next) => {
												setScheduleMode(next)
												if (next && !scheduleAtLocal) {
													const defaultAt = new Date(Date.now() + 3_600_000)
													setScheduleAtLocal(toDateTimeLocal(defaultAt.toISOString()))
												}
											}}
											label="Schedule publication"
											description="Keeps the article as a draft until the chosen time. Times are shown in your local timezone."
										/>
									</div>
									{scheduleMode ? (
										<Field label="Go live at" hint="Independent from display date." error={scheduleError}>
											{(control) => (
												<Input
													{...control}
													type="datetime-local"
													value={scheduleAtLocal}
													min={minScheduleLocal}
													onChange={(event) => setScheduleAtLocal(event.target.value)}
													onClick={(event) => {
														const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
														input.showPicker?.()
													}}
													className="cursor-pointer"
												/>
											)}
										</Field>
									) : null}
								</>
							) : null}
							{article.firstPublishedAt || article.lastPublishedAt ? (
								<dl className="grid gap-1 rounded-lg bg-surface-elevated-1 px-3 py-2.5 body-sm">
									{article.firstPublishedAt ? (
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-tertiary">First published</dt>
											<dd className="text-secondary tabular-nums">{formatArticleDate(article.firstPublishedAt)}</dd>
										</div>
									) : null}
									{article.lastPublishedAt ? (
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-tertiary">Last published</dt>
											<dd className="text-secondary tabular-nums">{formatArticleDate(article.lastPublishedAt)}</dd>
										</div>
									) : null}
								</dl>
							) : null}
							<div className="-mx-3 grid">
								<MetaSwitch
									checked={article.brandByline === true}
									onCheckedChange={(next) => updateArticle('brandByline', next)}
									label="Publish as DefiLlama Research"
									description="Replaces the per-user byline with the institutional name and emits Organization JSON-LD."
								/>
							</div>
							{article.editorialTags && article.editorialTags.length > 0 ? (
								<div className="flex flex-col gap-1.5">
									<span className="label-sm text-secondary">Editorial</span>
									<div className="flex flex-wrap gap-1.5">
										{article.editorialTags.filter(isEditorialTagSlug).map((slug) => (
											<span key={slug} className="rounded-full bg-brand-muted px-2 py-0.5 label-sm text-link">
												{EDITORIAL_TAGS[slug].label}
											</span>
										))}
									</div>
									<p className="body-sm text-tertiary">Managed by editors from /research/admin/curation.</p>
								</div>
							) : null}
						</MetaSection>

						<MetaSection title="URL">
							<Field
								label="Slug"
								hint={
									<span className="block truncate font-mono">
										defillama.com/research/{article.section ? `${ARTICLE_SECTION_SLUGS[article.section]}/` : ''}
										<span className="text-secondary">{article.slug}</span>
									</span>
								}
							>
								{(control) => (
									<div className="flex items-stretch gap-2">
										<Input
											{...control}
											value={article.slug}
											onChange={(event) => updateArticle('slug', event.target.value)}
											className="min-w-0 flex-1 font-mono"
										/>
										{/* Offered only when the title gives a different slug, so it never sits disabled. */}
										{article.title.trim() && slugCandidate !== article.slug ? (
											<Button
												type="button"
												size="md"
												onClick={() => updateArticle('slug', slugCandidate)}
												aria-label={`Regenerate the slug as ${slugCandidate}`}
											>
												Regenerate
											</Button>
										) : null}
									</div>
								)}
							</Field>
						</MetaSection>

						<MetaSection title="Listing">
							<Field label="Subtitle">
								{(control) => (
									<Input
										{...control}
										value={article.subtitle ?? ''}
										onChange={(event) => updateArticle('subtitle', event.target.value)}
										placeholder="Optional secondary line shown on cards"
									/>
								)}
							</Field>
							<Field label="Excerpt">
								{(control) => (
									<Textarea
										{...control}
										value={article.excerpt ?? ''}
										onChange={(event) => updateArticle('excerpt', event.target.value)}
										placeholder="Auto-derived from your first paragraph. Override here if you want."
										rows={3}
										className="resize-none"
									/>
								)}
							</Field>
							<div className="flex flex-col gap-1.5">
								<Field
									label="Topics"
									action={<FieldCount>{`${topics.length}/${MAX_TOPICS}`}</FieldCount>}
									hint={
										topics.length > MAX_TOPICS ? (
											<span className="text-warning">Only the first {MAX_TOPICS} topics are saved.</span>
										) : null
									}
									error={publishErrors.tags}
								>
									{(control) => (
										<Input
											{...control}
											value={topicsText}
											onChange={(event) => changeTopics(event.target.value)}
											placeholder="stablecoins, lending, ethereum"
										/>
									)}
								</Field>
								{tagSuggestions.length > 0 ? (
									<div className="flex flex-wrap items-center gap-1.5 pt-0.5">
										<span className="body-sm text-tertiary">From content</span>
										{tagSuggestions.map((label) => (
											<Button
												key={label}
												type="button"
												size="sm"
												aria-label={`Add topic ${label}`}
												onClick={() => changeTopics(topics.length > 0 ? `${topics.join(', ')}, ${label}` : label)}
											>
												<Icon name="plus" className="size-3" />
												{label}
											</Button>
										))}
									</div>
								) : null}
							</div>
						</MetaSection>

						<MetaSection title="Search & social">
							<Field
								label="Meta title"
								action={<FieldCount>{`${(article.seoTitle ?? '').length}/70`}</FieldCount>}
								hint="Used for the <title> tag. When set, also drives the URL slug if you haven't edited it manually."
							>
								{(control) => (
									<Input
										{...control}
										value={article.seoTitle ?? ''}
										onChange={(event) => updateArticle('seoTitle', event.target.value)}
										placeholder={article.title || 'Falls back to article title'}
										maxLength={120}
									/>
								)}
							</Field>
							<Field
								label="Meta description"
								action={<FieldCount>{`${(article.seoDescription ?? '').length}/160`}</FieldCount>}
							>
								{(control) => (
									<Textarea
										{...control}
										value={article.seoDescription ?? ''}
										onChange={(event) => updateArticle('seoDescription', event.target.value)}
										placeholder="Shown in search results and link previews. Falls back to the excerpt."
										rows={3}
										maxLength={300}
										className="resize-none"
									/>
								)}
							</Field>
						</MetaSection>
					</div>
				</fieldset>
				{/* Authors save through their own requests, not publish, so their Add form (a submit) stays outside the lock. */}
				<MetaSection title="Authors">
					{collaboratorsLoading && !collaboratorsLoadFailed && authors.length === 0 ? (
						<p className="body-sm text-tertiary">Loading authors…</p>
					) : null}
					{collaboratorsLoadFailed ? (
						<InlineStatus
							variant="error"
							action={
								<Button
									type="button"
									size="sm"
									pendingLabel={collaboratorsRetrying ? 'Retrying…' : null}
									onClick={() => void retryCollaborators()}
								>
									Try again
								</Button>
							}
						>
							Couldn&apos;t load the authors.
						</InlineStatus>
					) : null}
					{authors.length > 0 ? (
						<ul ref={authorListRef} tabIndex={-1} aria-label="Authors" className="flex flex-col gap-2">
							{authors.map((entry) => (
								<li
									key={entry.pbUserId}
									className="flex flex-col gap-1 rounded-lg border border-subtle bg-page px-3 py-2"
								>
									<div className="flex min-w-0 items-center gap-2">
										{entry.profile.avatarUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={entry.profile.avatarUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />
										) : (
											<span
												aria-hidden
												className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-muted label-sm text-link"
											>
												{entry.profile.displayName.slice(0, 2).toUpperCase()}
											</span>
										)}
										<div className="min-w-0">
											<p className="truncate body-md text-primary">{entry.profile.displayName}</p>
											<p className="body-sm text-tertiary">
												{entry.role === 'owner' ? 'Owner' : entry.hidden ? 'Co-author · Hidden' : 'Co-author'}
											</p>
										</div>
									</div>
									{isOwner && entry.role === 'collaborator' ? (
										// Under the name, not beside it, so rows keep one shape whatever the name's length.
										<div className="-ml-2 flex items-center gap-1 pl-9">
											<Button
												type="button"
												size="sm"
												variant="ghost"
												aria-label={`${entry.hidden ? 'Show' : 'Hide'} ${entry.profile.displayName} in the byline`}
												pendingLabel={collaboratorUpdatingId === entry.pbUserId ? 'Saving…' : null}
												onClick={() =>
													void runAuthorAction(handleToggleHidden(entry.pbUserId, !entry.hidden), showListError)
												}
											>
												{entry.hidden ? 'Show' : 'Hide'}
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onClick={() => setTransferTarget({ pbUserId: entry.pbUserId, name: entry.profile.displayName })}
											>
												Make owner
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												aria-label={`Remove ${entry.profile.displayName}`}
												pendingLabel={collaboratorRemovingId === entry.pbUserId ? 'Removing…' : null}
												onClick={(event) => void removeCollaborator(event.currentTarget, entry.pbUserId)}
											>
												Remove
											</Button>
										</div>
									) : null}
								</li>
							))}
						</ul>
					) : null}
					{authorError?.source === 'list' ? <InlineStatus variant="error">{authorError.message}</InlineStatus> : null}
					{isOwner ? (
						<form
							noValidate
							onSubmit={(event) => {
								event.preventDefault()
								void addCollaborator(event.currentTarget)
							}}
						>
							<Field
								label="Add a co-author"
								hint="Co-authors can edit, publish, and unpublish. Only you can manage authors or delete."
								error={addError}
							>
								{(control) => (
									<div className="flex gap-2">
										<Input
											{...control}
											ref={addInputRef}
											type="email"
											value={collaboratorEmail}
											onChange={(event) => {
												setCollaboratorEmail(event.target.value)
												if (authorError?.source === 'add') setAuthorError(null)
											}}
											placeholder="Email address"
											readOnly={collaboratorAdding}
											className="min-w-0 flex-1"
										/>
										<Button type="submit" size="md" pendingLabel={collaboratorAdding ? 'Adding…' : null}>
											Add
										</Button>
									</div>
								)}
							</Field>
						</form>
					) : isCollaborator ? (
						<p className="body-sm text-tertiary">Only the owner can manage authors.</p>
					) : null}
				</MetaSection>
				<fieldset disabled={running !== null} className="contents">
					<MetaSection title="Guest co-authors">
						<p className="-mt-1 body-sm text-tertiary">
							Credit external contributors without a DefiLlama account. Added to SEO and structured data only — never
							shown on the article page.
						</p>
						{guestRows.length > 0 ? (
							<ul className="flex flex-col gap-2">
								{guestRows.map((guest, index) => (
									<li
										key={guest.id}
										className="flex flex-col gap-2 rounded-lg border border-subtle bg-page p-3"
										aria-label={`Guest co-author ${index + 1}`}
									>
										<div className="flex items-center gap-2">
											<SegmentedControl
												label="Co-author type"
												variant="field"
												size="md"
												options={GUEST_AUTHOR_TYPE_OPTIONS}
												value={guest.type}
												onValueChange={(type) => updateGuestAuthor(index, { type })}
											/>
											<Tooltip
												content={`Remove guest co-author ${index + 1}`}
												render={
													<Button
														type="button"
														size="sm"
														variant="ghost"
														square
														aria-label={`Remove guest co-author ${index + 1}`}
														onClick={(event) => removeGuestAuthor(index, event.currentTarget)}
													/>
												}
											>
												<Icon name="x" className="size-4" />
											</Tooltip>
										</div>
										<Field label="Name">
											{(control) => (
												<Input
													{...control}
													value={guest.name}
													onChange={(event) => updateGuestAuthor(index, { name: event.target.value })}
													placeholder="Full name"
												/>
											)}
										</Field>
										<Field label="Link (optional)">
											{(control) => (
												<Input
													{...control}
													type="url"
													value={guest.url ?? ''}
													onChange={(event) => updateGuestAuthor(index, { url: event.target.value })}
													placeholder="https://"
												/>
											)}
										</Field>
									</li>
								))}
							</ul>
						) : null}
						<Button ref={addGuestRef} type="button" size="sm" className="w-fit" onClick={addGuestAuthor}>
							<Icon name="plus" className="size-3.5" />
							Add guest co-author
						</Button>
					</MetaSection>

					<MetaSection title="Assets on this page">
						<ArticlePageAssetPicker
							value={article.pageAssets ?? []}
							onChange={(rows) => updateArticle('pageAssets', rows)}
						/>
					</MetaSection>
				</fieldset>

				{pageFieldErrors.length > 0 ? (
					<InlineStatus variant="error">
						<span className="flex flex-col gap-1">
							<span>Fix these on the page before publishing:</span>
							<ul className="list-disc pl-4">
								{pageFieldErrors.map((message) => (
									<li key={message}>{message}</li>
								))}
							</ul>
						</span>
					</InlineStatus>
				) : null}
				{actionError ? <InlineStatus variant="error">{actionError}</InlineStatus> : null}
			</DialogBody>
			<DialogFooter dismiss={<DialogCancelButton>{isPublished ? 'Done' : 'Keep editing'}</DialogCancelButton>}>
				{isPublished ? (
					hasPendingEdits ? (
						<Button
							type="button"
							size="md"
							variant="primary"
							pendingLabel={running === 'publish' ? 'Publishing…' : waitingForSave}
							onClick={() => void runAction('publish', () => handlePublish())}
						>
							Publish update
						</Button>
					) : (
						<Button
							type="button"
							size="md"
							variant="primary"
							pendingLabel={running === 'save' || isSaving ? 'Saving…' : null}
							onClick={saveChanges}
						>
							Save changes
						</Button>
					)
				) : (
					<>
						{/* Scheduling stays the primary action; this skips the wait. */}
						{articleIsScheduled && scheduleMode ? (
							<Button
								type="button"
								size="md"
								disabled={running === 'publish'}
								pendingLabel={running === 'publishNow' ? 'Publishing…' : waitingForSave}
								onClick={() => void runAction('publishNow', () => handlePublish({ goLiveAt: null }))}
							>
								Publish now
							</Button>
						) : null}
						<Button
							type="button"
							size="md"
							variant="primary"
							disabled={running === 'publishNow'}
							pendingLabel={running === 'publish' ? (scheduleMode ? 'Scheduling…' : 'Publishing…') : waitingForSave}
							onClick={publish}
						>
							{scheduleMode ? 'Schedule' : 'Publish now'}
						</Button>
					</>
				)}
			</DialogFooter>

			{transferTarget ? (
				<ConfirmActionDialog
					title={`Make ${transferTarget.name} the owner?`}
					description="You become a co-author and lose the owner-only controls: managing authors and deleting the article."
					confirmLabel="Make owner"
					tone="primary"
					pendingLabel="Transferring…"
					// A transfer takes the owner controls away, Make owner included; the authors list showing the new owner
					// takes focus then.
					autoFocusOnHide={(trigger) => {
						if (trigger?.isConnected) return true
						authorListRef.current?.focus()
						return false
					}}
					mutation={transferOwnershipMutation}
					variables={transferTarget.pbUserId}
					onClose={() => setTransferTarget(null)}
				/>
			) : null}
		</SideSheet>
	)
}

function FieldCount({ children }: { children: string }) {
	return <span className="body-sm text-tertiary tabular-nums">{children}</span>
}
