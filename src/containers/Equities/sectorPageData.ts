import type { IEquitiesCompanyApiItem } from './api.types'
import type { IEquitiesSectorPageData } from './types'

export type IEquitiesSectorPageCompanyRow = Pick<
	IEquitiesCompanyApiItem,
	| 'ticker'
	| 'country'
	| 'name'
	| 'industry'
	| 'industrySlug'
	| 'marketCap'
	| 'volume'
	| 'currentPrice'
	| 'priceChangePercentage1d'
	| 'priceChangePercentage7d'
	| 'priceChangePercentage1m'
	| 'trailingPE'
>

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
	companies: Array<EquitiesSectorPageCompanyTuple | IEquitiesSectorPageCompanyRow>
}

/** Keep only constituent values used by the page and avoid repeating object keys for every company in page JSON. */
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
			company.industrySlug,
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
	companies: Array<EquitiesSectorPageCompanyTuple | IEquitiesSectorPageCompanyRow>
): Array<IEquitiesSectorPageCompanyRow> {
	return companies.map((company) => {
		if (!Array.isArray(company)) return company as IEquitiesSectorPageCompanyRow

		const [
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
		] = company as EquitiesSectorPageCompanyTuple

		return {
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
		}
	})
}
