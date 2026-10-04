import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { MultiSelectCombobox } from '~/components/Select/MultiSelectCombobox'
import { ArticleMultiPicker } from '~/containers/Articles/admin/ArticleMultiPicker'
import { ArticlePicker } from '~/containers/Articles/admin/ArticlePicker'
import {
	bannerToForm,
	buildPayload,
	DISCLOSURE_TEXT_MAX,
	IMAGE_ALT_MAX,
	LINK_LABEL_MAX,
	LINK_URL_MAX,
	TEXT_MAX,
	validateBannerForm,
	type BannerFormState
} from '~/containers/Articles/admin/bannerFormState'
import { SavedChangedNotice, sameValue, useSavedDraft } from '~/containers/Articles/admin/savedDraft'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import { ArticleApiError, createBanner, deleteBanner, updateBanner } from '~/containers/Articles/api'
import {
	BANNER_COUNTRY_GROUPS,
	BANNER_COUNTRY_OPTIONS,
	expandBannerCountrySelection
} from '~/containers/Articles/bannerCountryGroups'
import { articlePromoLinkUrl, landingPromoLinkUrl } from '~/containers/Articles/promoLinks'
import type { ArticleSection, Banner, BannerKind } from '~/containers/Articles/types'
import {
	ARTICLE_SECTIONS,
	ARTICLE_SECTION_LABELS,
	BANNER_KIND_DESCRIPTIONS,
	BANNER_KIND_LABELS,
	BANNER_KINDS,
	BANNER_SCOPES,
	BANNER_SCOPE_LABELS
} from '~/containers/Articles/types'
import { ImageUploadButton } from '~/containers/Articles/upload/ImageUploadButton'
import type { UploadScope } from '~/containers/Articles/upload/useImageUpload'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'

function imageUploadConfig(state: BannerFormState): { scope: UploadScope; helperText: string } {
	if (state.kind === 'image-square') {
		return {
			scope: 'banner-landing-square',
			helperText: 'Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1088 × 1016, transcoded to WebP.'
		}
	}
	if (state.scope === 'landing') {
		if (state.kind === 'image-horizontal') {
			return {
				scope: 'banner-landing-mobile',
				helperText: 'Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1200 × 600, transcoded to WebP.'
			}
		}
		return {
			scope: 'banner-landing-desktop',
			helperText: 'Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 2745 × 380, transcoded to WebP.'
		}
	}
	if (state.kind === 'image-horizontal') {
		return {
			scope: 'banner-image-horizontal',
			helperText: 'Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1600 × 600, transcoded to WebP.'
		}
	}
	return {
		scope: 'banner-image',
		helperText: 'Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 800 × 1200, transcoded to WebP.'
	}
}

type Props = {
	banner: Banner | null
}

