import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { RawCexInflowsBatchResponse, RawCexsResponse } from './api.types'
import type { CexInflowsRequest } from './types'

const CEXS_API_URL = `${SERVER_URL}/cexs`
const CEX_INFLOW_BATCH_SIZE = 100

/**
 * Fetch centralized exchange summary data.
 */
export async function fetchCexs(): Promise<RawCexsResponse> {
	return fetchJson<RawCexsResponse>(CEXS_API_URL)
}
export async function fetchCexInflowsBatchProxy(
	cexs: Array<CexInflowsRequest>,
	startTime: number,
	endTime: number,
	authorizedFetch: (url: string, options?: RequestInit) => Promise<Response | null>
): Promise<RawCexInflowsBatchResponse> {
	const requests: Array<Promise<RawCexInflowsBatchResponse>> = []
	for (let index = 0; index < cexs.length; index += CEX_INFLOW_BATCH_SIZE) {
		const batch = cexs.slice(index, index + CEX_INFLOW_BATCH_SIZE)
		requests.push(
			authorizedFetch('/api/private/cex/inflows/batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cexs: batch, start: startTime, end: endTime })
			}).then((res) => {
				if (!res || !res.ok) {
					throw new Error(`Inflows batch API returned ${res?.status ?? 'no response'}`)
				}
				return res.json()
			})
		)
	}

	const responses = await Promise.all(requests)
	const inflows: RawCexInflowsBatchResponse = {}
	for (const response of responses) {
		for (const cexProtocolSlug in response) inflows[cexProtocolSlug] = response[cexProtocolSlug]
	}
	return inflows
}
