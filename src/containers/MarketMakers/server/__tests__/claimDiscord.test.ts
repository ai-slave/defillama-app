import { afterEach, describe, expect, test, vi } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { sendClaimToDiscord } from '../claimDiscord'

const http = installFixtureFetch()

afterEach(() => {
	vi.unstubAllEnvs()
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

function postedMessage(index = 0) {
	return JSON.parse(http.requests[index].init?.body as string)
}

describe('sendClaimToDiscord', () => {
	test('posts a successful submission to the configured thread without secrets or mention pings', async () => {
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token?thread_id=456')
		http.serve({ 'https://discord.com/api/webhooks/123/token': {} })

		await sendClaimToDiscord(claim, 'utr', { ok: true, requestId: 'request-1' })

		expect(http.requests[0].url.searchParams.get('thread_id')).toBe('456')
		const message = postedMessage()
		// Claimant text can contain @everyone; Discord must never turn it into a ping.
		expect(message.allowed_mentions.parse).toEqual([])
		expect(message.embeds[0].fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Result', value: 'Successful' }),
				expect.objectContaining({ name: 'Request ID', value: 'request-1' })
			])
		)
		expect(http.requests[0].init?.body).not.toContain('must-not-leak')
	})

	test('posts unsuccessful Forgd submissions without throwing on Discord failure', async () => {
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
		http.serve({ 'https://discord.com/api/webhooks/123/token': fixtureStatus(429) })

		await expect(
			sendClaimToDiscord(claim, 'market-maker', { ok: false, reason: 'forgd_failed' })
		).resolves.toBeUndefined()

		expect(postedMessage().embeds[0].fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Result', value: 'Unsuccessful' }),
				expect.objectContaining({ name: 'Failure', value: 'Forgd submission failed' })
			])
		)
	})

	test('renders the camelCase payload used by the full UTR form', async () => {
		vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
		http.serve({ 'https://discord.com/api/webhooks/123/token': {} })

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

		expect(postedMessage().embeds[0].fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Project', value: 'Test Token' }),
				expect.objectContaining({ name: 'Name', value: 'Test User' }),
				expect.objectContaining({ name: 'Organization Email', value: 'test@example.com' }),
				expect.objectContaining({ name: 'Social Profile', value: 'https://x.com/test' })
			])
		)
	})

	test('posts only to official Discord webhook hosts', async () => {
		http.serve({
			'https://discordapp.com/api/webhooks/': {},
			'https://canary.discord.com/api/webhooks/': {}
		})

		for (const webhook of [
			'',
			'https://example.com/api/webhooks/123/token',
			'https://discordapp.com/api/webhooks/123/token',
			'https://canary.discord.com/api/webhooks/123/token'
		]) {
			vi.stubEnv('UTR_DISCORD_WEBHOOK_URL', webhook)
			await sendClaimToDiscord(claim, 'utr', { ok: true })
		}

		expect(http.requests.map((request) => request.url.host)).toEqual(['discordapp.com', 'canary.discord.com'])
	})
})
