import type { Banner } from '~/containers/Articles/types'

export function landingPromoLinkUrl(banner: Banner): string {
	return banner.landingLinkUrl?.trim() || banner.linkUrl?.trim() || ''
}

export function articlePromoLinkUrl(banner: Banner): string {
	return banner.articleLinkUrl?.trim() || banner.linkUrl?.trim() || ''
}

export function isExternalUrl(url: string) {
	return /^https?:\/\//i.test(url)
}
