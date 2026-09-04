import { EQUITIES_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { PriceChartTimeframe } from '~/utils/priceChartTimeframes'
import type {
	EquitiesPriceHistory,
	IEquitiesCompanyApiItem,
	IEquitiesCompanyListApiItem,
	IEquitiesDimensionsResponse,
	IEquitiesFilingApiItem,
	IEquitiesMetadataResponse,
	IEquitiesOnchainResponse,
	IEquitiesStatementsResponse,
	IEquitiesSummaryResponse
} from './api.types'
import { toEquitiesPriceHistoryApiTimeframe, type EquitiesPriceHistoryApiTimeframe } from './priceHistoryTimeframes'

const EQUITIES_COMPANIES_API = `${EQUITIES_SERVER_URL}/companies`
const EQUITIES_COMPANIES_LIST_API = `${EQUITIES_SERVER_URL}/companies-list`
const EQUITIES_STATEMENTS_API = `${EQUITIES_SERVER_URL}/statements`
const EQUITIES_PRICE_HISTORY_API = `${EQUITIES_SERVER_URL}/price-history`
const EQUITIES_SUMMARY_API = `${EQUITIES_SERVER_URL}/summary`
const EQUITIES_METADATA_API = `${EQUITIES_SERVER_URL}/metadata`
const EQUITIES_FILINGS_API = `${EQUITIES_SERVER_URL}/filings`
const EQUITIES_DIMENSIONS_API = `${EQUITIES_SERVER_URL}/dimensions`
const EQUITIES_ONCHAIN_API = `${EQUITIES_SERVER_URL}/onchain`

function createEquitiesUrl(
	baseUrl: string,
	params?: { ticker?: string; country?: string; countries?: 'US'; timeframe?: EquitiesPriceHistoryApiTimeframe }
): string {
	const url = new URL(baseUrl)

	if (params?.ticker) {
		url.searchParams.set('ticker', params.ticker)
	}

	if (params?.country) {
		url.searchParams.set('country', params.country)
	}

	if (params?.countries) {
		url.searchParams.set('countries', params.countries)
	}

	if (params?.timeframe) {
		url.searchParams.set('timeframe', params.timeframe)
	}
	url.searchParams.set('zz', '19')

	return url.toString()
}

/**
 * Fetch the live market summary for all companies.
 */
export async function fetchEquitiesCompanies(): Promise<IEquitiesCompanyApiItem[]> {
	return fetchJson<IEquitiesCompanyApiItem[]>(createEquitiesUrl(EQUITIES_COMPANIES_API, { countries: 'US' }))
}

/**
 * Fetch the lightweight identity list for all synced companies.
 */
export async function fetchEquitiesCompaniesList(): Promise<IEquitiesCompanyListApiItem[]> {
	return fetchJson<IEquitiesCompanyListApiItem[]>(createEquitiesUrl(EQUITIES_COMPANIES_LIST_API, { countries: 'US' }))
}

/**
 * Fetch the normalized financial statements for a company ticker.
 */
export async function fetchEquitiesStatements(ticker: string, country: string): Promise<IEquitiesStatementsResponse> {
	return fetchJson<IEquitiesStatementsResponse>(createEquitiesUrl(EQUITIES_STATEMENTS_API, { ticker, country }))
}

/**
 * Fetch close prices for a company ticker at the requested timeframe's resolution.
 */
export async function fetchEquitiesPriceHistory(
	ticker: string,
	country: string,
	timeframe: PriceChartTimeframe
): Promise<EquitiesPriceHistory> {
	return fetchJson<EquitiesPriceHistory>(
		createEquitiesUrl(EQUITIES_PRICE_HISTORY_API, {
			ticker,
			country,
			timeframe: toEquitiesPriceHistoryApiTimeframe(timeframe)
		})
	)
}

/**
 * Fetch the live market summary for a company ticker.
 */
export async function fetchEquitiesSummary(ticker: string, country: string): Promise<IEquitiesSummaryResponse> {
	return fetchJson<IEquitiesSummaryResponse>(createEquitiesUrl(EQUITIES_SUMMARY_API, { ticker, country }))
}

/**
 * Fetch metadata for a company ticker.
 */
export async function fetchEquitiesMetadata(ticker: string, country: string): Promise<IEquitiesMetadataResponse> {
	return fetchJson<IEquitiesMetadataResponse>(createEquitiesUrl(EQUITIES_METADATA_API, { ticker, country }))
}

/**
 * Fetch SEC filings for a company ticker.
 */
export async function fetchEquitiesFilings(ticker: string, country: string): Promise<IEquitiesFilingApiItem[]> {
	return fetchJson<IEquitiesFilingApiItem[]>(createEquitiesUrl(EQUITIES_FILINGS_API, { ticker, country }))
}

/**
 * Fetch annual and quarterly fundamentals for a company ticker.
 */
export async function fetchEquitiesDimensions(ticker: string, country: string): Promise<IEquitiesDimensionsResponse> {
	return fetchJson<IEquitiesDimensionsResponse>(createEquitiesUrl(EQUITIES_DIMENSIONS_API, { ticker, country }))
}

/**
 * Fetch on-chain tokenized asset and perp market coverage for a company ticker.
 */
export async function fetchEquitiesOnchain(ticker: string, country: string): Promise<IEquitiesOnchainResponse> {
	return fetchJson<IEquitiesOnchainResponse>(createEquitiesUrl(EQUITIES_ONCHAIN_API, { ticker, country }))
}
