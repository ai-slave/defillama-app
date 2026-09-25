import type { GetStaticPropsContext } from 'next'
import { beforeEach, describe, expect, test } from 'vitest'
import { getStaticProps } from '~/pages/equities/[ticker]'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { installEquitiesPageNetwork } from './pageFixture'

const http = installEquitiesPageNetwork()
const metadata = installMetadataSeeder()

function routes(companies: Array<{ ticker: string; country: string }>) {
	metadata.seed({
		equitiesCompanyRoutes: companies,
		equitiesCompanySlugsSet: new Set(companies.map(({ ticker, country }) => `${ticker}:${country}`)),
		emissionsProtocolBySlug: { nvda: 'nvda' }
	})
}

function load(ticker: string) {
	return getStaticProps({ params: { ticker } } as GetStaticPropsContext<{ ticker: string }>)
}

beforeEach(() => routes([{ ticker: 'NVDA', country: 'US' }]))

describe('equities ticker page routing', () => {
	test('loads canonical ticker-country slugs through the real page loader', async () => {
		await expect(load('NVDA:US')).resolves.toMatchObject({
			props: { ticker: 'NVDA', country: 'US', slug: 'NVDA:US', name: 'NVIDIA Corporation', unlocksSlug: 'nvda' },
			revalidate: expect.any(Number)
		})
		expect(http.requests.length).toBeGreaterThan(0)
		for (const { url } of http.requests) {
			expect(url.searchParams.get('ticker')).toBe('NVDA')
			expect(url.searchParams.get('country')).toBe('US')
		}
	})

	test.each([
		['nvda:us', 'NVDA'],
		['brk.a:us', 'BRK.A'],
		['nvda', 'NVDA']
	])('redirects %s to the canonical ticker-country route without loading page data', async (alias, ticker) => {
		routes([{ ticker, country: 'US' }])
		await expect(load(alias)).resolves.toEqual({
			redirect: { destination: `/equities/${ticker}:US`, permanent: false }
		})
		expect(http.requests).toHaveLength(0)
	})

	test('404s a ticker-only alias with two countries instead of choosing one', async () => {
		routes([
			{ ticker: 'META', country: 'US' },
			{ ticker: 'META', country: 'CA' }
		])
		await expect(load('meta')).resolves.toEqual({ notFound: true })
		expect(http.requests).toHaveLength(0)
	})

	test.each(['unknown', 'tsla:us'])('404s unknown %s before loading page data', async (ticker) => {
		await expect(load(ticker)).resolves.toEqual({ notFound: true })
		expect(http.requests).toHaveLength(0)
	})
})
