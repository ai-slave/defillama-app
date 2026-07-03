import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchJson = vi.fn()
vi.mock('~/utils/async', () => ({ fetchJson: (...args: unknown[]) => fetchJson(...args) }))

import { buildForgdUrl, forgdFetch } from '../client'

afterEach(() => {
	vi.unstubAllEnvs()
	fetchJson.mockReset()
})

describe('buildForgdUrl', () => {
	it('joins base + path and appends only defined query params', () => {
		const url = buildForgdUrl('/market-maker/leaderboard/volume', { start_date: '2026-05-30', end_date: undefined })
		expect(url).toBe(
			'https://dev.quant.api.forgd.com/api/v1/public/market-maker/leaderboard/volume?start_date=2026-05-30'
		)
	})
})

describe('forgdFetch', () => {
	it('sends the bearer key from API_KEY_FORGD as an Authorization header', async () => {
		vi.stubEnv('API_KEY_FORGD', 'pk_test_123')
		fetchJson.mockResolvedValue({ ok: true })
		const out = await forgdFetch('/whoami')
		expect(out).toEqual({ ok: true })
		expect(fetchJson).toHaveBeenCalledWith(
			'https://dev.quant.api.forgd.com/api/v1/public/whoami',
			expect.objectContaining({ headers: { Authorization: 'Bearer pk_test_123' } })
		)
	})

	it('throws when API_KEY_FORGD is missing', async () => {
		vi.stubEnv('API_KEY_FORGD', '')
		await expect(forgdFetch('/whoami')).rejects.toThrow('API_KEY_FORGD')
	})
})
