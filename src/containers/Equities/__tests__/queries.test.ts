import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PriceChartTimeframe } from '~/utils/priceChartTimeframes'
import type {
	EquitiesPriceHistory,
	IEquitiesCompanyApiItem,
	IEquitiesDimensionsResponse,
	IEquitiesFilingApiItem,
	IEquitiesMetadataResponse,
	IEquitiesOnchainResponse,
	IEquitiesStatementsResponse,
	IEquitiesSummaryResponse
} from '../api.types'
import { getEquitiesTickerPageData } from '../queries'

const mocks = vi.hoisted(() => ({
	fetchEquitiesCompanies: vi.fn<() => Promise<IEquitiesCompanyApiItem[]>>(),
	fetchEquitiesCompaniesList: vi.fn(),
	fetchEquitiesDimensions: vi.fn<(ticker: string, country: string) => Promise<IEquitiesDimensionsResponse>>(),
	fetchEquitiesFilings: vi.fn<(ticker: string, country: string) => Promise<IEquitiesFilingApiItem[]>>(),
	fetchEquitiesMetadata: vi.fn<(ticker: string, country: string) => Promise<IEquitiesMetadataResponse>>(),
	fetchEquitiesOnchain: vi.fn<(ticker: string, country: string) => Promise<IEquitiesOnchainResponse>>(),
	fetchEquitiesPriceHistory:
		vi.fn<(ticker: string, country: string, timeframe: PriceChartTimeframe) => Promise<EquitiesPriceHistory>>(),
	fetchEquitiesStatements: vi.fn<(ticker: string, country: string) => Promise<IEquitiesStatementsResponse>>(),
	fetchEquitiesSummary: vi.fn<(ticker: string, country: string) => Promise<IEquitiesSummaryResponse>>()
}))

vi.mock('../api', () => mocks)

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

const pageMetadata = {
	protocolDisplayNames: new Map<string, string>(),
	rwaPlatforms: [],
	emissionsProtocolBySlug: {}
}

function market(
	pair: string,
	volume24h: number | null,
	rwaPlatformSlug: string
): IEquitiesOnchainResponse['perps'][number] {
	return {
		pair,
		volume24h,
		rwaPlatformSlug,
		price: null,
		openInterest: null,
		annualizedFundingRate: null,
		tradeUrl: 'https://example.com',
		contractSlug: pair,
		exchangeType: 'CEX',
		updatedAt: '2026-08-27T00:00:00Z'
	}
}

beforeEach(() => {
	vi.clearAllMocks()
	mocks.fetchEquitiesSummary.mockResolvedValue(emptySummary)
	mocks.fetchEquitiesMetadata.mockResolvedValue({
		ticker: 'NVDA',
		name: 'NVIDIA Corporation',
		country: 'US',
		sector: 'Technology',
		industry: 'Semiconductors',
		employeeCount: null,
		website: 'https://www.nvidia.com',
		description: '',
		startDate: ''
	})
	mocks.fetchEquitiesPriceHistory.mockResolvedValue([])
	mocks.fetchEquitiesStatements.mockResolvedValue(emptyStatements)
	mocks.fetchEquitiesFilings.mockResolvedValue([])
	mocks.fetchEquitiesDimensions.mockResolvedValue(emptyDimensions)
	mocks.fetchEquitiesOnchain.mockResolvedValue({ perps: [], tokens: [] })
})