export function BannerForm({ banner }: Props) {
	const [confirmDelete, setConfirmDelete] = useState(false)
	const router = useRouter()
	const { authorizedFetch } = useAuthContext()
	const revalidateLanding = useResearchLandingRevalidation()
	const {
		draft: state,
		setDraft: setState,
		dirty,
		conflict,
		loadSaved,
		acceptSaved
	} = useSavedDraft(banner, banner?.id ?? null, bannerToForm, sameValue)

	const errors = validateBannerForm(state)
	const hasError = Object.keys(errors).length > 0

	// Refresh shared data after navigation; draft updates and redirects belong to this form's lifetime.
	const saveMutation = useMutation({
		mutationFn: async (submitted: BannerFormState) => {
			const payload = buildPayload(submitted)
			if (banner) return updateBanner(banner.id, payload, authorizedFetch)
			return createBanner(payload, authorizedFetch)
		},
		onSuccess: () => {
			revalidateLanding()
			toast.success(banner ? 'Banner saved' : 'Banner created')
		},
		onError: (error) => {
			toast.error(error instanceof ArticleApiError ? error.message : 'Failed to save')
		}
	})

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteBanner(id, authorizedFetch),
		onSuccess: () => {
			revalidateLanding()
		}
	})

	const update = (patch: Partial<BannerFormState>) => setState((prev) => ({ ...prev, ...patch }))
	const imageUpload = imageUploadConfig(state)

	const handleKindChange = (kind: BannerKind) => {
		update({ kind })
	}

	const visibleScopes = BANNER_SCOPES
	const countriesCoveredByGroups = new Set<string>()
	const selectedGroupIds = new Set(state.targetGroups)
	for (const group of BANNER_COUNTRY_GROUPS) {
		if (!selectedGroupIds.has(group.id)) continue
		for (const country of group.countries) countriesCoveredByGroups.add(country)
	}
	const availableCountryOptions = BANNER_COUNTRY_OPTIONS.filter((option) => !countriesCoveredByGroups.has(option.value))

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (hasError) return
		saveMutation.mutate(state, {
			onSuccess: (saved) => {
				acceptSaved(bannerToForm(saved), state)
				if (!banner && saved?.id) {
					router.push(`/research/admin/banners/${saved.id}`)
				}
			}
		})
	}

	const previewBanner: Banner = {
		id: banner?.id ?? 'preview',
		type: state.kind,
		scope: state.kind === 'promo' || state.kind === 'image-square' ? 'landing' : state.scope,
		section: state.kind !== 'image-square' && state.scope === 'section' ? (state.section as ArticleSection) : null,
		articleId: state.kind !== 'image-square' && state.scope === 'article' ? state.articleId : null,
		excludedArticleIds: state.excludedArticleIds,
		targetCountries:
			state.audienceMode === 'selected' ? expandBannerCountrySelection(state.targetGroups, state.targetCountries) : [],
		text: state.kind === 'text' ? state.text || 'Banner preview text — write your message above' : null,
		linkUrl: state.linkUrl.trim() || null,
		linkLabel: state.kind === 'text' ? state.linkLabel.trim() || null : null,
		imageUrl: state.kind !== 'text' && state.kind !== 'promo' ? state.imageUrl.trim() || null : null,
		imageAlt: state.kind !== 'text' ? state.imageAlt.trim() || null : null,
		imageWideUrl: state.kind === 'promo' ? state.imageWideUrl.trim() || null : null,
		imageCardUrl: state.kind === 'promo' ? state.imageCardUrl.trim() || null : null,
		imageMobileUrl: state.kind === 'promo' ? state.imageMobileUrl.trim() || null : null,
		imageLandingMobileUrl: state.kind === 'promo' ? state.imageLandingMobileUrl.trim() || null : null,
		disclosureText: state.kind === 'promo' ? state.disclosureText.trim() || null : null,
		disclosureUrl: state.kind === 'promo' ? state.disclosureUrl.trim() || null : null,
		landingLinkUrl: state.kind === 'promo' ? state.landingLinkUrl.trim() || null : null,
		articleLinkUrl: state.kind === 'promo' ? state.articleLinkUrl.trim() || null : null,
		showOnLanding: state.kind === 'promo' ? state.showOnLanding : true,
		enabled: true,
		createdByPbUserId: banner?.createdByPbUserId ?? '',
		createdAt: banner?.createdAt ?? '',
		updatedAt: banner?.updatedAt ?? ''
	}

	return (
		<form onSubmit={handleSubmit} className="mx-auto grid w-full max-w-4xl gap-0 px-1 pb-28">
			<BannerPreview banner={previewBanner} />

			<Section
				title="Kind"
				description="Text shows as a dismissible strip at the top of the page. Desktop images are used by landing placements or the article right rail. Wide/mobile images are used by landing placements or the mobile article body. Promo is a shared placement below Latest on the landing page and on every article. Square landing banner shows inside Latest on the landing page in place of articles 4-6."
			>
				<div className="grid gap-2 sm:grid-cols-2">
					{BANNER_KINDS.map((kind) => (
						<label
							key={kind}
							className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
								state.kind === kind ? 'border-link/60 bg-research-tint' : 'border-medium hover:border-link/40'
							}`}
						>
							<input
								type="radio"
								name="kind"
								value={kind}
								checked={state.kind === kind}
								onChange={() => handleKindChange(kind)}
								className="mt-0.5 accent-link"
							/>
							<div className="grid gap-0.5">
								<span className="text-sm font-medium text-primary">{BANNER_KIND_LABELS[kind]}</span>
								<span className="text-xs text-tertiary">{BANNER_KIND_DESCRIPTIONS[kind]}</span>
							</div>
						</label>
					))}
				</div>
			</Section>

			{state.kind === 'image-square' ? (
				<Section title="Placement" description="Where this banner appears.">
					<p className="text-sm text-secondary">
						Shows inside the Latest widget on /research, replacing articles 4-6. Hidden automatically when disabled.
					</p>
				</Section>
			) : state.kind === 'promo' ? (
				<Section
					title="Placement"
					description="The promo shows below Latest on the landing page and on every article. Narrow it down here."
				>
					<label className="flex items-center gap-3">
						<input
							type="checkbox"
							checked={state.showOnLanding}
							onChange={(e) => update({ showOnLanding: e.target.checked })}
							className="size-4 accent-link"
						/>
						<span className="text-sm text-primary">Show on the landing page</span>
					</label>

					<div className="grid gap-1.5">
						<span className="text-sm font-medium text-primary">
							Hide on these articles <span className="font-normal text-tertiary">(optional)</span>
						</span>
						<ArticleMultiPicker
							value={state.excludedArticleIds}
							onChange={(ids) => update({ excludedArticleIds: ids })}
							hint="The promo shows on every article except the ones listed here."
						/>
					</div>
				</Section>
			) : (
				<Section title="Scope" description="Where should this banner appear?">
					<div className="grid gap-2">
						{visibleScopes.map((scope) => (
							<label
								key={scope}
								className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
									state.scope === scope ? 'border-link/60 bg-research-tint' : 'border-medium hover:border-link/40'
								}`}
							>
								<input
									type="radio"
									name="scope"
									value={scope}
									checked={state.scope === scope}
									onChange={() => update({ scope })}
									className="mt-0.5 accent-link"
								/>
								<div className="grid gap-0.5">
									<span className="text-sm font-medium text-primary">{BANNER_SCOPE_LABELS[scope]}</span>
									<span className="text-xs text-tertiary">
										{scope === 'landing'
											? 'Shows on /research'
											: scope === 'section'
												? 'Shows on every article in the chosen section'
												: scope === 'all_articles'
													? 'Shows on every article'
													: 'Shows only on the chosen article'}
									</span>
								</div>
							</label>
						))}
					</div>

					{state.scope === 'section' ? (
						<div className="grid gap-1.5">
							<span className="text-sm font-medium text-primary">Section</span>
							<Ariakit.ComboboxProvider
								selectedValue={state.section}
								setSelectedValue={(v) => {
									const next = typeof v === 'string' ? v : Array.isArray(v) ? v[0] : ''
									update({ section: next as ArticleSection })
								}}
							>
								<Ariakit.ComboboxSelect
									aria-label="Banner section"
									className={`flex h-10 items-center justify-between gap-2 rounded-md border bg-page px-3 text-sm transition-colors focus-visible:border-link focus-visible:outline-hidden data-[state=open]:border-link ${
										errors.section
											? 'border-error/60 text-primary'
											: state.section
												? 'border-medium text-primary'
												: 'border-medium text-tertiary'
									}`}
								>
									<span className="truncate text-left">
										{state.section ? ARTICLE_SECTION_LABELS[state.section as ArticleSection] : 'Select a section…'}
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
							{errors.section ? <p className="text-xs text-error">{errors.section}</p> : null}
						</div>
					) : null}

					{state.scope === 'article' ? (
						<div className="grid gap-1.5">
							<span className="text-sm font-medium text-primary">Article</span>
							<ArticlePicker
								value={state.articleId}
								onChange={(article) => update({ articleId: article?.id ?? null })}
								error={errors.articleId}
							/>
						</div>
					) : null}

					{state.scope === 'all_articles' ? (
						<div className="grid gap-1.5">
							<span className="text-sm font-medium text-primary">
								Hide on these articles <span className="font-normal text-tertiary">(optional)</span>
							</span>
							<ArticleMultiPicker
								value={state.excludedArticleIds}
								onChange={(ids) => update({ excludedArticleIds: ids })}
								hint="The banner shows on every article except the ones listed here."
							/>
						</div>
					) : null}
				</Section>
			)}

			<Section
				title="Audience"
				description="Show this banner globally or only to visitors in selected regions and countries."
			>
				<div className="grid gap-2 sm:grid-cols-2">
					{(
						[
							['global', 'Global', 'Show to every visitor'],
							['selected', 'Selected locations', 'Show only when the visitor country matches']
						] as const
					).map(([mode, label, description]) => (
						<label
							key={mode}
							className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
								state.audienceMode === mode ? 'border-link/60 bg-research-tint' : 'border-medium hover:border-link/40'
							}`}
						>
							<input
								type="radio"
								name="audience"
								value={mode}
								checked={state.audienceMode === mode}
								onChange={() => update({ audienceMode: mode })}
								className="mt-0.5 accent-link"
							/>
							<div className="grid gap-0.5">
								<span className="text-sm font-medium text-primary">{label}</span>
								<span className="text-xs text-tertiary">{description}</span>
							</div>
						</label>
					))}
				</div>

				{state.audienceMode === 'selected' ? (
					<div className="grid gap-5">
						<div className="grid gap-2">
							<span className="text-sm font-medium text-primary">Regions</span>
							<div className="grid gap-2 sm:grid-cols-2">
								{BANNER_COUNTRY_GROUPS.map((group) => {
									const selected = state.targetGroups.includes(group.id)
									return (
										<label
											key={group.id}
											className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
												selected ? 'border-link/60 bg-research-tint' : 'border-medium hover:border-link/40'
											}`}
										>
											<input
												type="checkbox"
												checked={selected}
												onChange={(event) => {
													if (event.target.checked) {
														const groupCountries = new Set<string>(group.countries)
														update({
															targetGroups: [...state.targetGroups, group.id],
															targetCountries: state.targetCountries.filter((country) => !groupCountries.has(country))
														})
													} else {
														update({ targetGroups: state.targetGroups.filter((id) => id !== group.id) })
													}
												}}
												className="mt-0.5 size-4 accent-link"
											/>
											<div className="grid gap-0.5">
												<span className="text-sm font-medium text-primary">{group.label}</span>
												<span className="text-xs text-tertiary">{group.description}</span>
											</div>
										</label>
									)
								})}
							</div>
						</div>

						<div className="grid gap-1.5">
							<span className="text-sm font-medium text-primary">
								Countries <span className="font-normal text-tertiary">(optional when a region is selected)</span>
							</span>
							<MultiSelectCombobox
								heading="Countries"
								data={availableCountryOptions}
								placeholder="Search countries…"
								selectedValues={state.targetCountries}
								setSelectedValues={(targetCountries) => update({ targetCountries })}
								emptyMessage="No countries found"
							/>
							<p className="text-xs text-tertiary">Countries and regions are combined with OR matching.</p>
						</div>
						{errors.audience ? <p className="text-xs text-error">{errors.audience}</p> : null}
					</div>
				) : null}
			</Section>

			{state.kind === 'text' ? (
				<Section title="Content" description="The text readers see and an optional link.">
					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Banner text
							<CharCount value={state.text} max={TEXT_MAX} />
						</span>
						<textarea
							value={state.text}
							onChange={(e) => update({ text: e.target.value })}
							maxLength={TEXT_MAX}
							rows={3}
							placeholder="KATANA’S VKAT ARMORY REPRESENTS THE NEXT EVOLUTION OF VE-TOKENOMICS."
							className="w-full resize-y rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
						{errors.text ? <p className="text-xs text-error">{errors.text}</p> : null}
					</label>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Link URL <span className="font-normal text-tertiary">(optional)</span>
							<CharCount value={state.linkUrl} max={LINK_URL_MAX} />
						</span>
						<input
							type="text"
							value={state.linkUrl}
							onChange={(e) => update({ linkUrl: e.target.value })}
							maxLength={LINK_URL_MAX}
							placeholder="https://… or /research/…"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
						{errors.linkUrl ? <p className="text-xs text-error">{errors.linkUrl}</p> : null}
					</label>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Link label <span className="font-normal text-tertiary">(optional, default “Read more”)</span>
							<CharCount value={state.linkLabel} max={LINK_LABEL_MAX} />
						</span>
						<input
							type="text"
							value={state.linkLabel}
							onChange={(e) => update({ linkLabel: e.target.value })}
							maxLength={LINK_LABEL_MAX}
							placeholder="Read more"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
					</label>
				</Section>
			) : state.kind === 'promo' ? (
				<Section
					title="Content"
					description="Four renditions of the promo image, the click-through link with optional per-placement overrides for the landing and article pages, and an optional disclosure link. Placements without an uploaded image are hidden."
				>
					<div className="grid gap-1.5">
						<span className="text-sm font-medium text-primary">
							Landing image <span className="font-normal text-tertiary">(desktop, below Latest)</span>
						</span>
						<ImageUploadButton
							scope="banner-landing-desktop"
							previewShape="wide"
							currentUrl={state.imageWideUrl || null}
							onUploaded={(result) => update({ imageWideUrl: result.url })}
							onCleared={() => update({ imageWideUrl: '' })}
							label="landing promo image"
							helperText="Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 2745 × 380, transcoded to WebP."
						/>
					</div>

					<div className="grid gap-1.5">
						<span className="text-sm font-medium text-primary">
							Article card image <span className="font-normal text-tertiary">(desktop right rail)</span>
						</span>
						<ImageUploadButton
							scope="promo-card"
							previewShape="wide"
							currentUrl={state.imageCardUrl || null}
							onUploaded={(result) => update({ imageCardUrl: result.url })}
							onCleared={() => update({ imageCardUrl: '' })}
							label="article promo card"
							helperText="Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1600 × 900, transcoded to WebP."
						/>
					</div>

					<div className="grid gap-1.5">
						<span className="text-sm font-medium text-primary">
							Landing mobile image <span className="font-normal text-tertiary">(landing page on mobile)</span>
						</span>
						<ImageUploadButton
							scope="banner-landing-mobile"
							previewShape="wide"
							currentUrl={state.imageLandingMobileUrl || null}
							onUploaded={(result) => update({ imageLandingMobileUrl: result.url })}
							onCleared={() => update({ imageLandingMobileUrl: '' })}
							label="landing mobile promo image"
							helperText="Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1200 × 600, transcoded to WebP. Falls back to the article mobile image when empty; without either the banner is hidden on the mobile landing page."
						/>
					</div>

					<div className="grid gap-1.5">
						<span className="text-sm font-medium text-primary">
							Article mobile image <span className="font-normal text-tertiary">(article body on mobile)</span>
						</span>
						<ImageUploadButton
							scope="banner-landing-mobile"
							previewShape="wide"
							currentUrl={state.imageMobileUrl || null}
							onUploaded={(result) => update({ imageMobileUrl: result.url })}
							onCleared={() => update({ imageMobileUrl: '' })}
							label="article mobile promo image"
							helperText="Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1200 × 600, transcoded to WebP. Falls back to the article card image when empty."
						/>
					</div>
					{errors.imageUrl ? <p className="text-xs text-error">{errors.imageUrl}</p> : null}

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Alt text <span className="font-normal text-tertiary">(optional, recommended for accessibility)</span>
							<CharCount value={state.imageAlt} max={IMAGE_ALT_MAX} />
						</span>
						<input
							type="text"
							value={state.imageAlt}
							onChange={(e) => update({ imageAlt: e.target.value })}
							maxLength={IMAGE_ALT_MAX}
							placeholder="e.g. Revolut X — built for serious crypto traders"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
					</label>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Link URL <span className="font-normal text-tertiary">(default for every placement)</span>
							<CharCount value={state.linkUrl} max={LINK_URL_MAX} />
						</span>
						<input
							type="text"
							value={state.linkUrl}
							onChange={(e) => update({ linkUrl: e.target.value })}
							maxLength={LINK_URL_MAX}
							placeholder="https://…"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
						{errors.linkUrl ? <p className="text-xs text-error">{errors.linkUrl}</p> : null}
					</label>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Landing page URL{' '}
							<span className="font-normal text-tertiary">(optional, overrides Link URL on /research)</span>
							<CharCount value={state.landingLinkUrl} max={LINK_URL_MAX} />
						</span>
						<input
							type="text"
							value={state.landingLinkUrl}
							onChange={(e) => update({ landingLinkUrl: e.target.value })}
							maxLength={LINK_URL_MAX}
							placeholder="https://…"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
						{errors.landingLinkUrl ? <p className="text-xs text-error">{errors.landingLinkUrl}</p> : null}
					</label>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Article page URL{' '}
							<span className="font-normal text-tertiary">(optional, overrides Link URL on article pages)</span>
							<CharCount value={state.articleLinkUrl} max={LINK_URL_MAX} />
						</span>
						<input
							type="text"
							value={state.articleLinkUrl}
							onChange={(e) => update({ articleLinkUrl: e.target.value })}
							maxLength={LINK_URL_MAX}
							placeholder="https://…"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
						{errors.articleLinkUrl ? <p className="text-xs text-error">{errors.articleLinkUrl}</p> : null}
					</label>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Disclosure URL <span className="font-normal text-tertiary">(optional)</span>
							<CharCount value={state.disclosureUrl} max={LINK_URL_MAX} />
						</span>
						<input
							type="text"
							value={state.disclosureUrl}
							onChange={(e) => update({ disclosureUrl: e.target.value })}
							maxLength={LINK_URL_MAX}
							placeholder="https://…"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
						{errors.disclosureUrl ? <p className="text-xs text-error">{errors.disclosureUrl}</p> : null}
					</label>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Disclosure label <span className="font-normal text-tertiary">(optional, default “Disclosure”)</span>
							<CharCount value={state.disclosureText} max={DISCLOSURE_TEXT_MAX} />
						</span>
						<input
							type="text"
							value={state.disclosureText}
							onChange={(e) => update({ disclosureText: e.target.value })}
							maxLength={DISCLOSURE_TEXT_MAX}
							placeholder="Disclosure"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
					</label>
				</Section>
			) : (
				<Section title="Content" description="The image readers see and an optional click-through link.">
					<div className="grid gap-1.5">
						<span className="text-sm font-medium text-primary">Image</span>
						<ImageUploadButton
							scope={imageUpload.scope}
							previewShape="wide"
							currentUrl={state.imageUrl || null}
							onUploaded={(result) => update({ imageUrl: result.url })}
							onCleared={() => update({ imageUrl: '' })}
							label="banner image"
							helperText={imageUpload.helperText}
						/>
						{errors.imageUrl ? <p className="text-xs text-error">{errors.imageUrl}</p> : null}
					</div>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Alt text <span className="font-normal text-tertiary">(optional, recommended for accessibility)</span>
							<CharCount value={state.imageAlt} max={IMAGE_ALT_MAX} />
						</span>
						<input
							type="text"
							value={state.imageAlt}
							onChange={(e) => update({ imageAlt: e.target.value })}
							maxLength={IMAGE_ALT_MAX}
							placeholder="e.g. State of DeFi banner — get in touch"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
					</label>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">
							Link URL <span className="font-normal text-tertiary">(optional)</span>
							<CharCount value={state.linkUrl} max={LINK_URL_MAX} />
						</span>
						<input
							type="text"
							value={state.linkUrl}
							onChange={(e) => update({ linkUrl: e.target.value })}
							maxLength={LINK_URL_MAX}
							placeholder="https://… or /research/…"
							className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
						/>
						{errors.linkUrl ? <p className="text-xs text-error">{errors.linkUrl}</p> : null}
					</label>
				</Section>
			)}

			<Section title="Visibility" description="Disable a banner to hide it without deleting it.">
				<label className="flex items-center gap-3">
					<input
						type="checkbox"
						checked={state.enabled}
						onChange={(e) => update({ enabled: e.target.checked })}
						className="size-4 accent-link"
					/>
					<span className="text-sm text-primary">Enabled</span>
				</label>
			</Section>

			<div className="sticky bottom-0 -mx-1 mt-2 grid gap-2 border-t border-medium bg-page/90 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-page/70">
				{conflict ? <SavedChangedNotice noun="banner" onLoadSaved={loadSaved} /> : null}
				<div className="flex items-center justify-between gap-3">
					<span className="inline-flex items-center gap-2 text-xs text-tertiary">
						<span
							aria-hidden
							className={`size-1.5 rounded-full transition-colors ${dirty ? 'bg-warning' : 'bg-success'}`}
						/>
						{dirty ? 'Unsaved changes' : banner ? 'All changes saved' : 'New banner'}
					</span>
					<div className="flex items-center gap-2">
						{banner ? (
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								className="rounded-md px-3 py-2 text-sm text-error transition-colors hover:bg-error/10"
							>
								Delete
							</button>
						) : null}
						{/* Focusable while disabled: a save leaves nothing dirty, which disables the button that was pressed. */}
						<Button
							variant="primary"
							size="md"
							pendingLabel={saveMutation.isPending ? 'Saving…' : null}
							type="submit"
							disabled={hasError || (!dirty && !!banner)}
							accessibleWhenDisabled
						>
							{banner ? 'Save changes' : 'Create banner'}
						</Button>
					</div>
				</div>
			</div>
			{confirmDelete && banner ? (
				<ConfirmActionDialog
					title="Delete this banner?"
					description="This removes the banner from research pages. This cannot be undone."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deleteMutation}
					variables={banner.id}
					onClose={() => setConfirmDelete(false)}
					onSuccess={() => {
						void router.push('/research/admin/banners')
					}}
				/>
			) : null}
		</form>
	)
}

