import { describe, expect, test, vi } from 'vitest'
import { CommandExitError, getErrorExitCode, timedStep } from '../timedStep'

describe('timedStep', () => {
	test('returns a successful timed result', async () => {
		const now = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(3500)

		const result = await timedStep('Example', async () => 'done', { now })

		expect(result).toEqual({ durationMs: 2500, name: 'Example', status: 'success', value: 'done' })
	})

	test('captures command exit failures without running callers past the result', async () => {
		const result = await timedStep(
			'Example',
			async () => {
				throw new CommandExitError(7, 'failed')
			},
			{ now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1) }
		)

		expect(result.status).toBe('failure')
		expect(result.status === 'failure' && getErrorExitCode(result.error)).toBe(7)
	})
})
