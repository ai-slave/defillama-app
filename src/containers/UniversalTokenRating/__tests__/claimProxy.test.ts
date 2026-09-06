import { Readable } from 'node:stream'
import { afterEach, describe, expect, test, vi } from 'vitest'
import uploadHandler from '~/pages/api/public/utr/claim/documents'
import {
	getUtrClaimUpstreamConfig,
	mapUtrClaimUpstreamResponse,
	proxyUtrClaim,
	utrClaimSubmit
} from '../server/claimProxy'

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

describe('UTR claim upstream selection', () => {
	test('uses the existing production key and host', () => {
		vi.stubEnv('API_KEY_FORGD', 'prod-key')
		expect(getUtrClaimUpstreamConfig()).toEqual({
			baseUrl: 'https://quant.forgd.com/api/v1/public',
			apiKey: 'prod-key'
		})
	})
})

describe('proxyUtrClaim', () => {
	test('forwards the exact JSON payload and preserves a 201 response', async () => {
		vi.stubEnv('API_KEY_FORGD', 'prod-key')
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: 'claim-id' }), {
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			})
		)
		vi.stubGlobal('fetch', fetchMock)
		const payload = { tokenName: 'Test', documents: { alignment: [] }, clickId: 'click-1' }

		await expect(proxyUtrClaim(payload)).resolves.toEqual({ status: 201, body: { id: 'claim-id' } })
		expect(fetchMock).toHaveBeenCalledWith(
			'https://quant.forgd.com/api/v1/public/utr/claim',
			expect.objectContaining({
				method: 'POST',
				headers: {
					Authorization: 'Bearer prod-key',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			})
		)
	})

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

	test('keeps User Analytics best-effort and sends the exact claim copy', async () => {
		vi.stubEnv('API_KEY_FORGD', 'prod-key')
		vi.stubEnv('USER_ANALYTICS_URL', 'https://analytics.example.com')
		vi.stubEnv('UTR_CLAIMS_SHARED_SECRET', 'analytics-secret')
		const payload = { tokenName: 'Test', disclosures: {}, documents: {}, clickId: 'click-1' }
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url === 'https://analytics.example.com/api/ingestion/utr-claims') {
				return Promise.resolve(new Response(null, { status: 500 }))
			}
			return Promise.resolve(new Response(JSON.stringify({ id: 'claim-id' }), { status: 201 }))
		})
		vi.stubGlobal('fetch', fetchMock)

		await expect(
			utrClaimSubmit.handle({ method: 'POST', url: '', query: {}, headers: {}, body: payload })
		).resolves.toEqual({ status: 201, body: { id: 'claim-id' } })
		await vi.waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				'https://analytics.example.com/api/ingestion/utr-claims',
				expect.objectContaining({
					headers: expect.objectContaining({ 'X-Shared-Secret': 'analytics-secret' }),
					body: JSON.stringify(payload)
				})
			)
		})
	})

	test('waits for the Discord webhook after a successful full-form claim', async () => {
		vi.stubEnv('API_KEY_FORGD', 'prod-key')
		vi.stubEnv('USER_ANALYTICS_URL', '')
		vi.stubEnv('UTR_CLAIMS_SHARED_SECRET', '')
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
		const payload = {
			tokenName: 'Test Token',
			firstName: 'Test',
			lastName: 'User',
			position: 'CEO',
			email: 'test@example.com'
		}
		const fetchMock = vi.fn().mockImplementation((url: string | URL) => {
			if (String(url).startsWith('https://discord.com/api/webhooks/')) {
				return Promise.resolve(new Response('{}', { status: 200 }))
			}
			return Promise.resolve(new Response(JSON.stringify({ id: 'claim-id' }), { status: 201 }))
		})
		vi.stubGlobal('fetch', fetchMock)

		await expect(
			utrClaimSubmit.handle({ method: 'POST', url: '', query: {}, headers: {}, body: payload })
		).resolves.toEqual({ status: 201, body: { id: 'claim-id' } })

		const discordCall = fetchMock.mock.calls.find(([url]) =>
			String(url).startsWith('https://discord.com/api/webhooks/')
		)
		expect(discordCall).toBeDefined()
		const webhookBody = JSON.parse(discordCall?.[1]?.body as string)
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

	test('streams multipart with its original content headers and returns receipts', async () => {
		vi.stubEnv('API_KEY_FORGD', 'prod-key')
		const receipts = [
			{
				key: 'utr-claims/id/test.txt',
				fileName: 'test.txt',
				mimeType: 'text/plain',
				sizeBytes: 4,
				signature: 'signature'
			}
		]
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(receipts), { status: 201 }))
		vi.stubGlobal('fetch', fetchMock)
		const request = Object.assign(Readable.from(['body']), {
			method: 'POST',
			headers: {
				'content-type': 'multipart/form-data; boundary=test-boundary',
				'content-length': '4'
			}
		})
		const response = responseMock()

		await uploadHandler(request as never, response as never)

		expect(fetchMock).toHaveBeenCalledWith(
			'https://quant.forgd.com/api/v1/public/utr/claim/documents',
			expect.objectContaining({
				method: 'POST',
				body: request,
				duplex: 'half',
				headers: {
					Authorization: 'Bearer prod-key',
					'Content-Type': 'multipart/form-data; boundary=test-boundary',
					'Content-Length': '4'
				}
			})
		)
		expect(response.status).toHaveBeenCalledWith(201)
		expect(response.json).toHaveBeenCalledWith(receipts)
	})

	test('rejects a request without Content-Length before calling Forgd', async () => {
		vi.stubGlobal('fetch', vi.fn())
		const request = Object.assign(Readable.from(['body']), {
			method: 'POST',
			headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' }
		})
		const response = responseMock()

		await uploadHandler(request as never, response as never)

		expect(fetch).not.toHaveBeenCalled()
		expect(response.status).toHaveBeenCalledWith(411)
		expect(response.json).toHaveBeenCalledWith({ error: 'Content-Length is required' })
	})
})
