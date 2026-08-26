import { describe, expect, it } from 'vitest'
import { validateClaimBody } from '~/containers/MarketMakers/server/leads'
import { buildUtrClaimRequest } from '../claimRequest'

describe('buildUtrClaimRequest', () => {
	it('matches the Forgd affiliate claim contract', () => {
		const payload = buildUtrClaimRequest({
			projectName: 'Uniswap',
			position: ' Core Contributor ',
			hasForgdContact: false,
			forgdContactName: 'Ignored',
			firstName: ' Alice ',
			lastName: ' Example ',
			profileUrl: 'x.com/alice',
			email: ' alice@uniswap.org ',
			telegram: ' @alice ',
			alignmentConsent: true,
			termsConsent: true,
			sourceUrl: 'https://defillama.com/universal-token-rating/claim',
			honeypot: ''
		})

		expect(validateClaimBody(payload).ok).toBe(true)
		expect(payload).toMatchObject({
			position: 'Core Contributor',
			full_name: 'Alice Example',
			social_profile_url: 'https://x.com/alice',
			organization_email: 'alice@uniswap.org',
			market_maker_id: null,
			market_maker_name: 'Uniswap',
			forgd_contact_name: null
		})
	})
})
