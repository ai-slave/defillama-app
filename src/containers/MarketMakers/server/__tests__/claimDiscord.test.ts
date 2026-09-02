import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendClaimToDiscord } from '../claimDiscord'

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

const claim = {
	market_maker_name: 'Test @everyone Project',
	full_name: 'Test User',
	position: 'CEO',
	organization_email: 'test@example.com',
	social_profile_url: 'https://www.linkedin.com/in/test',
	telegram: '@test',
	source_url: 'https://defillama.com/universal-token-rating/claim',
	has_forgd_contact: false,
	turnstile_token: 'must-not-leak',
	hp: 'must-not-leak'
}

describe('sendClaimToDiscord', () => {
	it('posts a sanitized successful submission and waits for Discord confirmation', async () => {
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token?thread_id=456')
		const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchMock)

		await sendClaimToDiscord(claim, 'utr', { ok: true, requestId: 'request-1' })

		const [url, options] = fetchMock.mock.calls[0]
		expect(String(url)).toContain('thread_id=456')
		expect(String(url)).toContain('wait=true')
		const body = JSON.parse(options.body)
		expect(body.allowed_mentions).toEqual({ parse: [] })
		expect(body.embeds[0]).toMatchObject({
			title: 'UTR claim submission succeeded',
			color: 0x22c55e
		})
		expect(body.embeds[0].fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Result', value: 'Successful' }),
				expect.objectContaining({ name: 'Request ID', value: 'request-1' })
			])
		)
		expect(options.body).not.toContain('must-not-leak')
	})

	it('posts unsuccessful Forgd submissions without throwing on Discord failure', async () => {
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }))
		vi.stubGlobal('fetch', fetchMock)

		await expect(
			sendClaimToDiscord(claim, 'market-maker', { ok: false, reason: 'forgd_failed' })
		).resolves.toBeUndefined()

		const body = JSON.parse(fetchMock.mock.calls[0][1].body)
		expect(body.embeds[0]).toMatchObject({
			title: 'Market Maker claim submission failed',
			color: 0xef4444
		})
		expect(body.embeds[0].fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Result', value: 'Unsuccessful' }),
				expect.objectContaining({ name: 'Failure', value: 'Forgd submission failed' })
			])
		)
	})

	it('renders the camelCase payload used by the full UTR form', async () => {
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
		const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchMock)

		await sendClaimToDiscord(
			{
				tokenName: 'Test Token',
				firstName: 'Test',
				lastName: 'User',
				position: 'CEO',
				email: 'test@example.com',
				socialProfileUrl: 'https://x.com/test',
				telegram: '@test'
			},
			'utr',
			{ ok: true, requestId: 'claim-1' }
		)

		const body = JSON.parse(fetchMock.mock.calls[0][1].body)
		expect(body.embeds[0].fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Project', value: 'Test Token' }),
				expect.objectContaining({ name: 'Name', value: 'Test User' }),
				expect.objectContaining({ name: 'Organization Email', value: 'test@example.com' }),
				expect.objectContaining({ name: 'Social Profile', value: 'https://x.com/test' })
			])
		)
	})

	it('does nothing when the webhook is missing or not an official Discord webhook URL', async () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)

		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', '')
		await sendClaimToDiscord(claim, 'utr', { ok: true })
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://example.com/api/webhooks/123/token')
		await sendClaimToDiscord(claim, 'utr', { ok: true })

		expect(fetchMock).not.toHaveBeenCalled()
	})
})