function BannerPreview({ banner }: { banner: Banner }) {
	return (
		<div className="grid gap-2 pt-2 pb-6">
			<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">Preview</span>
			{banner.type === 'text' ? (
				<div className="overflow-hidden rounded-md border border-medium">
					<TextPreviewInner banner={banner} />
				</div>
			) : banner.type === 'promo' ? (
				<PromoPreview banner={banner} />
			) : (
				<ImagePreview banner={banner} />
			)}
		</div>
	)
}

function PromoPreview({ banner }: { banner: Banner }) {
	const disclosure = banner.disclosureUrl ? (
		<span className="text-xs text-secondary underline">{banner.disclosureText || 'Disclosure'}</span>
	) : null
	const landingLink = landingPromoLinkUrl(banner)
	const articleLink = articlePromoLinkUrl(banner)
	const slots: Array<{
		label: string
		imageUrl: string | null
		linkUrl: string
		widthClass: string
		placeholder: string
	}> = [
		{
			label: 'Landing (desktop)',
			imageUrl: banner.showOnLanding ? banner.imageWideUrl : null,
			linkUrl: landingLink,
			widthClass: 'max-w-[640px]',
			placeholder: banner.showOnLanding
				? 'Upload a landing image to show the banner below Latest on /research'
				: 'Hidden on the landing page'
		},
		{
			label: 'Landing (mobile)',
			imageUrl: banner.showOnLanding ? (banner.imageLandingMobileUrl ?? banner.imageMobileUrl) : null,
			linkUrl: landingLink,
			widthClass: 'max-w-[360px]',
			placeholder: banner.showOnLanding
				? 'Upload a landing mobile image (or an article mobile image as fallback); hidden on mobile otherwise'
				: 'Hidden on the landing page'
		},
		{
			label: 'Article card (desktop right rail)',
			imageUrl: banner.imageCardUrl,
			linkUrl: articleLink,
			widthClass: 'max-w-[280px]',
			placeholder: 'Upload a card image to show the banner on article pages'
		},
		{
			label: 'Article (mobile, in body)',
			imageUrl: banner.imageMobileUrl ?? banner.imageCardUrl,
			linkUrl: articleLink,
			widthClass: 'max-w-[360px]',
			placeholder: 'Upload an article mobile image (or a card image as fallback)'
		}
	]
	return (
		<div className="grid gap-4">
			{slots.map((slot) => (
				<div key={slot.label} className={`grid gap-1 ${slot.widthClass}`}>
					<span className="text-[10px] tracking-[0.14em] text-tertiary uppercase">{slot.label}</span>
					{slot.imageUrl ? (
						<>
							<div className="overflow-hidden rounded-md border border-medium bg-surface">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={slot.imageUrl} alt={banner.imageAlt ?? ''} className="block h-auto w-full" />
							</div>
							{slot.linkUrl ? <span className="truncate body-xs text-tertiary">→ {slot.linkUrl}</span> : null}
							{disclosure}
						</>
					) : (
						<div className="flex h-24 items-center justify-center rounded-md border border-dashed border-medium bg-surface px-4 text-center text-xs text-tertiary">
							{slot.placeholder}
						</div>
					)}
				</div>
			))}
		</div>
	)
}

