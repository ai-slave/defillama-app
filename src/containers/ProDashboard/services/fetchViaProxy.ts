import { fetchWithPoolingOnServer } from '~/utils/http-client'
import type {
	ProDashboardProxyParams,
	ProDashboardProxyResponse,
	ProDashboardProxyType
} from '../dashboardProxyContract'
const PROXY_URL = '/api/private/pro-dashboard/fetch'

export async function fetchProDashboardProxy<TType extends ProDashboardProxyType>(
	type: TType,
	params: ProDashboardProxyParams<TType>,
	authToken: string
): Promise<ProDashboardProxyResponse<TType>> {
	const url = `${PROXY_URL}?request=${encodeURIComponent(JSON.stringify({ type, params }))}`
	const res = await fetchWithPoolingOnServer(url, {
		headers: {
			Authorization: `Bearer ${authToken}`
		}
	})
	if (!res.ok) {
		throw new Error(`Proxy fetch failed: ${res.status}`)
	}
	const json: { data: ProDashboardProxyResponse<TType> } = await res.json()
	return json.data
}