describe('getEquitiesTickerPageData', () => {
	it('fetches only the default 24H price history for page generation', async () => {
		const priceHistory: EquitiesPriceHistory = [
			['2026-08-27T13:35:00Z', 223],
			['2026-08-27T13:30:00Z', 222]
		]
		mocks.fetchEquitiesPriceHistory.mockResolvedValue(priceHistory)

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(mocks.fetchEquitiesPriceHistory).toHaveBeenCalledExactlyOnceWith('NVDA', 'US', '24H')
		expect(result?.priceHistory).toEqual(priceHistory)
	})

	it('derives an unlocks slug from a lowercased ticker present in emissions metadata', async () => {
		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map(),
			rwaPlatforms: [],
			emissionsProtocolBySlug: { nvda: 'nvda' }
		})

		expect(result?.unlocksSlug).toBe('nvda')
	})

	it('omits the unlocks slug when the ticker is absent from emissions metadata', async () => {
		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map(),
			rwaPlatforms: [],
			emissionsProtocolBySlug: {}
		})

		expect(result?.unlocksSlug).toBeNull()
	})

	it('keeps successful empty optional sources available', async () => {
		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map(),
			rwaPlatforms: [],
			emissionsProtocolBySlug: {}
		})

		expect(result?.priceHistory).toEqual([])
		expect(result?.filings).toEqual([])
		expect(result?.onchain).toEqual({ perps: [], tokens: [] })
		expect(mocks.fetchEquitiesOnchain).toHaveBeenCalledWith('NVDA', 'US')
	})

	it('preserves populated optional data and maps on-chain display names', async () => {
		mocks.fetchEquitiesFilings.mockResolvedValue([
			{
				filingDate: '2026-08-20',
				reportDate: null,
				form: '10-Q',
				primaryDocumentUrl: 'https://www.sec.gov/filing',
				documentDescription: 'Quarterly report'
			}
		])
		mocks.fetchEquitiesOnchain.mockResolvedValue({
			perps: [
				{
					pair: 'NVDA/USD',
					price: null,
					volume24h: 0,
					openInterest: null,
					annualizedFundingRate: 0,
					tradeUrl: 'https://example.com/cex',
					contractSlug: 'nvda',
					exchangeProtocolSlug: 'binance',
					rwaPlatformSlug: 'ondo-finance',
					exchangeType: 'CEX',
					updatedAt: '2026-08-24T00:00:00.000Z'
				},
				{
					pair: 'NVDA/USDC',
					price: 180,
					volume24h: null,
					openInterest: 0,
					annualizedFundingRate: null,
					tradeUrl: 'https://example.com/dex',
					contractSlug: 'nvda',
					exchangeProtocolSlug: 'binance',
					rwaPlatformSlug: 'ondo-finance',
					exchangeType: 'DEX',
					updatedAt: '2026-08-24T00:00:00.000Z'
				}
			],
			tokens: [
				{
					issuer: 'Ondo',
					issuerRwaPlatformSlug: 'ondo-finance',
					price: null,
					assetSlug: 'nvda',
					activeMarketcap: 0
				}
			]
		})

		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map([['binance', 'Binance']]),
			rwaPlatforms: ['Ondo Finance'],
			emissionsProtocolBySlug: {}
		})

		expect(result?.filings?.[0]?.reportDate).toBeNull()
		expect(result?.filingForms).toEqual(['10-Q'])
		expect(result?.onchain?.perps.map(({ exchangeType }) => exchangeType)).toEqual(['CEX', 'DEX'])
		expect(result?.onchain?.perps[0]).toMatchObject({
			price: null,
			volume24h: 0,
			openInterest: null,
			annualizedFundingRate: 0,
			exchangeName: 'Binance',
			platformName: 'Ondo Finance'
		})
		expect(result?.onchain?.tokens[0]).toMatchObject({
			price: null,
			activeMarketcap: 0,
			issuerRwaPlatformName: 'Ondo Finance'
		})
	})

	it('promotes only the highest-volume Bybit pair without mutating the API response', async () => {
		const onchain: IEquitiesOnchainResponse = {
			perps: [
				market('Bybit small', 10, 'bybit'),
				market('Binance', 300, 'binance'),
				market('Bybit large', 200, 'bybit'),
				market('Ostium', null, 'ostium'),
				market('Zero', 0, 'other')
			],
			tokens: []
		}
		for (const row of onchain.perps) Object.freeze(row)
		Object.freeze(onchain.perps)
		Object.freeze(onchain)
		mocks.fetchEquitiesOnchain.mockResolvedValue(onchain)

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result?.onchain?.perps.map(({ pair }) => pair)).toEqual([
			'Bybit large',
			'Binance',
			'Bybit small',
			'Zero',
			'Ostium'
		])
		expect(onchain.perps.map(({ pair }) => pair)).toEqual(['Bybit small', 'Binance', 'Bybit large', 'Ostium', 'Zero'])
	})

	it('orders markets by descending volume with missing values last when Bybit is absent', async () => {
		mocks.fetchEquitiesOnchain.mockResolvedValue({
			perps: [market('Ostium', null, 'ostium'), market('Zero', 0, 'other'), market('Binance', 300, 'binance')],
			tokens: []
		})

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result?.onchain?.perps.map(({ pair }) => pair)).toEqual(['Binance', 'Zero', 'Ostium'])
	})

	it.each([null, 0])('keeps Bybit first by default even when its volume is %s', async (volume) => {
		mocks.fetchEquitiesOnchain.mockResolvedValue({
			perps: [
				market('Ostium', null, 'ostium'),
				market('Binance', 300, 'binance'),
				market('Bybit', volume, 'bybit'),
				market('Bybit missing', null, 'bybit')
			],
			tokens: []
		})

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result?.onchain?.perps.map(({ pair }) => pair)).toEqual(['Bybit', 'Binance', 'Ostium', 'Bybit missing'])
	})

	it('keeps filings and on-chain data available when price history fails', async () => {
		mocks.fetchEquitiesPriceHistory.mockRejectedValue(new Error('prices unavailable'))

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result).not.toBeNull()
		expect(result?.priceHistory).toBeNull()
		expect(result?.filings).toEqual([])
		expect(result?.filingForms).toEqual([])
		expect(result?.onchain).toEqual({ perps: [], tokens: [] })
	})

	it('keeps price and on-chain data available when filings fail', async () => {
		mocks.fetchEquitiesFilings.mockRejectedValue(new Error('filings unavailable'))

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result).not.toBeNull()
		expect(result?.priceHistory).toEqual([])
		expect(result?.filings).toBeNull()
		expect(result?.filingForms).toEqual([])
		expect(result?.onchain).toEqual({ perps: [], tokens: [] })
	})

	it('keeps price and filings data available when on-chain data fails', async () => {
		mocks.fetchEquitiesOnchain.mockRejectedValue(new Error('on-chain unavailable'))

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result).not.toBeNull()
		expect(result?.priceHistory).toEqual([])
		expect(result?.filings).toEqual([])
		expect(result?.onchain).toBeNull()
	})

	it('keeps required statement failure page-atomic', async () => {
		mocks.fetchEquitiesStatements.mockRejectedValue(new Error('statements unavailable'))

		await expect(getEquitiesTickerPageData('NVDA', 'US', pageMetadata)).resolves.toBeNull()
	})

	it('keeps required dimensions failure page-atomic', async () => {
		mocks.fetchEquitiesDimensions.mockRejectedValue(new Error('dimensions unavailable'))

		await expect(getEquitiesTickerPageData('NVDA', 'US', pageMetadata)).resolves.toBeNull()
	})

	it.each([
		['summary', () => mocks.fetchEquitiesSummary.mockRejectedValue(new Error('summary unavailable'))],
		['metadata', () => mocks.fetchEquitiesMetadata.mockRejectedValue(new Error('metadata unavailable'))]
	])('keeps required %s request failure page-atomic', async (_source, rejectRequest) => {
		rejectRequest()

		await expect(getEquitiesTickerPageData('NVDA', 'US', pageMetadata)).rejects.toThrow('unavailable')
	})
})
