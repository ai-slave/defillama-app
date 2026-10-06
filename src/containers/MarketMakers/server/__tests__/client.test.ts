import { describe, expect, test } from 'vitest'
import { buildForgdUrl } from '../client'

describe('buildForgdUrl', () => {
	test('joins base + path and appends only defined query params', () => {
		const url = buildForgdUrl('/market-maker/leaderboard/volume', { start_date: '2026-05-30', end_date: undefined })
		expect(url).toBe('https://quant.forgd.com/api/v1/public/market-maker/leaderboard/volume?start_date=2026-05-30')
	})
})
