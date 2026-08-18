import {
	collapseBannerCountrySelection,
	expandBannerCountrySelection,
	type BannerCountryGroupId
} from '~/containers/Articles/bannerCountryGroups'
import type { ArticleSection, Banner, BannerKind, BannerPayload, BannerScope } from '~/containers/Articles/types'

export const TEXT_MAX = 500
export const LINK_URL_MAX = 2000
export const LINK_LABEL_MAX = 64
export const IMAGE_ALT_MAX = 200
export const DISCLOSURE_TEXT_MAX = 64

type AudienceMode = 'global' | 'selected'

export type BannerFormState = {
	kind: BannerKind
	scope: BannerScope
	section: ArticleSection | ''
	articleId: string | null
	excludedArticleIds: string[]
	audienceMode: AudienceMode
	targetGroups: BannerCountryGroupId[]
	targetCountries: string[]
	text: string
	linkUrl: string
	linkLabel: string
	imageUrl: string
	imageAlt: string
	imageWideUrl: string
	imageCardUrl: string
	imageMobileUrl: string
	disclosureText: string
	disclosureUrl: string
	showOnLanding: boolean
	enabled: boolean
}

export function bannerToForm(banner: Banner | null): BannerFormState {
	if (!banner) {
		return {
			kind: 'text',
			scope: 'landing',
			section: '',
			articleId: null,
			excludedArticleIds: [],
			audienceMode: 'global',
			targetGroups: [],
			targetCountries: [],
			text: '',
			linkUrl: '',
			linkLabel: '',
			imageUrl: '',
			imageAlt: '',
			imageWideUrl: '',
			imageCardUrl: '',
			imageMobileUrl: '',
			disclosureText: '',
			disclosureUrl: '',
			showOnLanding: true,
			enabled: true
		}
	}
	const targeting = collapseBannerCountrySelection(banner.targetCountries ?? [])
	return {
		kind: banner.type,
		scope: banner.scope,
		section: banner.section ?? '',
		articleId: banner.articleId,
		excludedArticleIds: banner.excludedArticleIds ?? [],
		audienceMode: banner.targetCountries?.length ? 'selected' : 'global',
		targetGroups: targeting.groups,
		targetCountries: targeting.countries,
		text: banner.text ?? '',
		linkUrl: banner.linkUrl ?? '',
		linkLabel: banner.linkLabel ?? '',
		imageUrl: banner.imageUrl ?? '',
		imageAlt: banner.imageAlt ?? '',
		imageWideUrl: banner.imageWideUrl ?? '',
		imageCardUrl: banner.imageCardUrl ?? '',
		imageMobileUrl: banner.imageMobileUrl ?? '',
		disclosureText: banner.disclosureText ?? '',
		disclosureUrl: banner.disclosureUrl ?? '',
		showOnLanding: banner.showOnLanding !== false,
		enabled: banner.enabled
	}
}

export function buildPayload(state: BannerFormState): BannerPayload {
	const linkUrl = state.linkUrl.trim() || null
	const targetCountries =
		state.audienceMode === 'selected' ? expandBannerCountrySelection(state.targetGroups, state.targetCountries) : []
	if (state.kind === 'image-square') {
		return {
			type: 'image-square',
			scope: 'landing',
			section: null,
			articleId: null,
			excludedArticleIds: [],
			targetCountries,
			linkUrl,
			enabled: state.enabled,
			text: null,
			linkLabel: null,
			imageUrl: state.imageUrl.trim(),
			imageAlt: state.imageAlt.trim() || null,
			imageWideUrl: null,
			imageCardUrl: null,
			imageMobileUrl: null,
			disclosureText: null,
			disclosureUrl: null,
			showOnLanding: true
		}
	}
	if (state.kind === 'promo') {
		return {
			type: 'promo',
			scope: 'landing',
			section: null,
			articleId: null,
			excludedArticleIds: state.excludedArticleIds,
			targetCountries,
			linkUrl,
			enabled: state.enabled,
			text: null,
			linkLabel: null,
			imageUrl: null,
			imageAlt: state.imageAlt.trim() || null,
			imageWideUrl: state.imageWideUrl.trim() || null,
			imageCardUrl: state.imageCardUrl.trim() || null,
			imageMobileUrl: state.imageMobileUrl.trim() || null,
			disclosureText: state.disclosureText.trim() || null,
			disclosureUrl: state.disclosureUrl.trim() || null,
			showOnLanding: state.showOnLanding
		}
	}
	const base: BannerPayload = {
		type: state.kind,
		scope: state.scope,
		section: state.scope === 'section' ? (state.section as ArticleSection) : null,
		articleId: state.scope === 'article' ? state.articleId : null,
		excludedArticleIds: state.scope === 'all_articles' ? state.excludedArticleIds : [],
		targetCountries,
		linkUrl,
		enabled: state.enabled
	}
	if (state.kind === 'text') {
		return {
			...base,
			text: state.text.trim(),
			linkLabel: state.linkLabel.trim() || null,
			imageUrl: null,
			imageAlt: null
		}
	}
	return {
		...base,
		text: null,
		linkLabel: null,
		imageUrl: state.imageUrl.trim(),
		imageAlt: state.imageAlt.trim() || null
	}
}

export type BannerFormErrors = {
	text?: string
	section?: string
	articleId?: string
	linkUrl?: string
	imageUrl?: string
	disclosureUrl?: string
	audience?: string
}

export function validateBannerForm(state: BannerFormState): BannerFormErrors {
	const errors: BannerFormErrors = {}
	if (state.kind === 'text') {
		if (!state.text.trim()) errors.text = 'Banner text is required'
		else if (state.text.length > TEXT_MAX) errors.text = `Max ${TEXT_MAX} characters`
	} else if (state.kind === 'promo') {
		if (!state.imageWideUrl.trim() && !state.imageCardUrl.trim() && !state.imageMobileUrl.trim()) {
			errors.imageUrl = 'Upload at least one image'
		}
		if (!state.linkUrl.trim()) errors.linkUrl = 'Link URL is required'
		const disclosure = state.disclosureUrl.trim()
		if (disclosure && !/^(https?:\/\/|\/)/.test(disclosure)) {
			errors.disclosureUrl = 'Must start with http://, https://, or /'
		}
	} else if (!state.imageUrl.trim()) {
		errors.imageUrl = 'Image is required'
	}
	if (state.kind !== 'promo' && state.kind !== 'image-square') {
		if (state.scope === 'section' && !state.section) errors.section = 'Pick a section'
		if (state.scope === 'article' && !state.articleId) errors.articleId = 'Pick an article'
	}
	const link = state.linkUrl.trim()
	if (link && !/^(https?:\/\/|\/)/.test(link)) {
		errors.linkUrl = 'Must start with http://, https://, or /'
	}
	if (
		state.audienceMode === 'selected' &&
		expandBannerCountrySelection(state.targetGroups, state.targetCountries).length === 0
	) {
		errors.audience = 'Select at least one region or country'
	}
	return errors
}
