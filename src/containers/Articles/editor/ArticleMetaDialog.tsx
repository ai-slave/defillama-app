import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { EDITORIAL_TAGS, isEditorialTagSlug } from '../editorialTags'
import type {
	ArticleCollaborator,
	ArticleGuestAuthor,
	ArticleImage,
	ArticlePageAsset,
	ArticleSection,
	LocalArticleDocument
} from '../types'
import { ARTICLE_SECTIONS, ARTICLE_SECTION_LABELS, ARTICLE_SECTION_SLUGS } from '../types'
import { ImageUploadButton } from '../upload/ImageUploadButton'
import { PdfUploadButton } from '../upload/PdfUploadButton'
import { Icon } from './ArticleEditorIcon'
import type { ArticleFieldUpdater } from './ArticleEditorTypes'
import { formatArticleDate, fromDateTimeLocal, slugFromTitle, toDateTimeLocal } from './ArticleEditorUtils'
import { MetaFieldHint, MetaSection, MetaSwitch } from './ArticleMetaFields'
import { ArticlePageAssetPicker } from './ArticlePageAssetPicker'

type DialogStore = ReturnType<typeof Ariakit.useDialogStore>

function isFutureScheduleLocal(local: string): boolean {
	const iso = fromDateTimeLocal(local)
	if (!iso) return false
	return new Date(iso) > new Date()
}

type ArticleMetaDialogProps = {
	article: LocalArticleDocument
	articleIsScheduled: boolean
	collaboratorAdding: boolean
	collaboratorEmail: string
	collaboratorError: string | null
	collaborators: Array<ArticleCollaborator>
	collaboratorsLoadError: string | null
	collaboratorsLoading: boolean
	hasPendingEdits: boolean
	isCollaborator: boolean
	isDiscarding: boolean
	isOwner: boolean
	isPublished: boolean
	isPublishing: boolean
	isSaving: boolean
	publishErrors: Record<string, string>
	store: DialogStore
	handleAddCollaborator: () => Promise<void>
	handlePublish: (opts?: { goLiveAt?: string | null }) => Promise<boolean>
	handleRemoveCollaborator: (pbUserId: string) => Promise<void>
	handleToggleHidden: (pbUserId: string, nextHidden: boolean) => Promise<void>
	handleTransferOwnership: (pbUserId: string, displayName: string) => Promise<void>
	saveArticle: () => Promise<boolean>
	setCollaboratorEmail: Dispatch<SetStateAction<string>>
	setCollaboratorError: Dispatch<SetStateAction<string | null>>
	updateArticle: ArticleFieldUpdater
}

