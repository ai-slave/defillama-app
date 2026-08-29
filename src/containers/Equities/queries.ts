import { rwaSlug } from '~/containers/RWA/rwaSlug'
import { DEFAULT_PRICE_CHART_TIMEFRAME } from '~/utils/priceChartTimeframes'
import {
	fetchEquitiesCompanies,
	fetchEquitiesCompaniesList,
	fetchEquitiesDimensions,
	fetchEquitiesFilings,
	fetchEquitiesMetadata,
	fetchEquitiesOnchain,
	fetchEquitiesPriceHistory,
	fetchEquitiesStatements,
	fetchEquitiesSummary
} from './api'
import type { IEquitiesCompanyRoute, IEquitiesOnchainResponse } from './api.types'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import type { IEquitiesListPageProps, IEquitiesOnchainPageData, IEquityTickerPageProps } from './types'

export async function getEquitiesListPageData(): Promise<IEquitiesListPageProps> {
	const companies = await fetchEquitiesCompanies()
	const rows: IEquitiesListPageProps['companies'] = []
	let updatedAt: string | undefined

	// The producer already writes this complete population in descending market-cap order.
	for (const company of companies) {
		rows.push({
			...company,
			href: `/equities/${buildEquityTickerCountrySlug(company.ticker, company.country)}`
		})
		updatedAt ??= company.updatedAt
	}

	return { companies: rows, ...(updatedAt === undefined ? {} : { updatedAt }) }
}

function buildRwaPlatformNameLookup(platforms: string[]): Map<string, string> {
	const lookup = new Map<string, string>()

	for (const platform of platforms) {
		lookup.set(rwaSlug(platform), platform)
	}

	return lookup
}

function buildEquitiesOnchainPageData({
	onchain,
	protocolDisplayNames,
	rwaPlatforms
}: {
	onchain: IEquitiesOnchainResponse
	protocolDisplayNames: Map<string, string>
	rwaPlatforms: string[]
}): IEquitiesOnchainPageData {
	const rwaPlatformNames = buildRwaPlatformNameLookup(rwaPlatforms)
	const perps: IEquitiesOnchainPageData['perps'] = []
	const tokens: IEquitiesOnchainPageData['tokens'] = []

	for (const row of onchain.perps) {
		perps.push({
			...row,
			exchangeName: row.exchangeProtocolSlug
				? (protocolDisplayNames.get(row.exchangeProtocolSlug) ?? row.exchangeProtocolSlug)
				: null,
			platformName: row.rwaPlatformSlug ? (rwaPlatformNames.get(row.rwaPlatformSlug) ?? row.rwaPlatformSlug) : null
		})
	}

	perps.sort((a, b) => {
		if (a.volume24h == null) return b.volume24h == null ? 0 : 1
		if (b.volume24h == null) return -1
		return b.volume24h - a.volume24h
	})
	// Match token markets: promote only Bybit's top-volume pair until the user chooses a column sort.
	const bybitIndex = perps.findIndex((row) => row.rwaPlatformSlug === 'bybit')
	if (bybitIndex > 0) {
		perps.unshift(...perps.splice(bybitIndex, 1))
	}

	for (const row of onchain.tokens) {
		tokens.push({
			...row,
			issuerRwaPlatformName: rwaPlatformNames.get(row.issuerRwaPlatformSlug) ?? row.issuerRwaPlatformSlug
		})
	}

	return { perps, tokens }
}

interface EquitiesTickerPageMetadata {
	protocolDisplayNames: Map<string, string>
	rwaPlatforms: string[]
	emissionsProtocolBySlug: Record<string, string>
}

export async function getEquitiesTickerPageData(
	ticker: string,
	country: string,
	pageMetadata: EquitiesTickerPageMetadata
): Promise<IEquityTickerPageProps | null> {
	const [summary, metadata, priceHistory, statements, filings, dimensions, rawOnchain] = await Promise.all([
		fetchEquitiesSummary(ticker, country),
		fetchEquitiesMetadata(ticker, country),
		fetchEquitiesPriceHistory(ticker, country, DEFAULT_PRICE_CHART_TIMEFRAME).catch(() => null),
		fetchEquitiesStatements(ticker, country).catch(() => null),
		fetchEquitiesFilings(ticker, country).catch(() => null),
		fetchEquitiesDimensions(ticker, country).catch(() => null),
		fetchEquitiesOnchain(ticker, country).catch(() => null)
	])

	if (!summary || !metadata || !statements || !dimensions || !metadata.ticker || !metadata.name) {
		return null
	}

	const filingForms = new Set<string>()
	if (filings) {
		for (const filing of filings) filingForms.add(filing.form)
	}

	// Equities unlocks are keyed by lowercased ticker in the emissions list
	const tickerSlug = ticker.toLowerCase()
	const unlocksSlug = pageMetadata.emissionsProtocolBySlug[tickerSlug] ? tickerSlug : null

	return {
		ticker,
		country,
		slug: buildEquityTickerCountrySlug(ticker, country),
		name: metadata.name,
		metadata,
		summary,
		priceHistory,
		statements,
		dimensions,
		filings,
		filingForms: Array.from(filingForms).sort((a, b) => a.localeCompare(b)),
		onchain: rawOnchain
			? buildEquitiesOnchainPageData({
					onchain: rawOnchain,
					protocolDisplayNames: pageMetadata.protocolDisplayNames,
					rwaPlatforms: pageMetadata.rwaPlatforms
				})
			: null,
		unlocksSlug
	}
}

export async function getEquitiesTickerPaths(limit = 50): Promise<string[]> {
	const companies = await fetchEquitiesCompaniesList().catch(() => [])
	const paths: string[] = []
	for (const company of companies) {
		if (paths.length >= limit) break
		paths.push(buildEquityTickerCountrySlug(company.ticker, company.country))
	}
	return paths
}

export async function getEquitiesTickerRedirectSlug(
	rawTicker: string,
	companiesList?: IEquitiesCompanyRoute[]
): Promise<string | null> {
	const lookupTicker = rawTicker.toLowerCase()
	const companies = companiesList ?? (await fetchEquitiesCompaniesList().catch(() => []))
	let match: IEquitiesCompanyRoute | null = null
	for (const company of companies) {
		if (company.ticker.toLowerCase() !== lookupTicker) continue
		if (match) return null
		match = company
	}
	return match ? buildEquityTickerCountrySlug(match.ticker, match.country) : null
}
