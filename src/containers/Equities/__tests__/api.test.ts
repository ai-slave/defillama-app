import { beforeEach, describe, expect, test } from 'vitest'
import { EQUITIES_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
const http = installFixtureFetch()
beforeEach(() => http.serve({ [EQUITIES_SERVER_URL]: null }))

describe('equities api urls', () => {
	test('adds ticker and country to ticker-specific endpoints', async () => {
		const api = await import('../api')

		await api.fetchEquitiesSummary('AAPL', 'US')
		await api.fetchEquitiesMetadata('AAPL', 'US')
		await api.fetchEquitiesPriceHistory('AAPL', 'US', '1M')
		await api.fetchEquitiesStatements('AAPL', 'US')
		await api.fetchEquitiesDimensions('AAPL', 'US')
		await api.fetchEquitiesFilings('AAPL', 'US')

		const paths = ['/summary', '/metadata', '/price-history', '/statements', '/dimensions', '/filings']
		for (let index = 0; index < paths.length; index++) {
			const url = http.requests[index].url
			expect(url.pathname).toBe(`/equities/v1${paths[index]}`)
			expect(url.searchParams.get('ticker')).toBe('AAPL')
			expect(url.searchParams.get('country')).toBe('US')
		}
		expect(http.requests[2].url.searchParams.get('timeframe')).toBe('1M')
	})

	test('adds canonical ticker and country to the on-chain endpoint', async () => {
		const api = await import('../api')

		await api.fetchEquitiesOnchain('AAPL', 'US')

		const onchainUrl = http.requests[0].url
		expect(onchainUrl.pathname).toBe('/equities/v1/onchain')
		expect(onchainUrl.searchParams.get('ticker')).toBe('AAPL')
		expect(onchainUrl.searchParams.get('country')).toBe('US')
	})

	test('keeps companies as a list request', async () => {
		const api = await import('../api')

		await api.fetchEquitiesCompanies()

		const url = http.requests[0].url
		expect(url.pathname).toBe('/equities/v1/companies')
		expect(url.searchParams.get('countries')).toBe('US')
		expect(url.searchParams.has('ticker')).toBe(false)
		expect(url.searchParams.has('country')).toBe(false)
	})

	test('keeps companies-list as a lightweight list request', async () => {
		const api = await import('../api')

		await api.fetchEquitiesCompaniesList()

		const url = http.requests[0].url
		expect(url.pathname).toBe('/equities/v1/companies-list')
		expect(url.searchParams.get('countries')).toBe('US')
		expect(url.searchParams.has('ticker')).toBe(false)
		expect(url.searchParams.has('country')).toBe(false)
	})
})
