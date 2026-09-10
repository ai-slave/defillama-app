import type { RefObject } from 'react'

export async function runPromptSubmission({
	submissionId,
	submissionLockRef,
	execute,
	onFailure
}: {
	submissionId: number
	submissionLockRef: RefObject<number | null>
	execute: () => Promise<void>
	onFailure: (error: unknown) => void
}): Promise<void> {
	try {
		await execute()
	} catch (error) {
		if (submissionLockRef.current === submissionId) onFailure(error)
	} finally {
		// A cancelled submission may settle after the next one has acquired the lock.
		if (submissionLockRef.current === submissionId) submissionLockRef.current = null
	}
}
