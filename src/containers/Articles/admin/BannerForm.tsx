import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
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
import { createBanner, deleteBanner, updateBanner } from '~/containers/Articles/api'
import {
	BANNER_COUNTRY_GROUPS,
	BANNER_COUNTRY_OPTIONS,
	expandBannerCountrySelection
} from '~/containers/Articles/bannerCountryGroups'
import { articlePromoLinkUrl, landingPromoLinkUrl } from '~/containers/Articles/promoLinks'
import type { ArticleSection, Banner, BannerKind, BannerScope } from '~/containers/Articles/types'
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
import { Field, FieldGroup } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input, Textarea } from '~/ui/Input'
import { MultiSelectCombobox } from '~/ui/MultiSelectCombobox'
import { OptionTile } from '~/ui/OptionTile'
import { Select } from '~/ui/Select'
import { StatusDot } from '~/ui/StatusBadge'
import { httpErrorMessage } from '~/utils/async'

const SECTION_OPTIONS = ARTICLE_SECTIONS.map((section) => ({ key: section, name: ARTICLE_SECTION_LABELS[section] }))

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

	const [submitted, setSubmitted] = useState(false)
	const errors = validateBannerForm(state)
	const hasError = Object.values(errors).some(Boolean)
	const shown = submitted ? errors : {}

	// Refresh shared data after navigation; draft updates and redirects belong to this form's lifetime.
	const saveMutation = useMutation({
		mutationFn: async (values: BannerFormState) => {
			const payload = buildPayload(values)
			if (banner) return updateBanner(banner.id, payload, authorizedFetch)
			return createBanner(payload, authorizedFetch)
		},
		onSuccess: () => {
			revalidateLanding()
			toast.success(banner ? 'Banner saved' : 'Banner created')
		},
		onError: (error) => {
			toast.error(httpErrorMessage(error, "Couldn't save."))
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

	const countriesCoveredByGroups = new Set<string>()
	const selectedGroupIds = new Set(state.targetGroups)
	for (const group of BANNER_COUNTRY_GROUPS) {
		if (!selectedGroupIds.has(group.id)) continue
		for (const country of group.countries) countriesCoveredByGroups.add(country)
	}
	const availableCountryOptions = BANNER_COUNTRY_OPTIONS.filter((option) => !countriesCoveredByGroups.has(option.value))

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (hasError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		saveMutation.mutate(state, {
			onSuccess: (saved) => {
				acceptSaved(bannerToForm(saved), state)
				setSubmitted(false)
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
		<form noValidate onSubmit={handleSubmit} className="mx-auto grid w-full max-w-4xl gap-0 px-1 pb-28">
			<BannerPreview banner={previewBanner} />

			<Section
				title="Kind"
				description="Text shows as a dismissible strip at the top of the page. Desktop images are used by landing placements or the article right rail. Wide/mobile images are used by landing placements or the mobile article body. Promo is a shared placement below Latest on the landing page and on every article. Square landing banner shows inside Latest on the landing page in place of articles 4-6."
			>
				<Ariakit.RadioProvider value={state.kind} setValue={(kind) => update({ kind: kind as BannerKind })}>
					<Ariakit.RadioGroup aria-label="Kind" className="grid gap-2 sm:grid-cols-2">
						{BANNER_KINDS.map((kind) => (
							<OptionTile key={kind} layout="stack" radio={kind}>
								<span className="label-md">{BANNER_KIND_LABELS[kind]}</span>
								<span className="body-sm text-tertiary">{BANNER_KIND_DESCRIPTIONS[kind]}</span>
							</OptionTile>
						))}
					</Ariakit.RadioGroup>
				</Ariakit.RadioProvider>
			</Section>

			{state.kind === 'image-square' ? (
				<Section title="Placement" description="Where this banner appears.">
					<p className="body-md text-secondary">
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
						<span className="label-md text-primary">Show on the landing page</span>
					</label>

					<FieldGroup label={<Optional label="Hide on these articles" />}>
						<ArticleMultiPicker
							value={state.excludedArticleIds}
							onChange={(ids) => update({ excludedArticleIds: ids })}
							hint="The promo shows on every article except the ones listed here."
						/>
					</FieldGroup>
				</Section>
			) : (
				<Section title="Scope" description="Where should this banner appear?">
					<Ariakit.RadioProvider value={state.scope} setValue={(scope) => update({ scope: scope as BannerScope })}>
						<Ariakit.RadioGroup aria-label="Scope" className="grid gap-2">
							{BANNER_SCOPES.map((scope) => (
								<OptionTile key={scope} layout="stack" radio={scope}>
									<span className="label-md">{BANNER_SCOPE_LABELS[scope]}</span>
									<span className="body-sm text-tertiary">
										{scope === 'landing'
											? 'Shows on /research'
											: scope === 'section'
												? 'Shows on every article in the chosen section'
												: scope === 'all_articles'
													? 'Shows on every article'
													: 'Shows only on the chosen article'}
									</span>
								</OptionTile>
							))}
						</Ariakit.RadioGroup>
					</Ariakit.RadioProvider>

					{state.scope === 'section' ? (
						<Field label="Section" error={shown.section}>
							{(control) => (
								<Select
									label={state.section ? ARTICLE_SECTION_LABELS[state.section] : 'Select a section…'}
									labelType="none"
									heading="Section"
									allValues={SECTION_OPTIONS}
									selectedValues={state.section}
									setSelectedValues={(section) => update({ section: section as ArticleSection })}
									variant="input"
									size="md"
									triggerProps={control}
									popoverWidth="trigger"
								/>
							)}
						</Field>
					) : null}

					{state.scope === 'article' ? (
						<FieldGroup label="Article" error={shown.articleId}>
							<ArticlePicker
								value={state.articleId}
								onChange={(article) => update({ articleId: article?.id ?? null })}
							/>
						</FieldGroup>
					) : null}

					{state.scope === 'all_articles' ? (
						<FieldGroup label={<Optional label="Hide on these articles" />}>
							<ArticleMultiPicker
								value={state.excludedArticleIds}
								onChange={(ids) => update({ excludedArticleIds: ids })}
								hint="The banner shows on every article except the ones listed here."
							/>
						</FieldGroup>
					) : null}
				</Section>
			)}

			<Section
				title="Audience"
				description="Show this banner globally or only to visitors in selected regions and countries."
			>
				<Ariakit.RadioProvider
					value={state.audienceMode}
					setValue={(mode) => update({ audienceMode: mode as BannerFormState['audienceMode'] })}
				>
					<Ariakit.RadioGroup aria-label="Audience" className="grid gap-2 sm:grid-cols-2">
						<OptionTile layout="stack" radio="global">
							<span className="label-md">Global</span>
							<span className="body-sm text-tertiary">Show to every visitor</span>
						</OptionTile>
						<OptionTile layout="stack" radio="selected">
							<span className="label-md">Selected locations</span>
							<span className="body-sm text-tertiary">Show only when the visitor country matches</span>
						</OptionTile>
					</Ariakit.RadioGroup>
				</Ariakit.RadioProvider>

				{state.audienceMode === 'selected' ? (
					<div className="grid gap-5">
						<FieldGroup label="Regions">
							<div className="grid gap-2 sm:grid-cols-2">
								{BANNER_COUNTRY_GROUPS.map((group) => {
									const selected = state.targetGroups.includes(group.id)
									return (
										<OptionTile
											key={group.id}
											layout="row"
											check="box"
											selected={selected}
											role="checkbox"
											aria-checked={selected}
											onClick={() => {
												if (selected) {
													update({ targetGroups: state.targetGroups.filter((id) => id !== group.id) })
													return
												}
												const groupCountries = new Set<string>(group.countries)
												update({
													targetGroups: [...state.targetGroups, group.id],
													targetCountries: state.targetCountries.filter((country) => !groupCountries.has(country))
												})
											}}
										>
											<span className="grid gap-0.5">
												<span className="label-md">{group.label}</span>
												<span className="body-sm text-tertiary">{group.description}</span>
											</span>
										</OptionTile>
									)
								})}
							</div>
						</FieldGroup>

						{/* The error is about regions and countries together, so it sits under the second of the pair. */}
						<FieldGroup
							label={<Optional label="Countries" note="optional when a region is selected" />}
							hint="Countries and regions are combined with OR matching."
							error={shown.audience}
						>
							<MultiSelectCombobox
								heading="Countries"
								data={availableCountryOptions}
								placeholder="Search countries…"
								selectedValues={state.targetCountries}
								setSelectedValues={(targetCountries) => update({ targetCountries })}
								emptyMessage="No countries found"
							/>
						</FieldGroup>
					</div>
				) : null}
			</Section>

			{state.kind === 'text' ? (
				<Section title="Content" description="The text readers see and an optional link.">
					<Field label="Banner text" action={<CharCount value={state.text} max={TEXT_MAX} />} error={shown.text}>
						{(control) => (
							<Textarea
								{...control}
								value={state.text}
								onChange={(e) => update({ text: e.target.value })}
								maxLength={TEXT_MAX}
								rows={3}
								placeholder="KATANA’S VKAT ARMORY REPRESENTS THE NEXT EVOLUTION OF VE-TOKENOMICS."
								className="w-full resize-y"
							/>
						)}
					</Field>

					<Field
						label={<Optional label="Link URL" />}
						action={<CharCount value={state.linkUrl} max={LINK_URL_MAX} />}
						error={shown.linkUrl}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.linkUrl}
								onChange={(e) => update({ linkUrl: e.target.value })}
								maxLength={LINK_URL_MAX}
								placeholder="https://… or /research/…"
								className="w-full"
							/>
						)}
					</Field>

					<Field
						label={<Optional label="Link label" note="optional, default “Read more”" />}
						action={<CharCount value={state.linkLabel} max={LINK_LABEL_MAX} />}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.linkLabel}
								onChange={(e) => update({ linkLabel: e.target.value })}
								maxLength={LINK_LABEL_MAX}
								placeholder="Read more"
								className="w-full"
							/>
						)}
					</Field>
				</Section>
			) : state.kind === 'promo' ? (
				<Section
					title="Content"
					description="Four renditions of the promo image, the click-through link with optional per-placement overrides for the landing and article pages, and an optional disclosure link. Placements without an uploaded image are hidden."
				>
					<FieldGroup label="Images" error={shown.imageUrl}>
						<div className="grid gap-5">
							<FieldGroup label={<Optional label="Landing image" note="desktop, below Latest" />}>
								<ImageUploadButton
									scope="banner-landing-desktop"
									previewShape="wide"
									currentUrl={state.imageWideUrl || null}
									onUploaded={(result) => update({ imageWideUrl: result.url })}
									onCleared={() => update({ imageWideUrl: '' })}
									label="landing promo image"
									helperText="Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 2745 × 380, transcoded to WebP."
								/>
							</FieldGroup>

							<FieldGroup label={<Optional label="Article card image" note="desktop right rail" />}>
								<ImageUploadButton
									scope="promo-card"
									previewShape="wide"
									currentUrl={state.imageCardUrl || null}
									onUploaded={(result) => update({ imageCardUrl: result.url })}
									onCleared={() => update({ imageCardUrl: '' })}
									label="article promo card"
									helperText="Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1600 × 900, transcoded to WebP."
								/>
							</FieldGroup>

							<FieldGroup label={<Optional label="Landing mobile image" note="landing page on mobile" />}>
								<ImageUploadButton
									scope="banner-landing-mobile"
									previewShape="wide"
									currentUrl={state.imageLandingMobileUrl || null}
									onUploaded={(result) => update({ imageLandingMobileUrl: result.url })}
									onCleared={() => update({ imageLandingMobileUrl: '' })}
									label="landing mobile promo image"
									helperText="Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1200 × 600, transcoded to WebP. Falls back to the article mobile image when empty; without either the banner is hidden on the mobile landing page."
								/>
							</FieldGroup>

							<FieldGroup label={<Optional label="Article mobile image" note="article body on mobile" />}>
								<ImageUploadButton
									scope="banner-landing-mobile"
									previewShape="wide"
									currentUrl={state.imageMobileUrl || null}
									onUploaded={(result) => update({ imageMobileUrl: result.url })}
									onCleared={() => update({ imageMobileUrl: '' })}
									label="article mobile promo image"
									helperText="Up to 8 MB. PNG, JPEG, WebP, or GIF. Resized to fit 1200 × 600, transcoded to WebP. Falls back to the article card image when empty."
								/>
							</FieldGroup>
						</div>
					</FieldGroup>

					<Field
						label={<Optional label="Alt text" note="optional, recommended for accessibility" />}
						action={<CharCount value={state.imageAlt} max={IMAGE_ALT_MAX} />}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.imageAlt}
								onChange={(e) => update({ imageAlt: e.target.value })}
								maxLength={IMAGE_ALT_MAX}
								placeholder="e.g. Revolut X — built for serious crypto traders"
								className="w-full"
							/>
						)}
					</Field>

					<Field
						label={<Optional label="Link URL" note="default for every placement" />}
						action={<CharCount value={state.linkUrl} max={LINK_URL_MAX} />}
						error={shown.linkUrl}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.linkUrl}
								onChange={(e) => update({ linkUrl: e.target.value })}
								maxLength={LINK_URL_MAX}
								placeholder="https://…"
								className="w-full"
							/>
						)}
					</Field>

					<Field
						label={<Optional label="Landing page URL" note="optional, overrides Link URL on /research" />}
						action={<CharCount value={state.landingLinkUrl} max={LINK_URL_MAX} />}
						error={shown.landingLinkUrl}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.landingLinkUrl}
								onChange={(e) => update({ landingLinkUrl: e.target.value })}
								maxLength={LINK_URL_MAX}
								placeholder="https://…"
								className="w-full"
							/>
						)}
					</Field>

					<Field
						label={<Optional label="Article page URL" note="optional, overrides Link URL on article pages" />}
						action={<CharCount value={state.articleLinkUrl} max={LINK_URL_MAX} />}
						error={shown.articleLinkUrl}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.articleLinkUrl}
								onChange={(e) => update({ articleLinkUrl: e.target.value })}
								maxLength={LINK_URL_MAX}
								placeholder="https://…"
								className="w-full"
							/>
						)}
					</Field>

					<Field
						label={<Optional label="Disclosure URL" />}
						action={<CharCount value={state.disclosureUrl} max={LINK_URL_MAX} />}
						error={shown.disclosureUrl}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.disclosureUrl}
								onChange={(e) => update({ disclosureUrl: e.target.value })}
								maxLength={LINK_URL_MAX}
								placeholder="https://…"
								className="w-full"
							/>
						)}
					</Field>

					<Field
						label={<Optional label="Disclosure label" note="optional, default “Disclosure”" />}
						action={<CharCount value={state.disclosureText} max={DISCLOSURE_TEXT_MAX} />}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.disclosureText}
								onChange={(e) => update({ disclosureText: e.target.value })}
								maxLength={DISCLOSURE_TEXT_MAX}
								placeholder="Disclosure"
								className="w-full"
							/>
						)}
					</Field>
				</Section>
			) : (
				<Section title="Content" description="The image readers see and an optional click-through link.">
					<FieldGroup label="Image" error={shown.imageUrl}>
						<ImageUploadButton
							scope={imageUpload.scope}
							previewShape="wide"
							currentUrl={state.imageUrl || null}
							onUploaded={(result) => update({ imageUrl: result.url })}
							onCleared={() => update({ imageUrl: '' })}
							label="banner image"
							helperText={imageUpload.helperText}
						/>
					</FieldGroup>

					<Field
						label={<Optional label="Alt text" note="optional, recommended for accessibility" />}
						action={<CharCount value={state.imageAlt} max={IMAGE_ALT_MAX} />}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.imageAlt}
								onChange={(e) => update({ imageAlt: e.target.value })}
								maxLength={IMAGE_ALT_MAX}
								placeholder="e.g. State of DeFi banner — get in touch"
								className="w-full"
							/>
						)}
					</Field>

					<Field
						label={<Optional label="Link URL" />}
						action={<CharCount value={state.linkUrl} max={LINK_URL_MAX} />}
						error={shown.linkUrl}
					>
						{(control) => (
							<Input
								{...control}
								type="text"
								value={state.linkUrl}
								onChange={(e) => update({ linkUrl: e.target.value })}
								maxLength={LINK_URL_MAX}
								placeholder="https://… or /research/…"
								className="w-full"
							/>
						)}
					</Field>
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
					<span className="label-md text-primary">Enabled</span>
				</label>
			</Section>

			<div className="sticky bottom-0 -mx-1 mt-2 grid gap-2 border-t border-medium bg-page-glass px-2 py-3 backdrop-blur">
				{conflict ? <SavedChangedNotice noun="banner" onLoadSaved={loadSaved} /> : null}
				<div className="flex items-center justify-between gap-3">
					<span className="inline-flex items-center gap-2 body-sm text-tertiary">
						<StatusDot status={dirty ? 'caution' : 'good'} />
						{dirty ? 'Unsaved changes' : banner ? 'All changes saved' : 'New banner'}
					</span>
					<div className="flex items-center gap-2">
						{banner ? (
							<Button variant="destructive" size="md" onClick={() => setConfirmDelete(true)}>
								Delete
							</Button>
						) : null}
						{/* Disabled only with nothing to save, which the status beside it says. Focusable while disabled: a save
						    leaves nothing dirty, which disables the button that was pressed. */}
						<Button
							variant="primary"
							size="md"
							pendingLabel="Saving…"
							pending={saveMutation.isPending}
							type="submit"
							disabled={!dirty && !!banner}
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
					errorMessage="Couldn't delete the banner."
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
			<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Preview</span>
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
		<span className="body-sm text-secondary underline">{banner.disclosureText || 'Disclosure'}</span>
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
					<span className="body-xs tracking-[0.14em] text-tertiary uppercase">{slot.label}</span>
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
						<div className="flex h-24 items-center justify-center rounded-md border border-dashed border-medium bg-surface px-4 text-center body-sm text-tertiary">
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
					className={`flex ${placeholderHeight} items-center justify-center rounded-md border border-dashed border-medium bg-surface px-4 text-center body-sm text-tertiary`}
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
				<p className="m-0 text-center label-xs tracking-[0.18em] uppercase">
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
				<h2 className="title-lg text-primary">{title}</h2>
				<p className="mt-1.5 body-md text-secondary">{description}</p>
			</div>
			<div className="grid min-w-0 gap-5">{children}</div>
		</section>
	)
}

function Optional({ label, note = 'optional' }: { label: string; note?: string }) {
	return (
		<>
			{label} <span className="font-normal text-tertiary">({note})</span>
		</>
	)
}

function CharCount({ value, max }: { value: string; max: number }) {
	const remaining = max - value.length
	const tight = remaining < Math.max(20, Math.round(max * 0.1))
	return (
		<span className={`label-xs tracking-[0.16em] uppercase ${tight ? 'text-warning' : 'text-tertiary'}`}>
			{value.length} / {max}
		</span>
	)
}
