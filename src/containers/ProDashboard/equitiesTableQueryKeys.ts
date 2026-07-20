import { buildEquityTickerCountrySlug, parseEquityTickerCountryParam } from '~/containers/Equities/tickerCountry'
import { getProEquitiesFilingsCacheKey, getProEquitiesStatementsCacheKey } from './tableQueryKeys'

function getEquitiesTableQueryKey(type: 'statements' | 'filings', tickerParam: string) {
	const tickerCountry = parseEquityTickerCountryParam(tickerParam)
	if (!tickerCountry) return null
	const ticker = buildEquityTickerCountrySlug(tickerCountry.ticker, tickerCountry.country)
	return type === 'statements' ? getProEquitiesStatementsCacheKey(ticker) : getProEquitiesFilingsCacheKey(ticker)
}

export const getProEquitiesStatementsQueryKey = (tickerParam: string) =>
	getEquitiesTableQueryKey('statements', tickerParam)

export const getProEquitiesFilingsQueryKey = (tickerParam: string) => getEquitiesTableQueryKey('filings', tickerParam)
