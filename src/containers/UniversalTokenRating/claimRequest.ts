import { normalizeSocialUrl } from '~/containers/MarketMakers/leadShared'

export type UtrClaimRequestInput = {
	projectName: string
	position: string
	hasForgdContact: boolean
	forgdContactName: string
	firstName: string
	lastName: string
	profileUrl: string
	email: string
	telegram: string
	alignmentConsent: boolean
	termsConsent: boolean
	sourceUrl: string | null
	turnstileToken: string
}

export function buildUtrClaimRequest(input: UtrClaimRequestInput): Record<string, unknown> {
	return {
		analytics_source: 'utr',
		position: input.position.trim(),
		has_forgd_contact: input.hasForgdContact,
		forgd_contact_name: input.hasForgdContact ? input.forgdContactName.trim() || null : null,
		full_name: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
		social_profile_url: normalizeSocialUrl(input.profileUrl.trim()),
		organization_email: input.email.trim(),
		telegram: input.telegram.trim() || null,
		alignment_consent: input.alignmentConsent,
		terms_consent: input.termsConsent,
		market_maker_id: null,
		market_maker_name: input.projectName.trim() || null,
		click_id: null,
		source_url: input.sourceUrl,
		turnstile_token: input.turnstileToken
	}
}
