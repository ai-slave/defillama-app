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

export type EquitiesPriceHistoryTimeframe = '1W' | '1M' | '6M' | '1Y' | '5Y' | 'MAX'

export type EquitiesPriceHistory = Array<[string, number]>

export type EquitiesDimensionMetric = 'revenue' | 'holdersRevenue' | 'earnings'

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
	perps: IEquitiesOnchainPerpApiItem[]
	tokens: IEquitiesOnchainTokenApiItem[]
}

interface IEquitiesStatementPeriodData {
	periodEnding: string[]
	values: Array<Array<number | null>>
	children: Record<string, { values: Array<Array<number | null>> }>
}

interface IEquitiesStatementSection {
	labels: string[]
	children: {
		quarterly: Record<string, { labels: string[] }>
		annual: Record<string, { labels: string[] }>
	}
	quarterly: IEquitiesStatementPeriodData
	annual: IEquitiesStatementPeriodData
}

export interface IEquitiesStatementsResponse {
	incomeStatement: IEquitiesStatementSection
	balanceSheet: IEquitiesStatementSection
	cashflow: IEquitiesStatementSection
}
