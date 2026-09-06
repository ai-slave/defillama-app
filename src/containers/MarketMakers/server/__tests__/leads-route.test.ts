import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ApiRequest } from '~/server/api/types'
import { sendClaimToDiscord } from '../claimDiscord'
import { isClaimTurnstileEnabled, verifyClaimTurnstile } from '../claimTurnstile'
import { forgdPost } from '../client'
import { leadClaim, leadConnect } from '../leads'

vi.mock('../claimTurnstile', () => ({ isClaimTurnstileEnabled: vi.fn(), verifyClaimTurnstile: vi.fn() }))
vi.mock('../claimDiscord', () => ({ sendClaimToDiscord: vi.fn() }))
vi.mock('../client', () => ({ forgdPost: vi.fn() }))

const isClaimTurnstileEnabledMock = vi.mocked(isClaimTurnstileEnabled)
const verifyClaimTurnstileMock = vi.mocked(verifyClaimTurnstile)
const sendClaimToDiscordMock = vi.mocked(sendClaimToDiscord)
const forgdPostMock = vi.mocked(forgdPost)

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

function claimRequest(body: Record<string, unknown>, ip: string): ApiRequest {
	return {
		method: 'POST',
		url: '/api/public/market-makers/lead/claim',
		query: {},
		headers: { 'cf-connecting-ip': ip },
		body
	}
}

beforeEach(() => {
	isClaimTurnstileEnabledMock.mockReturnValue(true)
})

afterEach(() => {
	vi.clearAllMocks()
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

describe('leadClaim', () => {
	test('skips CAPTCHA when the server secret is not configured and still sends the webhook', async () => {
		isClaimTurnstileEnabledMock.mockReturnValue(false)
		forgdPostMock.mockResolvedValue({ status: 'received', request_id: 'request-disabled' })
		const claimWithoutCaptcha: Record<string, unknown> = { ...validClaim }
		delete claimWithoutCaptcha.turnstile_token

		const result = await leadClaim.handle(claimRequest(claimWithoutCaptcha, '192.0.2.16'))

		expect(result.status).toBe(200)
		expect(verifyClaimTurnstileMock).not.toHaveBeenCalled()
		expect(sendClaimToDiscordMock).toHaveBeenCalledWith(expect.any(Object), 'market-maker', {
			ok: true,
			requestId: 'request-disabled'
		})
	})

	test('forwards a validated claim only after CAPTCHA succeeds and strips the token', async () => {
		verifyClaimTurnstileMock.mockResolvedValue({ ok: true })
		forgdPostMock.mockResolvedValue({ status: 'received', request_id: 'request-1' })

		const result = await leadClaim.handle(claimRequest(validClaim, '192.0.2.10'))

		expect(result.status).toBe(200)
		expect(verifyClaimTurnstileMock).toHaveBeenCalledWith('claim-token', '192.0.2.10')
		expect(forgdPostMock).toHaveBeenCalledWith(
			'/affiliate/lead/claim',
			expect.not.objectContaining({ turnstile_token: expect.anything() })
		)
		expect(sendClaimToDiscordMock).toHaveBeenCalledWith(
			expect.not.objectContaining({ turnstile_token: expect.anything() }),
			'market-maker',
			{ ok: true, requestId: 'request-1' }
		)
	})

	test('does not contact Forgd or User Analytics when CAPTCHA is invalid', async () => {
		vi.stubEnv('USER_ANALYTICS_URL', 'https://analytics.example.com')
		vi.stubEnv('UTR_CLAIMS_SHARED_SECRET', 'analytics-secret')
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		verifyClaimTurnstileMock.mockResolvedValue({ ok: false, reason: 'invalid' })

		const result = await leadClaim.handle(claimRequest({ ...validClaim, analytics_source: 'utr' }, '192.0.2.11'))

		expect(result).toMatchObject({
			status: 400,
			body: { error: 'Complete the CAPTCHA verification and try again' }
		})
		expect(forgdPostMock).not.toHaveBeenCalled()
		expect(fetchMock).not.toHaveBeenCalled()
		expect(sendClaimToDiscordMock).not.toHaveBeenCalled()
	})

	test('fails closed when CAPTCHA verification is unavailable', async () => {
		verifyClaimTurnstileMock.mockResolvedValue({ ok: false, reason: 'unavailable' })

		const result = await leadClaim.handle(claimRequest(validClaim, '192.0.2.12'))

		expect(result).toMatchObject({ status: 502, body: { error: 'CAPTCHA verification is unavailable' } })
		expect(forgdPostMock).not.toHaveBeenCalled()
		expect(sendClaimToDiscordMock).not.toHaveBeenCalled()
	})

	test('notifies Discord when a CAPTCHA-validated UTR submission fails in Forgd', async () => {
		vi.stubEnv('USER_ANALYTICS_URL', '')
		vi.stubEnv('UTR_CLAIMS_SHARED_SECRET', '')
		verifyClaimTurnstileMock.mockResolvedValue({ ok: true })
		forgdPostMock.mockRejectedValue(new Error('Forgd unavailable'))

		const result = await leadClaim.handle(
			claimRequest({ ...validClaim, analytics_source: 'utr', market_maker_id: null }, '192.0.2.15')
		)

		expect(result).toMatchObject({ status: 502, body: { error: 'Failed to submit request' } })
		expect(sendClaimToDiscordMock).toHaveBeenCalledWith(
			expect.objectContaining({ market_maker_name: 'Flowdesk' }),
			'utr',
			{ ok: false, reason: 'forgd_failed' }
		)
	})

	test('does not consume a CAPTCHA token when local claim validation fails', async () => {
		const result = await leadClaim.handle(claimRequest({ ...validClaim, organization_email: 'invalid' }, '192.0.2.13'))

		expect(result.status).toBe(400)
		expect(verifyClaimTurnstileMock).not.toHaveBeenCalled()
		expect(forgdPostMock).not.toHaveBeenCalled()
		expect(sendClaimToDiscordMock).not.toHaveBeenCalled()
	})
})

describe('leadConnect', () => {
	test('keeps the connect flow independent from claim CAPTCHA', async () => {
		forgdPostMock.mockResolvedValue({ status: 'received', request_id: 'request-2' })

		const result = await leadConnect.handle({
			...claimRequest(validConnect, '192.0.2.14'),
			url: '/api/public/market-makers/lead/connect'
		})

		expect(result.status).toBe(200)
		expect(verifyClaimTurnstileMock).not.toHaveBeenCalled()
		expect(forgdPostMock).toHaveBeenCalledWith('/affiliate/lead/connect', expect.any(Object))
	})
})
