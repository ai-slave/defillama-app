import { expect, test, vi } from 'vitest'
import { runPromptSubmission } from '../runPromptSubmission'

test('reports preparation failures and releases the current submission', async () => {
	const submissionLockRef = { current: 1 as number | null }
	const error = new Error('Preparation failed')
	const onFailure = vi.fn()
	await runPromptSubmission({
		submissionId: 1,
		submissionLockRef,
		execute: () => {
			throw error
		},
		onFailure
	})
	expect(onFailure).toHaveBeenCalledExactlyOnceWith(error)
	expect(submissionLockRef.current).toBeNull()
})

test('waits for successful execution before releasing the lock', async () => {
	const execution = Promise.withResolvers<void>()
	const submissionLockRef = { current: 1 as number | null }
	const onFailure = vi.fn()
	const running = runPromptSubmission({
		submissionId: 1,
		submissionLockRef,
		execute: () => execution.promise,
		onFailure
	})
	expect(submissionLockRef.current).toBe(1)
	execution.resolve()
	await running
	expect(submissionLockRef.current).toBeNull()
	expect(onFailure).not.toHaveBeenCalled()
})

test.each([
	{ outcome: 'resolve', nextOwner: 2 },
	{ outcome: 'reject', nextOwner: 2 },
	{ outcome: 'reject', nextOwner: null }
] as const)('a stale $outcome cannot affect submission owner $nextOwner', async ({ outcome, nextOwner }) => {
	const execution = Promise.withResolvers<void>()
	const submissionLockRef = { current: 1 as number | null }
	const onFailure = vi.fn()
	const running = runPromptSubmission({
		submissionId: 1,
		submissionLockRef,
		execute: () => execution.promise,
		onFailure
	})
	submissionLockRef.current = nextOwner
	if (outcome === 'reject') execution.reject(new Error('Old request failed'))
	else execution.resolve()
	await running
	expect(submissionLockRef.current).toBe(nextOwner)
	expect(onFailure).not.toHaveBeenCalled()
})
