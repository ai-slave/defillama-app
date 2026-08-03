import { AI_SERVER } from '~/constants'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
import type { ChartConfiguration, ChartStylePatch } from '~/containers/LlamaAI/chartTypes'

/**
 * Persist an in-place chart style edit. Owner-only; the server applies only whitelisted presentation
 * fields (data bindings can't change). Returns the server's applied ChartConfiguration.
 */
export async function updateChartStyle(
	authorizedFetch: AuthorizedFetch,
	params: { sessionId: string; messageId: string; chartId: string; style: ChartStylePatch }
): Promise<ChartConfiguration> {
	const res = await authorizedFetch(`${AI_SERVER}/agentic/update-chart-style`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params)
	})
	if (!res || !res.ok) {
		throw new Error(`update-chart-style failed${res ? ` (${res.status})` : ''}`)
	}
	const json = (await res.json()) as { chart: ChartConfiguration }
	return json.chart
}