function ImagePreview({ banner }: { banner: Banner }) {
	const isHorizontal = banner.type === 'image-horizontal'
	const isSquare = banner.type === 'image-square'
	const widthClass = isHorizontal ? 'max-w-[640px]' : isSquare ? 'max-w-[320px]' : 'max-w-[280px]'
	const placeholderHeight = isHorizontal ? 'h-32' : isSquare ? 'h-72' : 'h-48'
	const placeholderCopy = isHorizontal
		? 'Upload an image to preview the mobile inline banner'
		: isSquare
			? 'Upload an image to preview the square banner inside Latest'
			: 'Upload an image to preview the right-rail banner'
	return (
		<div className={widthClass}>
			{banner.imageUrl ? (
				<div className="overflow-hidden rounded-md border border-medium bg-surface">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={banner.imageUrl} alt={banner.imageAlt ?? ''} className="block h-auto w-full" />
				</div>
			) : (
				<div
					className={`flex ${placeholderHeight} items-center justify-center rounded-md border border-dashed border-medium bg-surface px-4 text-center text-xs text-tertiary`}
				>
					{placeholderCopy}
				</div>
			)}
		</div>
	)
}

function TextPreviewInner({ banner }: { banner: Banner }) {
	return (
		<div className="flex w-full items-center gap-3 bg-research-banner px-4 py-2.5 text-on-brand">
			<div className="flex flex-1 items-center justify-center">
				<p className="m-0 text-center font-jetbrains text-[11px] font-bold tracking-[0.18em] uppercase">
					<span>{banner.text}</span>
					{banner.linkUrl ? (
						<>
							{' '}
							<span className="underline underline-offset-2">{banner.linkLabel?.trim() || 'Read more'}</span>
						</>
					) : null}
				</p>
			</div>
		</div>
	)
}

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
	return (
		<section className="grid gap-6 border-t border-medium py-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-x-12 md:py-10">
			<div>
				<h2 className="text-base font-semibold text-primary">{title}</h2>
				<p className="mt-1.5 text-sm leading-relaxed text-secondary">{description}</p>
			</div>
			<div className="grid min-w-0 gap-5">{children}</div>
		</section>
	)
}

function CharCount({ value, max }: { value: string; max: number }) {
	const remaining = max - value.length
	const tight = remaining < Math.max(20, Math.round(max * 0.1))
	return (
		<span
			className={`font-jetbrains text-[10px] tracking-[0.16em] uppercase ${tight ? 'text-warning' : 'text-tertiary'}`}
		>
			{value.length} / {max}
		</span>
	)
}
