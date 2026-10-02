export interface IEquitiesCompanyApiItem {
	ticker: string
	country: string
	name: string
	currentPrice: number | null
	volume: number | null
	marketCap: number | null
	circulatingMarketCap: number | null
	enterpriseValue: number | null
	fiftyTwoWeekHigh: number | null
	fiftyTwoWeekLow: number | null
	dividendYield: number | null
	trailingPE: number | null
	priceToRevenue: number | null
	priceChangePercentage1d: number | null
	priceChangePercentage7d: number | null
	priceChangePercentage1m: number | null
	priceChange1d: number | null
	marketCapChange1d: number | null
	priceToBook: number | null
	enterpriseValueToEbitda: number | null
	holdersYield: number | null
	updatedAt: string
	revenueTTM: number | null
	grossProfitTTM: number | null
	earningsTTM: number | null
	ebitdaTTM: number | null
	operatingProfitMarginTTM: number | null
	holdersRevenueTTM: number | null
	holderEarningsTTM: number | null
	dividendsTTM: number | null
	stockRepurchaseTTM: number | null
	stockIssuanceTTM: number | null
	stockBasedCompensationTTM: number | null
	cashAndCashEquivalents: number | null
	totalAssets: number | null
	totalLiabilities: number | null
	totalShareholdersEquity: number | null
	totalDebt: number | null
	circulatingSupply: number | null
	totalSupply: number | null
	employeeCount: number | null
	sector: string
	industry: string
	sectorSlug?: string
	industrySlug?: string
}

export interface IEquitiesAggregateHolding {
	ticker: string
	name: string
	marketCap: number | null
	sectorWeight: number | null
	priceChangePercentage1d: number | null
}

export interface IEquitiesAggregateReturns {
	priceChangePercentage1d: number | null
	priceChangePercentage7d: number | null
	priceChangePercentage1m: number | null
	priceChangePercentage3m: number | null
	priceChangePercentage6m: number | null
	priceChangePercentageYtd: number | null
	priceChangePercentage1y: number | null
}

export interface IEquitiesAggregateValuation {
	trailingPE: number | null
	priceToRevenue: number | null
	priceToBook: number | null
	enterpriseValueToEbitda: number | null
	operatingProfitMarginTTM: number | null
	dividendYield: number | null
	earningsYield: number | null
	medianTrailingPE?: number | null
	medianPriceToRevenue?: number | null
	medianEnterpriseValueToEbitda?: number | null
	medianOperatingProfitMarginTTM?: number | null
	medianDividendYield?: number | null
}

export interface IEquitiesAggregateRow extends IEquitiesAggregateReturns, IEquitiesAggregateValuation {
	rank: number
	marketCap: number | null
	marketCapChange1d: number | null
	dollarVolume24h: number | null
	dollarVolumeShare24h: number | null
	revenueTTM: number | null
	earningsTTM: number | null
	ebitdaTTM: number | null
	enterpriseValue: number | null
	employeeCount: number | null
	holdersYield: number | null
	companyCount: number
	weight: number | null
	topHoldings: Array<IEquitiesAggregateHolding>
	coverage: Record<string, number>
	updatedAt: string
	volumeAsOf: string
}

export interface IEquitiesSectorApiItem extends IEquitiesAggregateRow {
	sector: string
	sectorSlug: string
	industryCount: number
}

export interface IEquitiesIndustryApiItem extends IEquitiesAggregateRow {
	industry: string
	industrySlug: string
	sector: string
	sectorSlug: string
	sectorWeight: number | null
}

export interface IEquitiesSectorOverviewApiResponse extends IEquitiesAggregateReturns, IEquitiesAggregateValuation {
	marketCap: number | null
	marketCapChange1d: number | null
	dollarVolume24h: number | null
	revenueTTM: number | null
	earningsTTM: number | null
	ebitdaTTM: number | null
	employeeCount: number | null
	companyCount: number
	sectorCount: number
	industryCount: number
	bestSector1d: Pick<IEquitiesSectorApiItem, 'sector' | 'sectorSlug' | 'priceChangePercentage1d'>
	worstSector1d: Pick<IEquitiesSectorApiItem, 'sector' | 'sectorSlug' | 'priceChangePercentage1d'>
	largestSector: Pick<IEquitiesSectorApiItem, 'sector' | 'sectorSlug' | 'weight'>
}

