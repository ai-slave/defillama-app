import { describe, expect, it } from 'vitest'
import type { ApiRequest } from '~/server/api/types'
import { clientIp, validateClaimBody, validateConnectBody } from '../leads'

const validConnect = {
	interest: 'engage-market-maker',
	full_name: 'Test User',
	email: 'test@example.com',
	token_status: 'listed',
	project_name: 'Test Project',
	token_ticker: 'TST',
	coingecko_id: 'test-token',
	market_maker_id: 'flowdesk',
	market_maker_name: 'Flowdesk',
	click_id: 'abc-123',
	source_url: 'https://defillama.com/market-makers'
}

describe('validateConnectBody', () => {
	it('accepts a complete valid payload and keeps whitelisted fields', () => {
		const result = validateConnectBody(validConnect)
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.payload.interest).toBe('engage-market-maker')
			expect(result.payload.full_name).toBe('Test User')
			expect(result.payload.coingecko_id).toBe('test-token')
		}
	})

	it('forwards the leaderboard slug as market_maker_id', () => {
		const result = validateConnectBody(validConnect)
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.payload.market_maker_id).toBe('flowdesk')
			expect(result.payload.market_maker_name).toBe('Flowdesk')
		}
	})

	it('rejects an unknown interest', () => {
		expect(validateConnectBody({ ...validConnect, interest: 'spam' }).ok).toBe(false)
	})

	it('rejects a missing full name and a bad email', () => {
		expect(validateConnectBody({ ...validConnect, full_name: '  ' }).ok).toBe(false)
		expect(validateConnectBody({ ...validConnect, email: 'not-an-email' }).ok).toBe(false)
	})

	it('rejects a filled honeypot field regardless of length', () => {
		expect(validateConnectBody({ ...validConnect, hp: 'bot' }).ok).toBe(false)
		expect(validateConnectBody({ ...validConnect, hp: 'x'.repeat(5000) }).ok).toBe(false)
	})

	it('rejects an invalid market maker id', () => {
		expect(validateConnectBody({ ...validConnect, market_maker_id: 'bad id!' }).ok).toBe(false)
	})

	it('drops coingecko_id unless token_status is listed', () => {
		const result = validateConnectBody({ ...validConnect, token_status: 'pre-tge' })
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.payload.coingecko_id).toBeNull()
	})

	it('rejects an unknown token status', () => {
		expect(validateConnectBody({ ...validConnect, token_status: 'moon' }).ok).toBe(false)
	})

	it('rejects a non-object body', () => {
		expect(validateConnectBody(null).ok).toBe(false)
		expect(validateConnectBody('str').ok).toBe(false)
	})
})

const validClaim = {
	position: 'CEO',
	has_forgd_contact: true,
	forgd_contact_name: 'Dana Test',
	full_name: 'Test User',
	social_profile_url: 'https://www.linkedin.com/in/test',
	organization_email: 'test@org.com',
	telegram: '@test',
	alignment_consent: true,
	terms_consent: true,
	market_maker_id: 'flowdesk',
	market_maker_name: 'Flowdesk'
}

describe('validateClaimBody', () => {
	it('accepts a complete valid payload', () => {
		const result = validateClaimBody(validClaim)
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.payload.position).toBe('CEO')
			expect(result.payload.forgd_contact_name).toBe('Dana Test')
		}
	})

	it('rejects when either consent is missing', () => {
		expect(validateClaimBody({ ...validClaim, alignment_consent: false }).ok).toBe(false)
		expect(validateClaimBody({ ...validClaim, terms_consent: 'yes' }).ok).toBe(false)
	})

	it('accepts x.com and twitter.com profiles, rejects other urls', () => {
		expect(validateClaimBody({ ...validClaim, social_profile_url: 'https://x.com/test' }).ok).toBe(true)
		expect(validateClaimBody({ ...validClaim, social_profile_url: 'https://twitter.com/test' }).ok).toBe(true)
		expect(validateClaimBody({ ...validClaim, social_profile_url: 'https://evil.com/test' }).ok).toBe(false)
	})

	it('accepts profile urls without a protocol and normalizes them to https', () => {
		const result = validateClaimBody({ ...validClaim, social_profile_url: 'www.linkedin.com/in/test' })
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.payload.social_profile_url).toBe('https://www.linkedin.com/in/test')

		const bare = validateClaimBody({ ...validClaim, social_profile_url: 'x.com/test' })
		expect(bare.ok).toBe(true)
		if (bare.ok) expect(bare.payload.social_profile_url).toBe('https://x.com/test')
	})

	it('rejects a non-boolean has_forgd_contact', () => {
		expect(validateClaimBody({ ...validClaim, has_forgd_contact: 'yes' }).ok).toBe(false)
	})

	it('drops forgd_contact_name when has_forgd_contact is false', () => {
		const result = validateClaimBody({ ...validClaim, has_forgd_contact: false })
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.payload.forgd_contact_name).toBeNull()
	})

	it('rejects a filled honeypot field', () => {
		expect(validateClaimBody({ ...validClaim, hp: 'bot' }).ok).toBe(false)
	})
})

function requestWithHeaders(headers: Record<string, string | string[] | undefined>): ApiRequest {
	return { method: 'POST', url: '/api/public/market-makers/lead/connect', query: {}, headers }
}

describe('clientIp', () => {
	it('prefers edge-set headers over x-forwarded-for', () => {
		expect(clientIp(requestWithHeaders({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': 'spoofed, 5.6.7.8' }))).toBe(
			'1.2.3.4'
		)
		expect(clientIp(requestWithHeaders({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': 'spoofed' }))).toBe('9.9.9.9')
	})

	it('falls back to the rightmost x-forwarded-for entry, not the spoofable leftmost', () => {
		expect(clientIp(requestWithHeaders({ 'x-forwarded-for': 'spoofed, 10.0.0.1, 5.6.7.8' }))).toBe('5.6.7.8')
	})

	it('returns unknown when no ip headers are present', () => {
		expect(clientIp(requestWithHeaders({}))).toBe('unknown')
	})
})
