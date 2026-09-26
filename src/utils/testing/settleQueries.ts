import type { QueryClient } from '@tanstack/react-query'
import { act } from 'react'

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Waits until the client has no query in flight and React has rendered the results. Fixture responses
 * answer at once, so this ends as soon as React Query has applied them. It waits on the queries rather than
 * a wall-clock deadline, which a starved worker can pass before the fixture has had any CPU. A request
 * without a fixture throws, so this still fails fast as long as the client does not retry.
 */
export async function settleQueries(client: QueryClient) {
	await act(async () => {
		while (client.isFetching() > 0) await nextTask()
		// React Query batches its notifications to observers into the next task.
		await nextTask()
	})
}
