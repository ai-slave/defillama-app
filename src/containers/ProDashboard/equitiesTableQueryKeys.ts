import { buildEquityTickerCountrySlug, parseEquityTickerCountryParam } from '~/containers/Equities/tickerCountry'
import { getProEquitiesFilingsCacheKey, getProEquitiesStatementsCacheKey } from './tableQueryKeys'

export function getEquitiesTableQueryKey(type: 'statements' | 'filings', tickerParam: string) {
	const tickerCountry = parseEquityTickerCountryParam(tickerParam)
	if (!tickerCountry) return null
	const ticker = buildEquityTickerCountrySlug(tickerCountry.ticker, tickerCountry.country)
	return type === 'statements' ? getProEquitiesStatementsCacheKey(ticker) : getProEquitiesFilingsCacheKey(ticker)
}
