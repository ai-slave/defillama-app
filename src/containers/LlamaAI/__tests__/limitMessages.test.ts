import { describe, expect, test } from 'vitest'
import { buildFreeLimitMessage, usageLimitOffer } from '~/containers/LlamaAI/limitMessages'
import type { FreeLimitError } from '~/containers/LlamaAI/runAgenticRequest'

const NOW = Date.parse('2026-10-01T21:00:00.000Z')
const freeLimit = (code: FreeLimitError['code'], message: string, resetTime?: string): FreeLimitError =>
	Object.assign(new Error(message), { code, details: resetTime ? { resetTime } : undefined })

describe('buildFreeLimitMessage', () => {
	test('the server wording leads without its upsell paragraph, and keeps its own countdown', () => {
		const err = freeLimit(
			'FREE_FORM_LIMIT',
			"You've used today's free question. More in 3h 0m. Subscribe for unlimited access.\n\n[Subscribe — 7 days free](https://defillama.com/subscription)",
			'2026-10-02T00:00:00.000Z'
		)
		expect(buildFreeLimitMessage(err, NOW)).toEqual({
			role: 'assistant',
			content: "You've used today's free question. More in 3h 0m. Subscribe for unlimited access.",
			freeLimitOffer: { code: 'FREE_FORM_LIMIT', resetTime: '2026-10-02T00:00:00.000Z' }
		})
	})

	test('the daily limit gets the countdown its server wording leaves out', () => {
		const err = freeLimit(
			'FREE_DAILY_LIMIT',
			"You've reached your daily message limit on the free tier. Subscribe for unlimited access.\n\n[Subscribe — 7 days free](https://defillama.com/subscription)",
			'2026-10-02T00:00:00.000Z'
		)
		expect(buildFreeLimitMessage(err, NOW).content).toBe(
			"You've reached your daily message limit on the free tier. Subscribe for unlimited access. Resets in 3h 0m."
		)
	})

	test('without server wording the chat writes its own line and countdown', () => {
		expect(
			buildFreeLimitMessage(freeLimit('FREE_QUESTION_LIMIT', 'Upgrade required', '2026-10-03T23:30:00.000Z'), NOW)
				.content
		).toBe("You've reached your free question limit. Resets in 2d 2h.")
		expect(buildFreeLimitMessage(freeLimit('FREE_QUESTION_LIMIT', 'Upgrade required'), NOW).content).toBe(
			"You've reached your free question limit."
		)
	})
})

test('a usage limit maps the server details to the copy, reading an unknown period as a plan-wide limit', () => {
	expect(usageLimitOffer({ feature: 'fact_checked', period: 'daily', limit: 3, resetTime: null })).toEqual({
		feature: 'fact_checked',
		period: 'daily',
		limit: 3,
		resetTime: null
	})
	expect(usageLimitOffer({ period: 'monthly' })).toEqual({
		feature: 'research',
		period: 'lifetime',
		limit: 0,
		resetTime: null
	})
})
