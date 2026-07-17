import { AI_SERVER } from '~/constants'

type AuthorizedFetch = (url: string, options?: RequestInit) => Promise<Response | null>

/** Persist a chat chart into the saved-charts library. `frozen: true` pins the
 * cached data forever (research exports); dashboard adds save unfrozen/live. */
export async function saveChartToLibrary(
	authorizedFetch: AuthorizedFetch,
	params: { chartId: string; sessionId?: string | null; messageId?: string; frozen?: boolean }
): Promise<string | null> {
	const { chartId, sessionId, messageId, frozen = false } = params
	const res = sessionId
		? await authorizedFetch(`${AI_SERVER}/agentic/save-chart`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId, chartId, frozen })
			})
		: await authorizedFetch(`${AI_SERVER}/charts`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageId, chartId, frozen })
			})
	if (!res?.ok) return null
	const json = await res.json()
	return typeof json.id === 'string' ? json.id : null
}
