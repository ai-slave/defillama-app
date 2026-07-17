import { EXCHANGE_REFERRAL_URLS } from './referralUrls'

export interface VenueDestination {
	url: string
	kind: 'referral' | 'website'
}

export function selectVenueDestination(
	slug: string,
	referralUrl: string | null,
	websiteUrl: string | null,
	overrides: Readonly<Partial<Record<string, string>>> = EXCHANGE_REFERRAL_URLS
): VenueDestination | null {
	const frontendReferral = overrides[slug]
	if (frontendReferral) return { url: frontendReferral, kind: 'referral' }
	if (referralUrl) return { url: referralUrl, kind: 'referral' }
	return websiteUrl ? { url: websiteUrl, kind: 'website' } : null
}
