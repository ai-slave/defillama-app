import { afterEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()

import { buildForgdUrl, forgdFetch } from '../client'

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('buildForgdUrl', () => {
	test('joins base + path and appends only defined query params', () => {
		const url = buildForgdUrl('/market-maker/leaderboard/volume', { start_date: '2026-05-30', end_date: undefined })
		expect(url).toBe('https://quant.forgd.com/api/v1/public/market-maker/leaderboard/volume?start_date=2026-05-30')
	})
})

describe('forgdFetch', () => {
	test('sends the bearer key from API_KEY_FORGD as an Authorization header', async () => {
		vi.stubEnv('API_KEY_FORGD', 'pk_test_123')
		http.serve({ '/api/v1/public/whoami': { ok: true } })
		const out = await forgdFetch('/whoami')
		expect(out).toEqual({ ok: true })
		expect(new Headers(http.requests[0].init?.headers).get('Authorization')).toBe('Bearer pk_test_123')
	})
})
