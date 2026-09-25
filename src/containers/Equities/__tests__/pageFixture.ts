import { beforeEach } from 'vitest'
import { EQUITIES_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import type { IEquitiesDimensionsResponse, IEquitiesStatementsResponse, IEquitiesSummaryResponse } from '../api.types'
const emptyDimensions: IEquitiesDimensionsResponse = {
	revenue: { annual: [], quarterly: [] },
	holdersRevenue: { annual: [], quarterly: [] },
	earnings: { annual: [], quarterly: [] },
	basicSharesOutstanding: { annual: [], quarterly: [] }
}

const emptyStatementSection = {
	labels: [],
	children: { quarterly: {}, annual: {} },
	quarterly: { periodEnding: [], values: [], children: {} },
	annual: { periodEnding: [], values: [], children: {} }
}

const emptyStatements: IEquitiesStatementsResponse = {
	incomeStatement: emptyStatementSection,
	balanceSheet: emptyStatementSection,
	cashflow: emptyStatementSection
}

const emptySummary: IEquitiesSummaryResponse = {
	currentPrice: null,
	volume: null,
	marketCap: null,
	circulatingMarketCap: null,
	enterpriseValue: null,
	fiftyTwoWeekHigh: null,
	fiftyTwoWeekLow: null,
	dividendYield: null,
	trailingPE: null,
	priceToRevenue: null,
	priceChangePercentage1d: null,
	priceChangePercentage7d: null,
	priceChangePercentage1m: null,
	priceChange1d: null,
	marketCapChange1d: null,
	priceToBook: null,
	enterpriseValueToEbitda: null,
	holdersYield: null,
	updatedAt: '2026-08-24T00:00:00.000Z',
	revenueTTM: null,
	grossProfitTTM: null,
	earningsTTM: null,
	ebitdaTTM: null,
	operatingProfitMarginTTM: null,
	holdersRevenueTTM: null,
	holderEarningsTTM: null,
	dividendsTTM: null,
	stockRepurchaseTTM: null,
	stockIssuanceTTM: null,
	stockBasedCompensationTTM: null,
	cashAndCashEquivalents: null,
	totalAssets: null,
	totalLiabilities: null,
	totalShareholdersEquity: null,
	totalDebt: null,
	circulatingSupply: null,
	totalSupply: null,
	employeeCount: null
}

export function installEquitiesPageNetwork() {
	const http = installFixtureFetch()
	beforeEach(() => {
		http.serve({ [`${EQUITIES_SERVER_URL}/summary`]: emptySummary })
		http.serve({
			[`${EQUITIES_SERVER_URL}/metadata`]: {
				ticker: 'NVDA',
				name: 'NVIDIA Corporation',
				country: 'US',
				sector: 'Technology',
				industry: 'Semiconductors',
				employeeCount: null,
				website: 'https://www.nvidia.com',
				description: '',
				startDate: ''
			}
		})
		http.serve({ [`${EQUITIES_SERVER_URL}/price-history`]: [] })
		http.serve({ [`${EQUITIES_SERVER_URL}/statements`]: emptyStatements })
		http.serve({ [`${EQUITIES_SERVER_URL}/filings`]: [] })
		http.serve({ [`${EQUITIES_SERVER_URL}/dimensions`]: emptyDimensions })
		http.serve({ [`${EQUITIES_SERVER_URL}/onchain`]: { perps: [], tokens: [] } })
	})

	return http
}
