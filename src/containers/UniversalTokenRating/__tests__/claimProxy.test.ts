import { Readable } from 'node:stream'
import { afterEach, describe, expect, test, vi } from 'vitest'
import uploadHandler from '~/pages/api/public/utr/claim/documents'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { mapUtrClaimUpstreamResponse, utrClaimSubmit } from '../server/claimProxy'

const http = installFixtureFetch()
const FORGD_CLAIM = 'https://quant.forgd.com/api/v1/public/utr/claim'
const ANALYTICS = 'https://analytics.example.com/api/ingestion/utr-claims'

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('proxyUtrClaim', () => {
	test('keeps validation errors but hides auth and upstream failures', async () => {
		await expect(
			mapUtrClaimUpstreamResponse(new Response(JSON.stringify({ message: 'tokenName is required' }), { status: 400 }))
		).resolves.toEqual({ status: 400, body: { error: 'tokenName is required' } })
		await expect(
			mapUtrClaimUpstreamResponse(
				new Response(JSON.stringify({ error: { message: 'missing scope' } }), { status: 403 })
			)
		).resolves.toEqual({ status: 502, body: { error: 'Failed to submit the claim request' } })
		await expect(mapUtrClaimUpstreamResponse(new Response(null, { status: 503 }))).resolves.toEqual({
			status: 503,
			body: { error: 'Claim service is temporarily unavailable — please try again' }
		})
	})

	test('returns the Forgd claim result when User Analytics fails', async () => {
		vi.stubEnv('API_KEY_FORGD', 'prod-key')
		vi.stubEnv('USER_ANALYTICS_URL', 'https://analytics.example.com')
		vi.stubEnv('UTR_CLAIMS_SHARED_SECRET', 'analytics-secret')
		http.serve({ [ANALYTICS]: fixtureStatus(500), [FORGD_CLAIM]: fixtureStatus(201, { id: 'claim-id' }) })
		const payload = { tokenName: 'Test', disclosures: {}, documents: {}, clickId: 'click-1' }

		await expect(
			utrClaimSubmit.handle({ method: 'POST', url: '', query: {}, headers: {}, body: payload })
		).resolves.toEqual({ status: 201, body: { id: 'claim-id' } })
		// The claim resolves before the analytics call fails; wait until that failing call has run.
		await waitForUi(() => expect(http.requests).toHaveLength(2))
	})

	test('waits for the Discord webhook after a successful full-form claim', async () => {
		vi.stubEnv('API_KEY_FORGD', 'prod-key')
		vi.stubEnv('USER_ANALYTICS_URL', '')
		vi.stubEnv('UTR_CLAIMS_SHARED_SECRET', '')
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
		let releaseDiscord: () => void = () => undefined
		http.serve({
			[FORGD_CLAIM]: fixtureStatus(201, { id: 'claim-id' }),
			'https://discord.com/api/webhooks/': () =>
				new Promise<Response>((resolve) => {
					releaseDiscord = () => resolve(Response.json({}))
				})
		})
		const payload = {
			tokenName: 'Test Token',
			firstName: 'Test',
			lastName: 'User',
			position: 'CEO',
			email: 'test@example.com'
		}

		let settled = false
		const response = utrClaimSubmit
			.handle({ method: 'POST', url: '', query: {}, headers: {}, body: payload })
			.finally(() => {
				settled = true
			})
		await waitForUi(() => expect(http.requests).toHaveLength(2))
		await new Promise((resolve) => setTimeout(resolve, 10))
		expect(settled).toBe(false)

		releaseDiscord()
		await expect(response).resolves.toEqual({ status: 201, body: { id: 'claim-id' } })
		const webhookBody = JSON.parse(http.requests[1].init?.body as string)
		expect(webhookBody.embeds[0].fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Project', value: 'Test Token' }),
				expect.objectContaining({ name: 'Request ID', value: 'claim-id' })
			])
		)
	})
})

describe('UTR document proxy', () => {
	function responseMock() {
		const response = {
			setHeader: vi.fn(),
			status: vi.fn(),
			json: vi.fn()
		}
		response.status.mockReturnValue(response)
		return response
	}

	test('rejects a request without Content-Length before calling Forgd', async () => {
		const request = Object.assign(Readable.from(['body']), {
			method: 'POST',
			headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' }
		})
		const response = responseMock()

		await uploadHandler(request as never, response as never)

		expect(http.urls()).toEqual([])
		expect(response.status).toHaveBeenCalledWith(411)
		expect(response.json).toHaveBeenCalledWith({ error: 'Content-Length is required' })
	})
})
