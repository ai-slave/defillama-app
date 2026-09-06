import { PRE_IPO_SERVER_URL } from '~/constants'
import type { PreIpoCompanyListItem, PreIpoSnapshot } from '~/containers/PreIPO/api.types'
import { fetchMetadataJson } from '~/utils/metadata/http'

export async function fetchPreIpoCompanyIds(): Promise<Array<string>> {
	const snapshot = await fetchMetadataJson<PreIpoSnapshot<Array<PreIpoCompanyListItem>>>(
		`${PRE_IPO_SERVER_URL}/companies-list`
	)
	const ids: Array<string> = []
	for (const company of snapshot.data) ids.push(company.id)
	return ids
}
