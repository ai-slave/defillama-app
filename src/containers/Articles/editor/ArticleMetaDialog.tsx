import * as Ariakit from '@ariakit/react'
import { useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { DialogBody, DialogFooter, DialogHeader, SideSheet } from '~/ui/Dialog'
import { keepFocus } from '~/ui/focus'
import { Input, inputStyles, textareaStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { EDITORIAL_TAGS, isEditorialTagSlug } from '../editorialTags'
import type { ArticleGuestAuthor, ArticleImage, ArticlePageAsset, ArticleSection, LocalArticleDocument } from '../types'
import { ARTICLE_SECTIONS, ARTICLE_SECTION_LABELS, ARTICLE_SECTION_SLUGS } from '../types'
import { ImageUploadButton } from '../upload/ImageUploadButton'
import { PdfUploadButton } from '../upload/PdfUploadButton'
import { Icon } from './ArticleEditorIcon'
import type { ArticleFieldUpdater, PublishResult } from './ArticleEditorTypes'
import { formatArticleDate, fromDateTimeLocal, slugFromTitle, toDateTimeLocal } from './ArticleEditorUtils'
import { MetaFieldHint, MetaSection, MetaSwitch } from './ArticleMetaFields'
import { ArticlePageAssetPicker } from './ArticlePageAssetPicker'
import type { useArticleCollaborators } from './useArticleCollaborators'

type DialogStore = ReturnType<typeof Ariakit.useDialogStore>

function isFutureScheduleLocal(local: string): boolean {
	const iso = fromDateTimeLocal(local)
	if (!iso) return false
	return new Date(iso) > new Date()
}

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
	updateArticle: ArticleFieldUpdater
}

export function ArticleMetaDialog({
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
	store,
	updateArticle
}: ArticleMetaDialogProps) {
	const id = useId()
	const dialogOpen = Ariakit.useStoreState(store, 'open')
	const [scheduleMode, setScheduleMode] = useState(false)
	const [scheduleAtLocal, setScheduleAtLocal] = useState('')
	const [scheduleError, setScheduleError] = useState<string | null>(null)
	const [guestRows, setGuestRows] = useState<Array<ArticleGuestAuthor & { id: string }>>(() =>
		(article.guestAuthors ?? []).map((guest) => ({ ...guest, id: crypto.randomUUID() }))
	)
	const [assetRows, setAssetRows] = useState<Array<ArticlePageAsset>>(() => article.pageAssets ?? [])
	const [running, setRunning] = useState<SheetAction | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	// A failed author action: an add failure belongs to the email field, a row action's to the list.
	const [authorError, setAuthorError] = useState<{ source: 'add' | 'list'; message: string } | null>(null)
	const [transferTarget, setTransferTarget] = useState<{ pbUserId: string; name: string } | null>(null)

	// While open, the schedule fields follow the saved schedule; the row drafts restart only when the dialog opens.
	const scheduleSyncKey = dialogOpen ? `${article.goLiveAt ?? ''}|${articleIsScheduled}` : null
	const [syncedScheduleKey, setSyncedScheduleKey] = useState<string | null>(null)
	if (scheduleSyncKey !== syncedScheduleKey) {
		setSyncedScheduleKey(scheduleSyncKey)
		if (scheduleSyncKey !== null) {
			setScheduleMode(articleIsScheduled || article.goLiveAt != null)
			setScheduleAtLocal(toDateTimeLocal(article.goLiveAt) || '')
			setScheduleError(null)
		}
	}
	const [wasOpen, setWasOpen] = useState(false)
	if (dialogOpen !== wasOpen) {
		setWasOpen(dialogOpen)
		if (dialogOpen) {
			setGuestRows((article.guestAuthors ?? []).map((guest) => ({ ...guest, id: crypto.randomUUID() })))
			setAssetRows(article.pageAssets ?? [])
			setActionError(null)
			setAuthorError(null)
		}
	}

	const nowSeconds = useNowSeconds()
	const minScheduleLocal = toDateTimeLocal(new Date(nowSeconds * 1000).toISOString())

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
	const guestListRef = useRef<HTMLUListElement>(null)
	const addGuestRef = useRef<HTMLButtonElement>(null)
	// The removed row's × hands focus to the × that takes its place, the one above, or Add guest co-author.
	const removeGuestAuthor = (index: number) =>
		keepFocus(
			() => {
				const next = guestRows.filter((_, i) => i !== index)
				setGuestRows(next)
				commitGuestAuthors(next)
			},
			() => {
				const removeButtons = guestListRef.current?.querySelectorAll<HTMLElement>('[data-guest-remove]')
				return removeButtons?.[Math.min(index, removeButtons.length - 1)] ?? addGuestRef.current
			}
		)

	const updatePageAssets = (rows: Array<ArticlePageAsset>) => {
		setAssetRows(rows)
		updateArticle('pageAssets', rows)
	}

	// A request can outlive the sheet: the reader may leave the editor while it runs, and the store still reads
	// open then. Only a sheet still in the document can show the result; otherwise only a toast can.
	const sheetRef = useRef<HTMLDivElement>(null)
	const sheetOnScreen = () => sheetRef.current?.isConnected === true && store.getState().open

	const runAction = async (action: SheetAction, request: () => Promise<PublishResult>) => {
		setActionError(null)
		setRunning(action)
		const result = await request()
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

	const runAuthorAction = async (source: 'add' | 'list', request: Promise<string | null>) => {
		setAuthorError(null)
		const message = await request
		if (!message) return true
		if (sheetOnScreen()) setAuthorError({ source, message })
		else toast.error(message)
		return false
	}
	const authorListRef = useRef<HTMLUListElement>(null)
	// A removed co-author's row leaves once the list reloads. While its Remove still holds focus, focus moves on to
	// the next co-author's Remove, the previous one's, or the add field.
	const removeCollaborator = async (remove: HTMLButtonElement, pbUserId: string) => {
		const row = remove.closest('li')!
		if (!(await runAuthorAction('list', handleRemoveCollaborator(pbUserId)))) return
		if (document.activeElement !== remove) return
		const neighbour =
			row.nextElementSibling?.querySelector<HTMLElement>('[data-author-remove]') ??
			row.previousElementSibling?.querySelector<HTMLElement>('[data-author-remove]') ??
			document.getElementById(`${id}-collaborator`)
		neighbour?.focus()
	}
	const addError = authorError?.source === 'add' ? authorError.message : null

	const publish = () => {
		if (!scheduleMode) {
			void runAction('publish', () => handlePublish(article.goLiveAt != null ? { goLiveAt: null } : {}))
			return
		}
		if (!isFutureScheduleLocal(scheduleAtLocal)) {
			setScheduleError('Choose a date and time in the future')
			return
		}
		const goLiveAt = fromDateTimeLocal(scheduleAtLocal)
		if (!goLiveAt) {
			setScheduleError('Invalid date and time')
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
		const current = new Set((article.tags ?? []).map((t) => t.toLowerCase()))
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
		collaboratorsLoading,
		handleAddCollaborator,
		handleRemoveCollaborator,
		handleToggleHidden,
		handleTransferOwnership,
		resetTransferOwnership,
		retryCollaborators,
		setCollaboratorEmail,
		transferOwnershipFailed,
		transferringOwnership
	} = collaborators
	const authorWriteRunning = collaboratorRemovingId !== null || collaboratorUpdatingId !== null

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
					<MetaSection title="Section">
						<div className="flex flex-col gap-1.5">
							<Ariakit.ComboboxProvider
								selectedValue={article.section ?? ''}
								setSelectedValue={(v) => {
									const next = typeof v === 'string' ? v : Array.isArray(v) ? v[0] : ''
									updateArticle('section', (next || null) as ArticleSection | null)
								}}
							>
								<Ariakit.ComboboxSelect
									aria-label="Article section"
									aria-invalid={publishErrors.section ? true : undefined}
									className={`${inputStyles} flex items-center justify-between gap-2 text-left ${article.section ? '' : 'text-tertiary'}`}
								>
									<span className="truncate">
										{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'Select a section…'}
									</span>
									<Ariakit.ComboboxSelectArrow className="shrink-0 text-tertiary" />
								</Ariakit.ComboboxSelect>
								<Ariakit.ComboboxPopover
									gutter={6}
									sameWidth
									portal
									unmountOnHide
									className="z-[90] flex flex-col overflow-hidden rounded-md border border-medium bg-overlay py-1 body-md shadow-xl outline-hidden"
								>
									{ARTICLE_SECTIONS.map((section) => (
										<Ariakit.ComboboxItem
											key={section}
											value={section}
											className="flex min-h-9 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-secondary data-active-item:bg-research-tint data-active-item:text-link"
										>
											<span className="truncate">{ARTICLE_SECTION_LABELS[section]}</span>
											<Ariakit.ComboboxItemCheck className="shrink-0 text-link" />
										</Ariakit.ComboboxItem>
									))}
								</Ariakit.ComboboxPopover>
							</Ariakit.ComboboxProvider>
							<MetaFieldHint error={publishErrors.section}>
								Required. Drives the URL path:{' '}
								<span className="font-mono text-secondary">
									/research/{article.section ?? '…'}/{article.slug || '…'}
								</span>
							</MetaFieldHint>
						</div>
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
							<div className="flex flex-col gap-1.5">
								<FieldLabel
									htmlFor={`${id}-report-description`}
									count={`${(article.reportDescription ?? '').length}/600`}
								>
									Report description
								</FieldLabel>
								<textarea
									id={`${id}-report-description`}
									value={article.reportDescription ?? ''}
									onChange={(event) => updateArticle('reportDescription', event.target.value.slice(0, 600))}
									placeholder="Shown on hover over the report card in the /research carousel."
									rows={4}
									maxLength={600}
									className={`${textareaStyles} resize-none`}
								/>
							</div>
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
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between gap-2">
								<label htmlFor={`${id}-display-date`} className="label-sm text-secondary">
									Display date
								</label>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => updateArticle('displayDate', new Date().toISOString())}
								>
									Set to now
								</Button>
							</div>
							<Input
								id={`${id}-display-date`}
								type="datetime-local"
								value={toDateTimeLocal(article.displayDate)}
								onChange={(event) => updateArticle('displayDate', fromDateTimeLocal(event.target.value))}
								onClick={(event) => {
									const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
									input.showPicker?.()
								}}
								onFocus={(event) => {
									const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
									input.showPicker?.()
								}}
								aria-invalid={publishErrors.displayDate ? true : undefined}
								className="cursor-pointer"
							/>
							<MetaFieldHint error={publishErrors.displayDate}>
								Shown on cards and the article header. Defaults to publish time.
							</MetaFieldHint>
						</div>
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
											setScheduleError(null)
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
									<div className="flex flex-col gap-1.5">
										<label htmlFor={`${id}-go-live`} className="label-sm text-secondary">
											Go live at
										</label>
										<Input
											id={`${id}-go-live`}
											type="datetime-local"
											value={scheduleAtLocal}
											min={minScheduleLocal}
											onChange={(event) => {
												setScheduleAtLocal(event.target.value)
												setScheduleError(null)
											}}
											onClick={(event) => {
												const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
												input.showPicker?.()
											}}
											aria-invalid={scheduleError ? true : undefined}
											className="cursor-pointer"
										/>
										<MetaFieldHint error={scheduleError}>Independent from display date.</MetaFieldHint>
									</div>
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
										<span key={slug} className="rounded-full bg-research-tint px-2 py-0.5 label-sm text-link">
											{EDITORIAL_TAGS[slug].label}
										</span>
									))}
								</div>
								<p className="body-sm text-tertiary">Managed by editors from /research/admin/curation.</p>
							</div>
						) : null}
					</MetaSection>

					<MetaSection title="URL">
						<div className="flex flex-col gap-1.5">
							<label htmlFor={`${id}-slug`} className="label-sm text-secondary">
								Slug
							</label>
							<div className="flex items-stretch gap-2">
								<Input
									id={`${id}-slug`}
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
							<p className="truncate body-sm font-mono text-tertiary">
								defillama.com/research/{article.section ? `${ARTICLE_SECTION_SLUGS[article.section]}/` : ''}
								<span className="text-secondary">{article.slug}</span>
							</p>
						</div>
					</MetaSection>

					<MetaSection title="Listing">
						<div className="flex flex-col gap-1.5">
							<label htmlFor={`${id}-subtitle`} className="label-sm text-secondary">
								Subtitle
							</label>
							<Input
								id={`${id}-subtitle`}
								value={article.subtitle ?? ''}
								onChange={(event) => updateArticle('subtitle', event.target.value)}
								placeholder="Optional secondary line shown on cards"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label htmlFor={`${id}-excerpt`} className="label-sm text-secondary">
								Excerpt
							</label>
							<textarea
								id={`${id}-excerpt`}
								value={article.excerpt ?? ''}
								onChange={(event) => updateArticle('excerpt', event.target.value)}
								placeholder="Auto-derived from your first paragraph. Override here if you want."
								rows={3}
								className={`${textareaStyles} resize-none`}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<FieldLabel htmlFor={`${id}-topics`} count={`${(article.tags ?? []).length}/12`}>
								Topics
							</FieldLabel>
							<Input
								id={`${id}-topics`}
								value={(article.tags ?? []).join(', ')}
								onChange={(event) =>
									updateArticle(
										'tags',
										event.target.value
											.split(',')
											.map((tag) => tag.trim())
											.filter(Boolean)
									)
								}
								placeholder="stablecoins, lending, ethereum"
								aria-invalid={publishErrors.tags ? true : undefined}
							/>
							{tagSuggestions.length > 0 ? (
								<div className="flex flex-wrap items-center gap-1.5 pt-0.5">
									<span className="body-sm text-tertiary">From content</span>
									{tagSuggestions.map((label) => (
										<Button
											key={label}
											type="button"
											size="sm"
											aria-label={`Add topic ${label}`}
											onClick={() => {
												const next = Array.from(new Set([...(article.tags ?? []), label]))
												updateArticle('tags', next.slice(0, 12))
											}}
										>
											<Icon name="plus" className="size-3" />
											{label}
										</Button>
									))}
								</div>
							) : null}
							<MetaFieldHint error={publishErrors.tags} />
						</div>
					</MetaSection>

					<MetaSection title="Search & social">
						<div className="flex flex-col gap-1.5">
							<FieldLabel htmlFor={`${id}-seo-title`} count={`${(article.seoTitle ?? '').length}/70`}>
								Meta title
							</FieldLabel>
							<Input
								id={`${id}-seo-title`}
								value={article.seoTitle ?? ''}
								onChange={(event) => updateArticle('seoTitle', event.target.value)}
								placeholder={article.title || 'Falls back to article title'}
								maxLength={120}
							/>
							<MetaFieldHint>
								Used for the &lt;title&gt; tag. When set, also drives the URL slug if you haven&apos;t edited it
								manually.
							</MetaFieldHint>
						</div>
						<div className="flex flex-col gap-1.5">
							<FieldLabel htmlFor={`${id}-seo-description`} count={`${(article.seoDescription ?? '').length}/160`}>
								Meta description
							</FieldLabel>
							<textarea
								id={`${id}-seo-description`}
								value={article.seoDescription ?? ''}
								onChange={(event) => updateArticle('seoDescription', event.target.value)}
								placeholder="Shown in search results and link previews. Falls back to the excerpt."
								rows={3}
								maxLength={300}
								className={`${textareaStyles} resize-none`}
							/>
						</div>
					</MetaSection>

					<MetaSection title="Authors">
						{collaboratorsLoading && authors.length === 0 ? (
							<p className="body-sm text-tertiary">Loading authors…</p>
						) : null}
						{collaboratorsLoadFailed ? (
							<InlineStatus variant="error">
								<span className="flex flex-wrap items-center justify-between gap-2">
									Couldn&apos;t load the authors.
									<Button type="button" size="sm" onClick={() => void retryCollaborators()}>
										Try again
									</Button>
								</span>
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
												<img
													src={entry.profile.avatarUrl}
													alt=""
													className="size-7 shrink-0 rounded-full object-cover"
												/>
											) : (
												<span
													aria-hidden
													className="grid size-7 shrink-0 place-items-center rounded-full bg-research-tint label-sm text-link"
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
														void runAuthorAction('list', handleToggleHidden(entry.pbUserId, !entry.hidden))
													}
												>
													{entry.hidden ? 'Show' : 'Hide'}
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													onClick={() => {
														resetTransferOwnership()
														setTransferTarget({ pbUserId: entry.pbUserId, name: entry.profile.displayName })
													}}
												>
													Make owner
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													aria-label={`Remove ${entry.profile.displayName}`}
													data-author-remove
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
							<div className="flex flex-col gap-1.5">
								<label htmlFor={`${id}-collaborator`} className="label-sm text-secondary">
									Add a co-author
								</label>
								<div className="flex gap-2">
									<Input
										id={`${id}-collaborator`}
										type="email"
										value={collaboratorEmail}
										onChange={(event) => {
											setCollaboratorEmail(event.target.value)
											if (addError) setAuthorError(null)
										}}
										onKeyDown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault()
												void runAuthorAction('add', handleAddCollaborator())
											}
										}}
										placeholder="Email address"
										readOnly={collaboratorAdding}
										aria-invalid={addError ? true : undefined}
										aria-describedby={`${id}-collaborator-hint`}
										className="min-w-0 flex-1"
									/>
									<Button
										type="button"
										size="md"
										onClick={() => void runAuthorAction('add', handleAddCollaborator())}
										pendingLabel={collaboratorAdding ? 'Adding…' : null}
									>
										Add
									</Button>
								</div>
								<p
									id={`${id}-collaborator-hint`}
									role={addError ? 'alert' : undefined}
									className={`body-sm ${addError ? 'text-data-down' : 'text-tertiary'}`}
								>
									{addError ?? 'Co-authors can edit, publish, and unpublish. Only you can manage authors or delete.'}
								</p>
							</div>
						) : isCollaborator ? (
							<p className="body-sm text-tertiary">Only the owner can manage authors.</p>
						) : null}
					</MetaSection>

					<MetaSection title="Guest co-authors">
						<p className="-mt-1 body-sm text-tertiary">
							Credit external contributors without a DefiLlama account. Added to SEO and structured data only — never
							shown on the article page.
						</p>
						{guestRows.length > 0 ? (
							<ul ref={guestListRef} className="flex flex-col gap-2">
								{guestRows.map((guest, index) => (
									<li
										key={guest.id}
										className="flex flex-col gap-2 rounded-lg border border-subtle bg-page p-3"
										aria-label={`Guest co-author ${index + 1}`}
									>
										<div className="flex items-center gap-2">
											<div role="group" aria-label="Co-author type" className="flex gap-1">
												{(['Person', 'Organization'] as const).map((type) => (
													<Button
														key={type}
														type="button"
														size="sm"
														variant="ghost"
														data-active={guest.type === type}
														aria-pressed={guest.type === type}
														onClick={() => updateGuestAuthor(index, { type })}
													>
														<Icon name={type === 'Organization' ? 'building' : 'user'} className="size-3.5" />
														{type}
													</Button>
												))}
											</div>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												square
												className="ml-auto"
												aria-label={`Remove guest co-author ${index + 1}`}
												data-guest-remove
												onClick={() => removeGuestAuthor(index)}
											>
												<Icon name="x" className="size-3.5" />
											</Button>
										</div>
										<div className="flex flex-col gap-1.5">
											<label htmlFor={`${id}-guest-${guest.id}-name`} className="label-sm text-secondary">
												Name
											</label>
											<Input
												id={`${id}-guest-${guest.id}-name`}
												value={guest.name}
												onChange={(event) => updateGuestAuthor(index, { name: event.target.value })}
												placeholder="Full name"
											/>
										</div>
										<div className="flex flex-col gap-1.5">
											<label htmlFor={`${id}-guest-${guest.id}-url`} className="label-sm text-secondary">
												Link (optional)
											</label>
											<Input
												id={`${id}-guest-${guest.id}-url`}
												type="url"
												value={guest.url ?? ''}
												onChange={(event) => updateGuestAuthor(index, { url: event.target.value })}
												placeholder="https://"
											/>
										</div>
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
						<ArticlePageAssetPicker value={assetRows} onChange={updatePageAssets} />
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
			<DialogFooter
				dismiss={
					<Ariakit.DialogDismiss
						type="button"
						disabled={running !== null}
						accessibleWhenDisabled
						render={<Button size="md" />}
					>
						{isPublished ? 'Cancel' : 'Keep editing'}
					</Ariakit.DialogDismiss>
				}
			>
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

			<ConfirmDialog
				open={transferTarget !== null}
				onClose={() => setTransferTarget(null)}
				portal
				unmountOnHide
				title={`Make ${transferTarget?.name ?? 'this co-author'} the owner?`}
				description="You become a co-author and lose the owner-only controls: managing authors and deleting the article."
				confirmLabel="Make owner"
				tone="primary"
				pendingLabel={transferringOwnership ? 'Transferring…' : null}
				// A transfer takes the owner controls away, Make owner included; the authors list showing the new owner
				// takes focus then.
				autoFocusOnHide={(trigger) => {
					if (trigger?.isConnected) return true
					authorListRef.current?.focus()
					return false
				}}
				error={transferOwnershipFailed ? "Couldn't transfer ownership. Try again." : null}
				onConfirm={() => {
					if (!transferTarget) return
					void handleTransferOwnership(transferTarget.pbUserId).then((ok) => {
						if (ok) setTransferTarget(null)
						else if (!sheetOnScreen()) toast.error("Couldn't transfer ownership. Try again.")
					})
				}}
			/>
		</SideSheet>
	)
}

function FieldLabel({ htmlFor, count, children }: { htmlFor: string; count: string; children: string }) {
	return (
		<div className="flex items-baseline justify-between gap-2">
			<label htmlFor={htmlFor} className="label-sm text-secondary">
				{children}
			</label>
			<span className="body-sm text-tertiary tabular-nums">{count}</span>
		</div>
	)
}
