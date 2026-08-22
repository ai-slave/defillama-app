import { describe, expect, it } from 'vitest'
import { shouldQueuePrompt } from '~/containers/LlamaAI/utils/composerSubmit'

describe('shouldQueuePrompt', () => {
	it.each(['pending', 'editing', 'firing'] as const)(
		'keeps the composer on the queue endpoint for a %s row while idle',
		(state) => {
			expect(shouldQueuePrompt(false, [{ state }])).toBe(true)
		}
	)

	it('uses direct send when the queue only contains unsent rows', () => {
		expect(shouldQueuePrompt(false, [{ state: 'not_sent' }])).toBe(false)
	})

	it('uses the queue endpoint while an execution is streaming', () => {
		expect(shouldQueuePrompt(true, [])).toBe(true)
	})
})
