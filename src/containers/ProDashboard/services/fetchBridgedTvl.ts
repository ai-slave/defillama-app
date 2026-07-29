import type { ChainAssetsChartResponse } from '~/containers/BridgedTVL/api.types'
import { fetchJson } from '~/utils/async'

/** Keep the Pro API key server-side while allowing the dashboard client to retry an unseeded chart. */
export async function fetchProDashboardBridgedTvl(chain: string): Promise<Array<[number, number]>> {
	const query = new URLSearchParams({ kind: 'bridged-tvl', chain })
	const chart = await fetchJson<ChainAssetsChartResponse>(`/api/public/chains/charts?${query}`)

	return chart.map(({ timestamp, data }) => [timestamp, data.total])
}
