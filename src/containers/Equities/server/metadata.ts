import { EQUITIES_SERVER_URL } from '~/constants'
import type { IEquitiesCompanyListApiItem, IEquitiesCompanyRoute } from '~/containers/Equities/api.types'
import { fetchMetadataJson } from '~/utils/metadata/http'

export async function fetchEquitiesCompanyRouteMetadata(): Promise<IEquitiesCompanyRoute[]> {
	const companies = await fetchMetadataJson<IEquitiesCompanyListApiItem[]>(
		`${EQUITIES_SERVER_URL}/companies-list?zz=19`
	)
	return companies.map(({ ticker, country }) => ({ ticker, country }))
}
