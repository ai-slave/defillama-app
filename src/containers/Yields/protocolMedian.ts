import { fetchJson } from '~/utils/async'
import { getYieldsHistoryUrl } from './constants'

interface ProtocolMedianHistoryResponse {
	data: Array<{ date: string; median_apy: number; pools: number }>
}

export interface ProtocolMedianHistoryPoint {
	date: string
	medianApy: number
	pools: number
}

export async function fetchProtocolMedianHistory(protocol: string): Promise<ProtocolMedianHistoryPoint[]> {
	const response = await fetchJson<ProtocolMedianHistoryResponse>(
		getYieldsHistoryUrl(`/v2/protocol-median/${encodeURIComponent(protocol)}/history`)
	)
	return response.data.map((point) => ({ date: point.date, medianApy: point.median_apy, pools: point.pools }))
}
