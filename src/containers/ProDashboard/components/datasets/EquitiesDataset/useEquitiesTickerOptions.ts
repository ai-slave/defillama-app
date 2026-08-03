import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import { buildEquityTickerCountrySlug } from '~/containers/Equities/tickerCountry'
import { ProxyAuthTokenContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { PRO_EQUITIES_COMPANIES_QUERY_KEY } from '~/containers/ProDashboard/tableQueryKeys'

export function useEquitiesTickerOptions(enabled: boolean) {
	const authToken = useContext(ProxyAuthTokenContext)
	const { data, isLoading } = useQuery({
		queryKey: PRO_EQUITIES_COMPANIES_QUERY_KEY,
		queryFn: () => {
			if (!authToken) throw new Error('Missing Pro dashboard proxy auth token')
			return fetchProDashboardProxy('equitiesCompanies', {}, authToken)
		},
		enabled: enabled && Boolean(authToken),
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const options = useMemo(() => {
		if (!data) return []
		const sortedCompanies = [...data].sort((a, b) => {
			if (a.marketCap === b.marketCap) return 0
			if (a.marketCap === null) return 1
			if (b.marketCap === null) return -1
			return b.marketCap - a.marketCap
		})
		return sortedCompanies.map((company) => ({
			value: buildEquityTickerCountrySlug(company.ticker, company.country),
			label: `${company.ticker}:${company.country} — ${company.name}`
		}))
	}, [data])

	return { options, isLoading }
}