export interface IEquitiesSectorDetailApiResponse extends IEquitiesSectorApiItem {
	description: string
	valuation: IEquitiesAggregateValuation
	concentration: {
		top10MarketCapShare: number | null
		hhi: number | null
		megaCapCount: number
		megaCapThreshold: number
		medianMarketCap: number | null
	}
}

export type EquitiesEarningsDateStatus = 'reported' | 'inferred' | 'estimated' | 'confirmed'
export type EquitiesEarningsReportTime = 'bmo' | 'amc' | 'dmt' | 'unknown'

export interface IEquitiesEarningsCalendarApiItem {
	ticker: string
	date_status: EquitiesEarningsDateStatus
	report_date: string
	report_time: EquitiesEarningsReportTime
	max_drift_days: number | null
	fiscal_year: number
	fiscal_period: string
	event_key: string
	cik: string
	accession_number: string
}

export interface IEquitiesCompanyRoute {
	ticker: string
	country: string
}

export interface IEquitiesCompanyListApiItem extends IEquitiesCompanyRoute {
	companyName: string
	countryName: string
}

export interface IEquitiesSummaryResponse extends Omit<
	IEquitiesCompanyApiItem,
	'ticker' | 'country' | 'name' | 'sector' | 'industry'
> {}

export interface IEquitiesMetadataResponse {
	ticker: string
	name: string
	country: string
	sector: string
	industry: string
	employeeCount: number | null
	website: string
	description: string
	startDate: string
}

export type EquitiesPriceHistory = Array<[string, number]>

export type EquitiesDimensionMetric = 'revenue' | 'holdersRevenue' | 'earnings' | 'basicSharesOutstanding'

export type EquitiesDimensionPeriod = 'quarterly' | 'annual'

type EquitiesDimensionSeries = Array<[string, number]>

interface IEquitiesDimensionData {
	annual: EquitiesDimensionSeries
	quarterly: EquitiesDimensionSeries
}

export interface IEquitiesDimensionsResponse {
	revenue: IEquitiesDimensionData
	holdersRevenue: IEquitiesDimensionData
	earnings: IEquitiesDimensionData
	basicSharesOutstanding: IEquitiesDimensionData
}

export interface IEquitiesFilingApiItem {
	filingDate: string
	reportDate: string | null
	form: string
	primaryDocumentUrl: string
	documentDescription: string
}

export interface IEquitiesOnchainPerpApiItem {
	pair: string
	price: number | null
	volume24h: number | null
	openInterest: number | null
	annualizedFundingRate: number | null
	tradeUrl: string
	contractSlug: string
	exchangeProtocolSlug?: string
	rwaPlatformSlug?: string
	exchangeType: 'CEX' | 'DEX'
	updatedAt: string
}

export interface IEquitiesOnchainTokenApiItem {
	issuer: string
	issuerRwaPlatformSlug: string
	price: number | null
	assetSlug: string
	activeMarketcap: number | null
}

export interface IEquitiesOnchainResponse {
	perps: Array<IEquitiesOnchainPerpApiItem>
	tokens: Array<IEquitiesOnchainTokenApiItem>
}

interface IEquitiesStatementPeriodData {
	periodEnding: Array<string>
	values: Array<Array<number | null>>
	children: Record<string, { values: Array<Array<number | null>> }>
}

interface IEquitiesStatementSection {
	labels: Array<string>
	children: {
		quarterly: Record<string, { labels: Array<string> }>
		annual: Record<string, { labels: Array<string> }>
	}
	quarterly: IEquitiesStatementPeriodData
	annual: IEquitiesStatementPeriodData
}

export interface IEquitiesStatementsResponse {
	incomeStatement: IEquitiesStatementSection
	balanceSheet: IEquitiesStatementSection
	cashflow: IEquitiesStatementSection
}
