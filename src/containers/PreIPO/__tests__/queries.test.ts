import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreIpoCompanyListItem, PreIpoCompanySummary, PreIpoIntegrations } from '../api.types'

type PreIpoApi = typeof import('../api')

const api = vi.hoisted(() => ({
	fetchPreIpoCompanies: vi.fn<PreIpoApi['fetchPreIpoCompanies']>(),
	fetchPreIpoCompanySummary: vi.fn<PreIpoApi['fetchPreIpoCompanySummary']>(),
	fetchPreIpoValuations: vi.fn<PreIpoApi['fetchPreIpoValuations']>(),
	fetchPreIpoRaises: vi.fn<PreIpoApi['fetchPreIpoRaises']>(),
	fetchPreIpoIntegrations: vi.fn<PreIpoApi['fetchPreIpoIntegrations']>()
}))

vi.mock('../api', () => api)

const valuationDataUpdatedAt = '2026-08-25T00:00:00.000Z'
const marketDataUpdatedAt = '2026-08-25T00:05:00.000Z'
const company = {
	id: 'anthropic',
	name: 'Anthropic',
	description: 'AI company',
	website: 'https://anthropic.com',
	sector: 'Artificial Intelligence',
	latestEstimatedValuation: 1_000,
	latestRaise: 100,
	latestFundingValuation: 900,
	totalRaised: 500,
	valuationChange1YPercentage: 10,
	premiumVsLatestFundingPercentage: 11.11,
	daysSinceLatestFunding: 1,
	daysSinceLastValuation: 0
} satisfies PreIpoCompanyListItem
const summary = {
	id: 'anthropic',
	name: 'Anthropic',
	description: 'AI company',
	summary: 'AI company',
	website: 'https://anthropic.com',
	sector: 'Artificial Intelligence',
	latestEstimatedValuation: null,
	latestRaise: null
} satisfies PreIpoCompanySummary
const integrations = {
	perps: [
		{
			exchangeName: 'Example Exchange',
			platformSlug: 'example-exchange',
			defillamaContract: 'ANTHROPIC-USD',
			exchangeType: 'DEX',
			openInterest: 0,
			volume: 0,
			price: 1,
			annualizedFundingRate: 0,
			tradeUrl: 'https://example.com/trade',
			estimatedValuation: null
		}
	],
	tokenIssuers: []
} satisfies PreIpoIntegrations

beforeEach(() => {
	vi.clearAllMocks()
	api.fetchPreIpoCompanies.mockResolvedValue({
		updatedAt: valuationDataUpdatedAt,
		data: []
	})
	api.fetchPreIpoCompanySummary.mockResolvedValue({
		updatedAt: valuationDataUpdatedAt,
		data: summary
	})
	api.fetchPreIpoValuations.mockResolvedValue({
		updatedAt: valuationDataUpdatedAt,
		data: []
	})
	api.fetchPreIpoRaises.mockResolvedValue({
		updatedAt: valuationDataUpdatedAt,
		data: []
	})
	api.fetchPreIpoIntegrations.mockResolvedValue({
		updatedAt: marketDataUpdatedAt,
		data: integrations
	})
})

describe('pre-IPO page queries', () => {
	it('passes the producer directory through without per-row copies', async () => {
		const companies = [company]
		api.fetchPreIpoCompanies.mockResolvedValue({
			updatedAt: valuationDataUpdatedAt,
			data: companies
		})
		const { getPreIpoOverviewPageData } = await import('../queries')

		const page = await getPreIpoOverviewPageData()

		expect(page.companies).toBe(companies)
		expect(page.updatedAt).toBe(valuationDataUpdatedAt)
	})

	it('requests every required company snapshot and preserves independent freshness', async () => {
		const { getPreIpoCompanyPageData } = await import('../queries')
		const page = await getPreIpoCompanyPageData('anthropic')

		expect(api.fetchPreIpoCompanySummary).toHaveBeenCalledWith('anthropic')
		expect(api.fetchPreIpoValuations).toHaveBeenCalledWith('anthropic')
		expect(api.fetchPreIpoRaises).toHaveBeenCalledWith('anthropic')
		expect(api.fetchPreIpoIntegrations).toHaveBeenCalledWith('anthropic')
		expect(page.chart).toBeNull()
		expect(page.integrations).toBe(integrations)
		expect(page.integrations.perps[0]?.volume).toBe(0)
		expect(page.integrations.perps[0]?.annualizedFundingRate).toBe(0)
		expect(page.valuationDataUpdatedAt).toBe(valuationDataUpdatedAt)
		expect(page.marketDataUpdatedAt).toBe(marketDataUpdatedAt)
	})

	it('rejects the page when any required snapshot fails', async () => {
		api.fetchPreIpoIntegrations.mockRejectedValue(new Error('integrations unavailable'))
		const { getPreIpoCompanyPageData } = await import('../queries')

		await expect(getPreIpoCompanyPageData('anthropic')).rejects.toThrow('integrations unavailable')
	})
})
