import { ETF_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { IETFFlowApiItem, IETFSnapshotApiItem } from './api.types'

/**
 * Fetch ETF snapshot data.
 */
export async function fetchETFSnapshot(): Promise<Array<IETFSnapshotApiItem>> {
	return fetchJson<Array<IETFSnapshotApiItem>>(`${ETF_SERVER_URL}/snapshot`)
}

/**
 * Fetch ETF flow time series data.
 */
export async function fetchETFFlows(): Promise<Array<IETFFlowApiItem>> {
	return fetchJson<Array<IETFFlowApiItem>>(`${ETF_SERVER_URL}/flows`)
}
