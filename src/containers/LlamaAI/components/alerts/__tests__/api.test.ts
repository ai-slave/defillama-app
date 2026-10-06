import { describe, expect, test } from 'vitest'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
import { createManualAlert, fetchAlertExecutions, fetchAlerts } from '~/containers/LlamaAI/components/alerts/api'

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
	test('treats missing or malformed 2xx envelopes as empty lists', async () => {
		const fetcher: AuthorizedFetch = async () => jsonResponse({})

		await expect(fetchAlerts(fetcher)).resolves.toEqual([])
		await expect(fetchAlertExecutions(fetcher, 'alert-1')).resolves.toEqual([])
	})

	test('still throws on non-2xx responses', async () => {
		const fetcher: AuthorizedFetch = async () => jsonResponse({ error: 'nope' }, { status: 500 })

		await expect(fetchAlerts(fetcher)).rejects.toThrow('Failed to fetch alerts')
		await expect(fetchAlertExecutions(fetcher, 'alert-1')).rejects.toThrow('Failed to fetch executions')
	})
})

describe('createManualAlert', () => {
	test('throws when not authenticated', async () => {
		const fetcher: AuthorizedFetch = async () => null

		await expect(
			createManualAlert(fetcher, {
				title: 'AAVE price alert',
				trigger: { type: 'schedule' },
				delivery_channel: 'email'
			})
		).rejects.toThrow('Not authenticated')
	})

	test('throws the server error message on non-2xx responses', async () => {
		const fetcher: AuthorizedFetch = async () => jsonResponse({ error: 'bad trigger' }, { status: 400 })

		await expect(
			createManualAlert(fetcher, {
				title: 'AAVE price alert',
				trigger: { type: 'schedule' },
				delivery_channel: 'email'
			})
		).rejects.toThrow('bad trigger')
	})

	test('falls back to a generic error message when the response body is not JSON', async () => {
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