export function ArticleMetaDialog({
	article,
	articleIsScheduled,
	collaboratorAdding,
	collaboratorEmail,
	collaboratorError,
	collaborators,
	collaboratorsLoadError,
	collaboratorsLoading,
	handleAddCollaborator,
	handlePublish,
	handleRemoveCollaborator,
	handleToggleHidden,
	handleTransferOwnership,
	hasPendingEdits,
	isCollaborator,
	isDiscarding,
	isOwner,
	isPublished,
	isPublishing,
	isSaving,
	publishErrors,
	saveArticle,
	setCollaboratorEmail,
	setCollaboratorError,
	store,
	updateArticle
}: ArticleMetaDialogProps) {
	const dialogOpen = Ariakit.useStoreState(store, 'open')
	const [scheduleMode, setScheduleMode] = useState(false)
	const [scheduleAtLocal, setScheduleAtLocal] = useState('')
	const [scheduleError, setScheduleError] = useState<string | null>(null)
	const [guestRows, setGuestRows] = useState<Array<ArticleGuestAuthor & { id: string }>>(() =>
		(article.guestAuthors ?? []).map((guest) => ({ ...guest, id: crypto.randomUUID() }))
	)
	const [assetRows, setAssetRows] = useState<Array<ArticlePageAsset>>(() => article.pageAssets ?? [])

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
		}
	}

	const minScheduleLocal = toDateTimeLocal(new Date().toISOString())

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
	const removeGuestAuthor = (index: number) => {
		const next = guestRows.filter((_, i) => i !== index)
		setGuestRows(next)
		commitGuestAuthors(next)
	}

	const updatePageAssets = (rows: Array<ArticlePageAsset>) => {
		setAssetRows(rows)
		updateArticle('pageAssets', rows)
	}

	return (
		<Ariakit.Dialog
			store={store}
			backdrop={
				<div className="fixed inset-0 z-40 bg-research-invert/30 opacity-0 backdrop-blur-sm transition-opacity duration-200 data-[enter]:opacity-100 data-[leave]:opacity-0" />
			}
			className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-md translate-x-full flex-col overflow-y-auto border-l border-medium bg-surface p-6 shadow-2xl transition-transform duration-300 data-[enter]:translate-x-0 data-[leave]:translate-x-full"
		>
			<div className="mb-1 flex items-start justify-between gap-3">
				<div className="grid gap-1">
					<Ariakit.DialogHeading className="text-lg font-semibold tracking-tight text-primary">
						{isPublished ? 'Edit listing' : 'Review & publish'}
					</Ariakit.DialogHeading>
					<p className="text-xs text-tertiary">
						{isPublished
							? 'These details appear on the public article page and in shares.'
							: 'A quick review before this goes live.'}
					</p>
				</div>
				<Ariakit.DialogDismiss
					aria-label="Close"
					className="rounded-md p-1.5 text-secondary hover:bg-research-tint-hover"
				>
					<Icon name="x" className="size-4" />
				</Ariakit.DialogDismiss>
			</div>

			<div className="mt-6 grid gap-6">
				<MetaSection title="Section">
					<div className="grid gap-1.5">
						<Ariakit.ComboboxProvider
							selectedValue={article.section ?? ''}
							setSelectedValue={(v) => {
								const next = typeof v === 'string' ? v : Array.isArray(v) ? v[0] : ''
								updateArticle('section', (next || null) as ArticleSection | null)
							}}
						>
							<Ariakit.ComboboxSelect
								aria-label="Article section"
								className={`flex h-10 items-center justify-between gap-2 rounded-md border bg-page px-3 text-sm transition-colors focus-visible:border-link focus-visible:outline-hidden data-[state=open]:border-link ${
									publishErrors.section
										? 'border-error/60 text-primary'
										: article.section
											? 'border-medium text-primary hover:border-tertiary'
											: 'border-medium text-tertiary hover:border-tertiary'
								}`}
							>
								<span className="truncate text-left">
									{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'Select a section…'}
								</span>
								<Ariakit.ComboboxSelectArrow className="shrink-0 text-tertiary" />
							</Ariakit.ComboboxSelect>
							<Ariakit.ComboboxPopover
								gutter={6}
								sameWidth
								portal
								unmountOnHide
								className="z-[90] flex flex-col overflow-hidden rounded-md border border-medium bg-surface py-1 text-sm shadow-xl outline-hidden"
							>
								{ARTICLE_SECTIONS.map((section) => (
									<Ariakit.ComboboxItem
										key={section}
										value={section}
										className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-secondary data-active-item:bg-research-tint data-active-item:text-link"
									>
										<span className="truncate">{ARTICLE_SECTION_LABELS[section]}</span>
										<Ariakit.ComboboxItemCheck className="shrink-0 text-link" />
									</Ariakit.ComboboxItem>
								))}
							</Ariakit.ComboboxPopover>
						</Ariakit.ComboboxProvider>
						<MetaFieldHint error={publishErrors.section}>
							Required. Drives the URL path:{' '}
							<span className="font-jetbrains text-secondary">
								/research/{article.section ?? '…'}/{article.slug || '…'}
							</span>
						</MetaFieldHint>
					</div>
				</MetaSection>

				{article.section === 'report' ? (
					<MetaSection title="Report">
						<div className="grid gap-1.5">
							<span className="text-xs text-secondary">Carousel image</span>
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
						<div className="grid gap-1.5">
							<span className="text-xs text-secondary">Sponsor logo</span>
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
						<label className="grid gap-1.5">
							<span className="flex items-baseline justify-between gap-2 text-xs text-secondary">
								<span>Report description</span>
								<span className="font-jetbrains text-[10px] text-tertiary">
									{(article.reportDescription ?? '').length}/600
								</span>
							</span>
							<textarea
								value={article.reportDescription ?? ''}
								onChange={(event) => updateArticle('reportDescription', event.target.value.slice(0, 600))}
								placeholder="Shown on hover over the report card in the /research carousel."
								rows={4}
								maxLength={600}
								className="resize-none rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
							/>
						</label>
						<div className="grid gap-1.5">
							<span className="text-xs text-secondary">Report PDF</span>
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
					<label className="grid gap-1.5">
						<span className="flex items-baseline justify-between gap-2 text-xs text-secondary">
							<span>Display date</span>
							<button
								type="button"
								onClick={() => updateArticle('displayDate', new Date().toISOString())}
								className="font-jetbrains text-[10px] tracking-[0.16em] text-tertiary uppercase transition-colors hover:text-link"
							>
								Set to now
							</button>
						</span>
						<input
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
							className={`cursor-pointer rounded-md border bg-page px-3 py-2 text-sm text-primary transition-colors focus:outline-hidden ${
								publishErrors.displayDate ? 'border-error/60 focus:border-error' : 'border-medium focus:border-link'
							}`}
						/>
						<MetaFieldHint error={publishErrors.displayDate}>
							Shown on cards and the article header. Defaults to publish time.
						</MetaFieldHint>
					</label>
					{!isPublished ? (
						<>
							{articleIsScheduled ? (
								<div className="flex flex-wrap items-center gap-2 rounded-md border border-research-accent/30 bg-research-accent/5 px-3 py-2">
									<span className="font-jetbrains text-[10px] tracking-[0.18em] text-link uppercase">Scheduled</span>
									<span className="text-xs text-secondary">Goes live {formatArticleDate(article.goLiveAt)}</span>
								</div>
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
								<label className="grid gap-1.5">
									<span className="text-xs text-secondary">Go live at</span>
									<input
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
										className={`cursor-pointer rounded-md border bg-page px-3 py-2 text-sm text-primary transition-colors focus:outline-hidden ${
											scheduleError ? 'border-error/60 focus:border-error' : 'border-medium focus:border-link'
										}`}
									/>
									<MetaFieldHint error={scheduleError}>Independent from display date.</MetaFieldHint>
								</label>
							) : null}
						</>
					) : null}
					{article.firstPublishedAt || article.lastPublishedAt ? (
						<div className="grid gap-1 rounded-md border border-medium bg-page/50 px-3 py-2.5">
							{article.firstPublishedAt ? (
								<div className="flex items-baseline justify-between gap-3">
									<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">
										First publish
									</span>
									<span className="font-jetbrains text-[11px] text-secondary tabular-nums">
										{formatArticleDate(article.firstPublishedAt)}
									</span>
								</div>
							) : null}
							{article.lastPublishedAt ? (
								<div className="flex items-baseline justify-between gap-3">
									<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">
										Last publish
									</span>
									<span className="font-jetbrains text-[11px] text-secondary tabular-nums">
										{formatArticleDate(article.lastPublishedAt)}
									</span>
								</div>
							) : null}
						</div>
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
						<div className="grid gap-1.5">
							<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">Editorial</span>
							<div className="flex flex-wrap gap-1.5">
								{article.editorialTags.filter(isEditorialTagSlug).map((slug) => (
									<span
										key={slug}
										className="inline-flex items-center gap-1 rounded-full bg-research-tint px-2 py-0.5 font-jetbrains text-[10px] tracking-[0.18em] text-link uppercase"
									>
										{EDITORIAL_TAGS[slug].label}
									</span>
								))}
							</div>
							<p className="text-xs text-tertiary">Managed by editors from /research/admin/curation.</p>
						</div>
					) : null}
				</MetaSection>

				<MetaSection title="URL">
					<div className="grid gap-1.5">
						<div className="flex items-stretch gap-1.5">
							<input
								value={article.slug}
								onChange={(event) => updateArticle('slug', event.target.value)}
								className="flex-1 rounded-md border border-medium bg-page px-3 py-2 font-jetbrains text-xs text-primary focus:border-link focus:outline-hidden"
							/>
							{(() => {
								const candidate = slugFromTitle(article.title)
								const disabled = !article.title.trim() || candidate === article.slug
								return (
									<button
										type="button"
										disabled={disabled}
										onClick={() => updateArticle('slug', candidate)}
										title={
											disabled
												? candidate === article.slug
													? 'Slug already matches title'
													: 'Add a title first'
												: `Regenerate as ${candidate}`
										}
										className="flex shrink-0 items-center gap-1.5 rounded-md border border-medium bg-surface px-2.5 font-jetbrains text-[10px] tracking-[0.16em] text-secondary uppercase transition-colors hover:border-link/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-medium disabled:hover:text-secondary"
									>
										<span aria-hidden>↻</span>
										<span>Regenerate</span>
									</button>
								)
							})()}
						</div>
						<span className="truncate font-jetbrains text-[10px] text-tertiary">
							defillama.com/research/{article.section ? `${ARTICLE_SECTION_SLUGS[article.section]}/` : ''}
							<span className="text-secondary">{article.slug}</span>
						</span>
					</div>
				</MetaSection>

				<MetaSection title="Listing">
					<label className="grid gap-1.5">
						<span className="text-xs text-secondary">Subtitle</span>
						<input
							value={article.subtitle ?? ''}
							onChange={(event) => updateArticle('subtitle', event.target.value)}
							placeholder="Optional secondary line shown on cards"
							className="rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
						/>
					</label>
					<label className="grid gap-1.5">
						<span className="text-xs text-secondary">Excerpt</span>
						<textarea
							value={article.excerpt ?? ''}
							onChange={(event) => updateArticle('excerpt', event.target.value)}
							placeholder="Auto-derived from your first paragraph. Override here if you want."
							rows={3}
							className="resize-none rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
						/>
					</label>
					<div className="grid gap-1.5">
						<span className="flex items-baseline justify-between gap-2 text-xs text-secondary">
							<span>Topics</span>
							<span className="font-jetbrains text-[10px] text-tertiary tabular-nums">
								{(article.tags ?? []).length}/12
							</span>
						</span>
						<input
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
							className={`rounded-md border bg-page px-3 py-2 text-sm text-primary transition-colors placeholder:text-tertiary focus:outline-hidden ${
								publishErrors.tags ? 'border-error/60 focus:border-error' : 'border-medium focus:border-link'
							}`}
						/>
						{(() => {
							const current = new Set((article.tags ?? []).map((t) => t.toLowerCase()))
							const suggestions = (article.entities ?? [])
								.map((e) => e.label || e.slug)
								.filter((label) => label && !current.has(label.toLowerCase()))
								.slice(0, 8)
							if (suggestions.length === 0) return null
							return (
								<div className="flex flex-wrap items-center gap-1.5 pt-0.5">
									<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">
										From content
									</span>
									{suggestions.map((label) => (
										<button
											key={label}
											type="button"
											onClick={() => {
												const next = Array.from(new Set([...(article.tags ?? []), label]))
												updateArticle('tags', next.slice(0, 12))
											}}
											className="group inline-flex items-center gap-1 rounded-full border border-medium bg-page px-2 py-0.5 text-[11px] text-secondary transition-colors hover:border-link/50 hover:bg-research-tint hover:text-link"
										>
											<span aria-hidden className="text-tertiary transition-colors group-hover:text-link">
												+
											</span>
											{label}
										</button>
									))}
								</div>
							)
						})()}
						<MetaFieldHint error={publishErrors.tags} />
					</div>
				</MetaSection>

				<MetaSection title="Search & social">
					<label className="grid gap-1.5">
						<span className="flex items-baseline justify-between gap-2 text-xs text-secondary">
							<span>Meta title</span>
							<span className="font-jetbrains text-[10px] text-tertiary">{(article.seoTitle ?? '').length}/70</span>
						</span>
						<input
							value={article.seoTitle ?? ''}
							onChange={(event) => updateArticle('seoTitle', event.target.value)}
							placeholder={article.title || 'Falls back to article title'}
							maxLength={120}
							className="rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
						/>
						<span className="text-[11px] text-tertiary">
							Used for the &lt;title&gt; tag. When set, also drives the URL slug if you haven't edited it manually.
						</span>
					</label>
					<label className="grid gap-1.5">
						<span className="flex items-baseline justify-between gap-2 text-xs text-secondary">
							<span>Meta description</span>
							<span className="font-jetbrains text-[10px] text-tertiary">
								{(article.seoDescription ?? '').length}/160
							</span>
						</span>
						<textarea
							value={article.seoDescription ?? ''}
							onChange={(event) => updateArticle('seoDescription', event.target.value)}
							placeholder="Shown in search results and link previews. Falls back to the excerpt."
							rows={3}
							maxLength={300}
							className="resize-none rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
						/>
					</label>
				</MetaSection>

				<MetaSection title="Authors">
					<div className="grid gap-2">
						{collaboratorsLoading && collaborators.length === 0 ? (
							<div className="text-xs text-tertiary">Loading…</div>
						) : null}
						{collaboratorsLoadError ? <div className="text-xs text-error">{collaboratorsLoadError}</div> : null}
						{collaborators.map((entry) => (
							<div
								key={entry.pbUserId}
								className="flex items-center justify-between gap-3 rounded-md border border-medium bg-page px-3 py-2"
							>
								<div className="flex min-w-0 items-center gap-2">
									{entry.profile.avatarUrl ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img src={entry.profile.avatarUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />
									) : (
										<span className="grid size-7 shrink-0 place-items-center rounded-full bg-research-tint text-[11px] font-medium text-link">
											{entry.profile.displayName.slice(0, 2).toUpperCase()}
										</span>
									)}
									<div className="min-w-0">
										<div className="truncate text-sm text-primary">{entry.profile.displayName}</div>
										<div className="text-[10px] tracking-[0.18em] text-tertiary uppercase">
											{entry.role === 'owner' ? 'Owner' : entry.hidden ? 'Co-author · Hidden' : 'Co-author'}
										</div>
									</div>
								</div>
								{isOwner && entry.role === 'collaborator' ? (
									<div className="flex items-center gap-3">
										<button
											type="button"
											onClick={() => handleToggleHidden(entry.pbUserId, !entry.hidden)}
											className="text-xs text-tertiary transition-colors hover:text-link"
											title={entry.hidden ? 'Show in byline' : 'Hide from byline'}
										>
											{entry.hidden ? 'Show' : 'Hide'}
										</button>
										<button
											type="button"
											onClick={() => handleTransferOwnership(entry.pbUserId, entry.profile.displayName)}
											className="text-xs text-tertiary transition-colors hover:text-link"
											title="Transfer ownership to this co-author"
										>
											Make owner
										</button>
										<button
											type="button"
											onClick={() => handleRemoveCollaborator(entry.pbUserId)}
											className="text-xs text-tertiary transition-colors hover:text-error"
										>
											Remove
										</button>
									</div>
								) : null}
							</div>
						))}
					</div>
					{isOwner ? (
						<div className="grid gap-1.5">
							<div className="flex gap-2">
								<input
									type="email"
									value={collaboratorEmail}
									onChange={(event) => {
										setCollaboratorEmail(event.target.value)
										if (collaboratorError) setCollaboratorError(null)
									}}
									onKeyDown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault()
											void handleAddCollaborator()
										}
									}}
									placeholder="Add co-author by email"
									disabled={collaboratorAdding}
									className="flex-1 rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden disabled:opacity-60"
								/>
								<button
									type="button"
									onClick={handleAddCollaborator}
									disabled={collaboratorAdding || !collaboratorEmail.trim()}
									className="rounded-md bg-link px-3 text-xs font-medium text-on-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{collaboratorAdding ? 'Adding…' : 'Add'}
								</button>
							</div>
							{collaboratorError ? (
								<span className="text-xs text-error">{collaboratorError}</span>
							) : (
								<span className="text-[11px] text-tertiary">
									Co-authors can edit, publish, and unpublish. Only you can manage authors or delete.
								</span>
							)}
						</div>
					) : isCollaborator ? (
						<span className="text-[11px] text-tertiary">Only the owner can manage authors.</span>
					) : null}
				</MetaSection>

				<MetaSection title="Guest co-authors">
					<p className="-mt-1 text-[11px] leading-snug text-tertiary">
						Credit external contributors without a DefiLlama account. Added to SEO and structured data only — never
						shown on the article page.
					</p>
					{guestRows.length > 0 ? (
						<div className="grid gap-2">
							{guestRows.map((guest, index) => (
								<div
									key={guest.id}
									className="group flex items-start gap-2.5 rounded-lg border border-medium bg-page px-2.5 py-2 transition-colors focus-within:border-link/50 hover:border-tertiary/40"
								>
									<div
										role="group"
										aria-label="Co-author type"
										className="mt-0.5 inline-flex shrink-0 rounded-full border border-medium bg-surface p-0.5"
									>
										{(['Person', 'Organization'] as const).map((type) => {
											const active = guest.type === type
											return (
												<button
													key={type}
													type="button"
													onClick={() => updateGuestAuthor(index, { type })}
													aria-pressed={active}
													title={type}
													className={`grid size-6 place-items-center rounded-full transition-colors ${
														active ? 'bg-research-tint text-link' : 'text-tertiary hover:text-secondary'
													}`}
												>
													<Icon name={type === 'Organization' ? 'building' : 'user'} className="size-3.5" />
												</button>
											)
										})}
									</div>

									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<input
												value={guest.name}
												onChange={(event) => updateGuestAuthor(index, { name: event.target.value })}
												placeholder="Full name"
												aria-label="Co-author name"
												className="min-w-0 flex-1 bg-transparent text-sm font-medium text-primary placeholder:font-normal placeholder:text-tertiary focus:outline-hidden"
											/>
											<button
												type="button"
												onClick={() => removeGuestAuthor(index)}
												aria-label="Remove co-author"
												className="grid size-6 shrink-0 place-items-center rounded-md text-tertiary opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-research-tint-hover hover:text-error focus-visible:opacity-100"
											>
												<Icon name="x" className="size-3.5" />
											</button>
										</div>
										<div className="mt-0.5 flex items-center gap-1.5">
											<Icon
												name="link"
												className={`size-3 shrink-0 ${guest.url ? 'text-secondary' : 'text-tertiary'}`}
											/>
											<input
												type="url"
												value={guest.url ?? ''}
												onChange={(event) => updateGuestAuthor(index, { url: event.target.value })}
												placeholder="Link (optional)"
												aria-label="Co-author link"
												className="min-w-0 flex-1 bg-transparent text-xs text-secondary placeholder:text-tertiary focus:outline-hidden"
											/>
										</div>
									</div>
								</div>
							))}
						</div>
					) : null}
					<button
						type="button"
						onClick={addGuestAuthor}
						className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-medium px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:border-link/50 hover:bg-research-tint hover:text-link"
					>
						<Icon name="plus" className="size-3.5" />
						Add co-author
					</button>
				</MetaSection>

				<MetaSection title="Assets on this page">
					<ArticlePageAssetPicker value={assetRows} onChange={updatePageAssets} />
				</MetaSection>
			</div>

			<div className="mt-auto grid gap-2 border-t border-medium pt-4">
				{isPublished ? (
					hasPendingEdits ? (
						<button
							type="button"
							disabled={isPublishing || isSaving || isDiscarding}
							onClick={async () => {
								const ok = await handlePublish()
								if (ok) store.hide()
							}}
							className="flex h-10 items-center justify-center gap-2 rounded-md bg-success px-4 text-sm font-medium text-on-brand shadow-publish transition-all hover:bg-success disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isPublishing ? 'Publishing…' : 'Publish update'}
						</button>
					) : (
						<button
							type="button"
							disabled={isSaving}
							onClick={async () => {
								if (await saveArticle()) store.hide()
							}}
							className="flex h-10 items-center justify-center rounded-md bg-link px-4 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSaving ? 'Saving…' : 'Save changes'}
						</button>
					)
				) : (
					<>
						{articleIsScheduled ? (
							<button
								type="button"
								disabled={isPublishing || isSaving || !article.id}
								onClick={async () => {
									const ok = await handlePublish({ goLiveAt: null })
									if (ok) store.hide()
								}}
								className="flex h-10 items-center justify-center gap-2 rounded-md border border-medium bg-page px-4 text-sm font-medium text-primary transition-colors hover:border-link/40 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isPublishing ? 'Publishing…' : 'Publish now'}
							</button>
						) : null}
						<button
							type="button"
							disabled={isPublishing || isSaving || !article.id}
							onClick={async () => {
								if (scheduleMode) {
									if (!isFutureScheduleLocal(scheduleAtLocal)) {
										setScheduleError('Choose a date and time in the future')
										return
									}
									const goLiveAt = fromDateTimeLocal(scheduleAtLocal)
									if (!goLiveAt) {
										setScheduleError('Invalid date and time')
										return
									}
									const ok = await handlePublish({ goLiveAt })
									if (ok) store.hide()
									return
								}
								const ok = await handlePublish(article.goLiveAt != null ? { goLiveAt: null } : {})
								if (ok) store.hide()
							}}
							className="flex h-10 items-center justify-center gap-2 rounded-md bg-success px-4 text-sm font-medium text-on-brand shadow-publish transition-all hover:bg-success disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isPublishing
								? scheduleMode
									? 'Scheduling…'
									: 'Publishing…'
								: scheduleMode
									? 'Schedule'
									: 'Publish now'}
						</button>
					</>
				)}
				<button
					type="button"
					onClick={() => store.hide()}
					className="text-xs text-tertiary transition-colors hover:text-primary"
				>
					{isPublished ? 'Cancel' : 'Keep editing'}
				</button>
			</div>
		</Ariakit.Dialog>
	)
}
