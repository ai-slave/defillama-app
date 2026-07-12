import { describe, expect, it, vi } from 'vitest'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
import {
	createManualAlert,
	fetchAlertExecutions,
	fetchAlerts,
	updateAlert
} from '~/containers/LlamaAI/components/alerts/api'

function jsonResponse(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers
		}
	})
}

describe('alerts API wrappers', () => {
	it('returns typed envelope fields directly', async () => {
		const alerts = [{ id: 'alert-1', title: 'Alert' }]
		const fetcher: AuthorizedFetch = async () => jsonResponse({ alerts })

		await expect(fetchAlerts(fetcher)).resolves.toEqual(alerts)
	})

	it('treats missing or malformed 2xx envelopes as empty lists', async () => {
		const fetcher: AuthorizedFetch = async () => jsonResponse({})

		await expect(fetchAlerts(fetcher)).resolves.toEqual([])
		await expect(fetchAlertExecutions(fetcher, 'alert-1')).resolves.toEqual([])
	})

	it('still throws on non-2xx responses', async () => {
		const fetcher: AuthorizedFetch = async () => jsonResponse({ error: 'nope' }, { status: 500 })

		await expect(fetchAlerts(fetcher)).rejects.toThrow('Failed to fetch alerts')
		await expect(fetchAlertExecutions(fetcher, 'alert-1')).rejects.toThrow('Failed to fetch executions')
	})
})

describe('createManualAlert', () => {
	it('posts the body to /alerts and returns the created id', async () => {
		const fetcher = vi.fn(async () => jsonResponse({ id: 'alert-123' })) as unknown as AuthorizedFetch
		const body = {
			title: 'AAVE price alert',
			trigger: {
				type: 'price' as const,
				token_nk: 'ethereum:0xabc',
				op: 'above' as const,
				value: 100,
				recurring: false
			},
			delivery_channel: 'email' as const
		}

		await expect(createManualAlert(fetcher, body)).resolves.toEqual({ id: 'alert-123' })
		expect(fetcher).toHaveBeenCalledWith(
			expect.stringContaining('/alerts'),
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			})
		)
	})

	it('throws when not authenticated', async () => {
		const fetcher: AuthorizedFetch = async () => null

		await expect(
			createManualAlert(fetcher, {
				title: 'AAVE price alert',
				trigger: { type: 'schedule' },
				delivery_channel: 'email'
			})
		).rejects.toThrow('Not authenticated')
	})

	it('throws the server error message on non-2xx responses', async () => {
		const fetcher: AuthorizedFetch = async () => jsonResponse({ error: 'bad trigger' }, { status: 400 })

		await expect(
			createManualAlert(fetcher, {
				title: 'AAVE price alert',
				trigger: { type: 'schedule' },
				delivery_channel: 'email'
			})
		).rejects.toThrow('bad trigger')
	})

	it('falls back to a generic error message when the response body is not JSON', async () => {
		const fetcher: AuthorizedFetch = async () => new Response('not json', { status: 500 })

		await expect(
			createManualAlert(fetcher, {
				title: 'AAVE price alert',
				trigger: { type: 'schedule' },
				delivery_channel: 'email'
			})
		).rejects.toThrow('Failed to create alert')
	})
})

describe('updateAlert', () => {
	it('updates price settings and delivery atomically in one request', async () => {
		const fetcher = vi.fn(async () => jsonResponse({ ok: true })) as unknown as AuthorizedFetch
		const input = {
			alertId: 'alert-1',
			title: 'ETH below $3,000',
			delivery_channel: 'slack' as const,
			condition: '',
			trigger: {
				type: 'price' as const,
				token_nk: 'coingecko:ethereum',
				op: 'below' as const,
				value: 3000,
				recurring: false
			},
			slack_team_id: 'team-1',
			slack_channel_id: 'channel-1',
			slack_channel_name: 'alerts'
		}

		await updateAlert(fetcher, input, { shouldInclude: false, value: null })

		expect(fetcher).toHaveBeenCalledTimes(1)
		expect(fetcher).toHaveBeenCalledWith(
			expect.stringContaining('/alerts/alert-1'),
			expect.objectContaining({
				method: 'PATCH',
				body: JSON.stringify({
					title: input.title,
					trigger: input.trigger,
					delivery_channel: input.delivery_channel,
					slack_team_id: input.slack_team_id,
					slack_channel_id: input.slack_channel_id,
					slack_channel_name: input.slack_channel_name
				})
			})
		)
	})

	it('keeps schedule updates trigger-free', async () => {
		const fetcherMock = vi.fn(async (_url: string, _options?: RequestInit) => jsonResponse({ ok: true }))
		const fetcher: AuthorizedFetch = fetcherMock

		await updateAlert(
			fetcher,
			{
				alertId: 'alert-2',
				title: 'Daily report',
				alertConfig: { frequency: 'daily', hour: 9, dayOfWeek: 1, timezone: 'UTC' },
				delivery_channel: 'email',
				condition: ''
			},
			{ shouldInclude: false, value: null }
		)

		const init = fetcherMock.mock.calls[0][1] as RequestInit
		expect(JSON.parse(init.body as string)).not.toHaveProperty('trigger')
	})

	it('fails the combined price edit as one request', async () => {
		const fetcher = vi.fn(async () =>
			jsonResponse({ error: 'invalid delivery' }, { status: 400 })
		) as unknown as AuthorizedFetch

		await expect(
			updateAlert(
				fetcher,
				{
					alertId: 'alert-3',
					title: 'ETH above $4,000',
					delivery_channel: 'email',
					condition: '',
					trigger: {
						type: 'price',
						token_nk: 'coingecko:ethereum',
						op: 'above',
						value: 4000,
						recurring: false
					}
				},
				{ shouldInclude: false, value: null }
			)
		).rejects.toThrow('invalid delivery')
		expect(fetcher).toHaveBeenCalledTimes(1)
	})
})
