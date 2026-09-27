import { act } from 'react'
import { vi } from 'vitest'

/**
 * `vi.waitFor` for rendered components. Updates that land between polls, such as query responses and Ariakit's
 * deferred state, happen outside `act`, so React logs a warning for each one. Polling runs with the act
 * environment off, as Testing Library's `waitFor` does, and one `act` afterwards flushes what the last poll left.
 */
export async function waitForUi<T>(
	callback: () => T | Promise<T>,
	options?: Parameters<typeof vi.waitFor>[1]
): Promise<T> {
	globalThis.IS_REACT_ACT_ENVIRONMENT = false
	try {
		return await vi.waitFor(callback, options)
	} finally {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		// React Query and Ariakit apply some updates on the next task, so the flush waits one task inside act.
		// Under fake timers the test drives time itself, and a timer here would never fire.
		await act(() => (vi.isFakeTimers() ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, 0))))
	}
}
