import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { EmissionsBreakdownAggregatedResponse } from './api.types'

const EMISSIONS_BREAKDOWN_AGGREGATED_API = `${SERVER_URL}/emissionsBreakdownAggregated`

export async function fetchEmissionsBreakdownAggregated(): Promise<EmissionsBreakdownAggregatedResponse | null> {
	try {
		const data = await fetchJson<EmissionsBreakdownAggregatedResponse>(EMISSIONS_BREAKDOWN_AGGREGATED_API)
		return data
	} catch (error) {
		console.error('Failed to fetch emissions breakdown aggregated:', error)
		return null
	}
}
