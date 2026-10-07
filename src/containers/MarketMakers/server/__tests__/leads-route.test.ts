import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ApiRequest } from '~/server/api/types'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { leadClaim, leadConnect } from '../leads'

const http = installFixtureFetch()

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const DISCORD = 'https://discord.com/api/webhooks/1/token'
const FORGD_CLAIM = 'https://quant.forgd.com/api/v1/public/affiliate/lead/claim'
const FORGD_CONNECT = 'https://quant.forgd.com/api/v1/public/affiliate/lead/connect'

const validClaim = {
	position: 'CEO',
	has_forgd_contact: false,
	forgd_contact_name: null,
	full_name: 'Test User',
	social_profile_url: 'https://www.linkedin.com/in/test',
	organization_email: 'test@org.com',
	telegram: null,
	alignment_consent: true,
	terms_consent: true,
	market_maker_id: 'flowdesk',
	market_maker_name: 'Flowdesk',
	turnstile_token: 'claim-token'
}

const validConnect = {
	interest: 'engage-market-maker',
	full_name: 'Test User',
	email: 'test@example.com',
	token_status: 'listed',
	project_name: 'Test Project',
	token_ticker: 'TST',
	coingecko_id: 'test-token',
	market_maker_id: 'flowdesk',
	market_maker_name: 'Flowdesk'
}

// Each test uses its own client IP because the route's rate-limit buckets live for the module's lifetime.
function claimRequest(body: Record<string, unknown>, ip: string): ApiRequest {
	return {
		method: 'POST',
		url: '/api/public/market-makers/lead/claim',
		query: {},
		headers: { 'cf-connecting-ip': ip },
		body
	}
}

function requestsTo(url: string) {
	return http.requests.filter((request) => request.url.href.startsWith(url))
}

function forgdBody(url: string) {
	return JSON.parse(requestsTo(url)[0].init!.body as string)
}

function discordResult() {
	const embed = JSON.parse(requestsTo(DISCORD)[0].init!.body as string).embeds[0]
	return {
		title: embed.title,
		result: embed.fields.find((field: { name: string }) => field.name === 'Result').value
	}
}

beforeEach(() => {
	vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', 'claim-secret')
	vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', DISCORD)
	vi.stubEnv('UTR_CLAIMS_SHARED_SECRET', '')
	http.serve({
		[DISCORD]: {},
		[FORGD_CLAIM]: { status: 'received', request_id: 'request-1' },
		[FORGD_CONNECT]: { status: 'received', request_id: 'request-2' }
	})
})

describe('leadClaim', () => {
	test('forwards a claim only after CAPTCHA succeeds, without the token, and reports it to Discord', async () => {
		http.serve({ [SITEVERIFY]: { success: true, action: 'claim' } })

		const result = await leadClaim.handle(claimRequest(validClaim, '192.0.2.10'))

		expect(result).toMatchObject({ status: 200, body: { status: 'received', request_id: 'request-1' } })
		expect((requestsTo(SITEVERIFY)[0].init!.body as FormData).get('remoteip')).toBe('192.0.2.10')
		expect(forgdBody(FORGD_CLAIM)).not.toHaveProperty('turnstile_token')
		expect(forgdBody(FORGD_CLAIM).organization_email).toBe('test@org.com')
		expect(discordResult()).toEqual({ title: 'Market Maker claim submission succeeded', result: 'Successful' })
	})

	test('skips CAPTCHA when the server secret is not configured', async () => {
		vi.stubEnv('CLAIMS_TURNSTILE_SECRET_KEY', '')
		const { turnstile_token: _token, ...claimWithoutCaptcha } = validClaim

		const result = await leadClaim.handle(claimRequest(claimWithoutCaptcha, '192.0.2.16'))

		expect(result.status).toBe(200)
		expect(requestsTo(SITEVERIFY)).toHaveLength(0)
		expect(discordResult().result).toBe('Successful')
	})

	test('rejects an invalid CAPTCHA before contacting Forgd, User Analytics or Discord', async () => {
		vi.stubEnv('UTR_CLAIMS_SHARED_SECRET', 'analytics-secret')
		http.serve({ [SITEVERIFY]: { success: false, 'error-codes': ['invalid-input-response'] } })

		const result = await leadClaim.handle(claimRequest({ ...validClaim, analytics_source: 'utr' }, '192.0.2.11'))

		expect(result).toMatchObject({ status: 400, body: { error: 'Complete the CAPTCHA verification and try again' } })
		expect(http.urls()).toEqual([SITEVERIFY])
	})

	test('fails closed when CAPTCHA verification is unavailable', async () => {
		http.serve({ [SITEVERIFY]: fixtureStatus(503) })

		const result = await leadClaim.handle(claimRequest(validClaim, '192.0.2.12'))

		expect(result).toMatchObject({ status: 502, body: { error: 'CAPTCHA verification is unavailable' } })
		expect(http.urls()).toEqual([SITEVERIFY])
	})

	test('reports a UTR claim that Forgd rejects to Discord as unsuccessful', async () => {
		http.serve({ [SITEVERIFY]: { success: true, action: 'claim' }, [FORGD_CLAIM]: fixtureStatus(404) })

		const result = await leadClaim.handle(
			claimRequest({ ...validClaim, analytics_source: 'utr', market_maker_id: null }, '192.0.2.15')
		)

		expect(result).toMatchObject({ status: 502, body: { error: 'Failed to submit request' } })
		expect(discordResult()).toEqual({ title: 'UTR claim submission failed', result: 'Unsuccessful' })
	})

	test('does not consume a CAPTCHA token when the claim itself is invalid', async () => {
		const result = await leadClaim.handle(claimRequest({ ...validClaim, organization_email: 'invalid' }, '192.0.2.13'))

		expect(result).toMatchObject({ status: 400, body: { error: 'Invalid organization email' } })
		expect(http.urls()).toEqual([])
	})

	test('rate limits repeated claims from one client', async () => {
		const invalid = claimRequest({ ...validClaim, organization_email: 'invalid' }, '192.0.2.17')
		const statuses: Array<number> = []
		for (let attempt = 0; attempt < 6; attempt++) statuses.push((await leadClaim.handle(invalid)).status)
		expect(statuses).toEqual([400, 400, 400, 400, 400, 429])
	})
})

describe('leadConnect', () => {
	test('forwards a connect lead without CAPTCHA or Discord', async () => {
		const result = await leadConnect.handle({
			...claimRequest(validConnect, '192.0.2.14'),
			url: '/api/public/market-makers/lead/connect'
		})

		expect(result).toMatchObject({ status: 200, body: { status: 'received', request_id: 'request-2' } })
		expect(http.urls()).toEqual([FORGD_CONNECT])
		expect(forgdBody(FORGD_CONNECT).interest).toBe('engage-market-maker')
	})
})
