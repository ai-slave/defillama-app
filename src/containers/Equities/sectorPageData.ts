import { toEquitiesTaxonomySlug } from './aggregateData'
import type { IEquitiesCompanyApiItem } from './api.types'
import type { IEquitiesSectorPageData } from './types'

export type IEquitiesSectorPageCompanyRow = Pick<
	IEquitiesCompanyApiItem,
	| 'ticker'
	| 'country'
	| 'name'
	| 'industry'
	| 'marketCap'
	| 'volume'
	| 'currentPrice'
	| 'priceChangePercentage1d'
	| 'priceChangePercentage7d'
	| 'priceChangePercentage1m'
	| 'trailingPE'
> & { industrySlug: string }

export type EquitiesSectorPageCompanyTuple = readonly [
	ticker: string,
	country: string,
	name: string,
	industry: string,
	industrySlug: string,
	marketCap: number | null,
	volume: number | null,
	currentPrice: number | null,
	priceChangePercentage1d: number | null,
	priceChangePercentage7d: number | null,
	priceChangePercentage1m: number | null,
	trailingPE: number | null
]

export type IEquitiesSectorPageViewData = Omit<IEquitiesSectorPageData, 'companies'> & {
	companies: Array<EquitiesSectorPageCompanyTuple>
}

/** Keep only page fields, resolve optional slugs, and avoid repeating object keys in static page JSON. */
export function buildEquitiesSectorPageViewData(data: IEquitiesSectorPageData): IEquitiesSectorPageViewData {
	return {
		overview: data.overview,
		sector: data.sector,
		industries: data.industries,
		companies: data.companies.map((company) => [
			company.ticker,
			company.country,
			company.name,
			company.industry,
			company.industrySlug ?? toEquitiesTaxonomySlug(company.industry),
			company.marketCap,
			company.volume,
			company.currentPrice,
			company.priceChangePercentage1d,
			company.priceChangePercentage7d,
			company.priceChangePercentage1m,
			company.trailingPE
		])
	}
}

export function readEquitiesSectorPageCompanies(
	companies: ReadonlyArray<EquitiesSectorPageCompanyTuple>
): Array<IEquitiesSectorPageCompanyRow> {
	return companies.map(
		([
			ticker,
			country,
			name,
			industry,
			industrySlug,
			marketCap,
			volume,
			currentPrice,
			priceChangePercentage1d,
			priceChangePercentage7d,
			priceChangePercentage1m,
			trailingPE
		]) => ({
			ticker,
			country,
			name,
			industry,
			industrySlug,
			marketCap,
			volume,
			currentPrice,
			priceChangePercentage1d,
			priceChangePercentage7d,
			priceChangePercentage1m,
			trailingPE
		})
	)
}
