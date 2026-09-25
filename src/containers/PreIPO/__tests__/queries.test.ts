import { beforeEach, describe, expect, test } from 'vitest'
import { PRE_IPO_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import type { PreIpoCompanyListItem, PreIpoCompanySummary, PreIpoIntegrations } from '../api.types'
import { getPreIpoCompanyPageData, getPreIpoOverviewPageData } from '../queries'
const http = installFixtureFetch()

const valuationDataUpdatedAt = '2026-08-25T00:00:00.000Z'
const marketDataUpdatedAt = '2026-08-25T00:05:00.000Z'
const company = {
	id: 'anthropic',
	name: 'Anthropic',
	description: 'AI company',
	website: 'https://anthropic.com',
	sector: 'Artificial Intelligence',
	latestEstimatedValuation: 1000,
	latestRaise: 100,
	latestFundingValuation: 900,
	latestFundingDate: '2026-08-24',
	lastValuationDate: '2026-08-25',
	totalRaised: 500,
	valuationChange1YPercentage: 10,
	premiumVsLatestFundingPercentage: 11.11
} satisfies PreIpoCompanyListItem
const summary = {
	id: 'anthropic',
	name: 'Anthropic',
	description: 'AI company',
	summary: 'AI company',
	website: 'https://anthropic.com',
	sector: 'Artificial Intelligence',
	latestEstimatedValuation: null,
	lastValuationDate: null,
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
	http.serve({
		[`${PRE_IPO_SERVER_URL}/companies-list`]: {
			updatedAt: valuationDataUpdatedAt,
			data: []
		}
	})
	http.serve({
		[`${PRE_IPO_SERVER_URL}/summary?company=anthropic`]: {
			updatedAt: valuationDataUpdatedAt,
			data: summary
		}
	})
	http.serve({
		[`${PRE_IPO_SERVER_URL}/valuations?company=anthropic`]: {
			updatedAt: valuationDataUpdatedAt,
			data: []
		}
	})
	http.serve({
		[`${PRE_IPO_SERVER_URL}/raises?company=anthropic`]: {
			updatedAt: valuationDataUpdatedAt,
			data: []
		}
	})
	http.serve({
		[`${PRE_IPO_SERVER_URL}/integrations?company=anthropic`]: {
			updatedAt: marketDataUpdatedAt,
			data: integrations
		}
	})
})

describe('pre-IPO page queries', () => {
	test('preserves the company directory and its publication time', async () => {
		const companies = [company]
		http.serve({
			[`${PRE_IPO_SERVER_URL}/companies-list`]: {
				updatedAt: valuationDataUpdatedAt,
				data: companies
			}
		})
		const page = await getPreIpoOverviewPageData()

		expect(page.companies).toEqual(companies)
		expect(page.updatedAt).toBe(valuationDataUpdatedAt)
	})

	test('requests every required company snapshot and preserves independent freshness', async () => {
		const page = await getPreIpoCompanyPageData('anthropic')

		expect(page.chart).toBeNull()
		expect(page.integrations).toEqual(integrations)
		expect(page.integrations.perps[0]?.volume).toBe(0)
		expect(page.integrations.perps[0]?.annualizedFundingRate).toBe(0)
		expect(page.valuationDataUpdatedAt).toBe(valuationDataUpdatedAt)
		expect(page.marketDataUpdatedAt).toBe(marketDataUpdatedAt)
	})

	test('rejects the page when any required snapshot fails', async () => {
		http.serve({
			[`${PRE_IPO_SERVER_URL}/integrations?company=anthropic`]: fixtureStatus(404, {
				error: 'integrations unavailable'
			})
		})
		await expect(getPreIpoCompanyPageData('anthropic')).rejects.toThrow('integrations unavailable')
	})
})
