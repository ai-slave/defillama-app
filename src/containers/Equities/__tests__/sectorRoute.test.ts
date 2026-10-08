import type { GetStaticPropsContext } from 'next'
import { isSerializableProps } from 'next/dist/lib/is-serializable-props'
import { beforeEach, expect, test, vi } from 'vitest'
import { EQUITIES_SERVER_URL } from '~/constants'
import { getStaticProps } from '~/pages/equities/sectors/[sector]'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { readEquitiesSectorPageCompanies, type IEquitiesSectorPageViewData } from '../sectorPageData'

const http = installFixtureFetch()

function load(sector: string) {
	return getStaticProps({ params: { sector } } as GetStaticPropsContext<{ sector: string }>)
}

beforeEach(() => {
	vi.stubEnv('REDIS_URL', '')
	http.serve({
		[`${EQUITIES_SERVER_URL}/sector`]: { sector: 'Technology', sectorSlug: 'technology' },
		[`${EQUITIES_SERVER_URL}/sectors-overview`]: {},
		[`${EQUITIES_SERVER_URL}/industries`]: [],
		[`${EQUITIES_SERVER_URL}/companies`]: [
			{
				ticker: 'AAPL',
				country: 'US',
				name: 'Apple Inc.',
				industry: 'Consumer Electronics',
				marketCap: 3_000_000_000_000,
				volume: 1,
				currentPrice: 200,
				priceChangePercentage1d: 1,
				priceChangePercentage7d: 2,
				priceChangePercentage1m: 3,
				trailingPE: 30
			}
		]
	})
})

test('404s an unknown sector without loading upstream data', async () => {
	await expect(load('not-a-sector')).resolves.toEqual({ notFound: true })
	expect(http.requests).toHaveLength(0)
})

test('redirects mixed-case sectors to their canonical URL', async () => {
	await expect(load('Technology')).resolves.toEqual({
		redirect: { destination: '/equities/sectors/technology', permanent: false }
	})
	expect(http.requests).toHaveLength(0)
})

test('serializes a company whose upstream industry slug is missing', async () => {
	const result = await load('technology')
	const { props } = result as { props: { state: { status: string; data: IEquitiesSectorPageViewData } } }
	expect(props.state.status).toBe('ready')
	expect(readEquitiesSectorPageCompanies(props.state.data.companies)).toMatchObject([
		{ ticker: 'AAPL', name: 'Apple Inc.', industry: 'Consumer Electronics', industrySlug: 'consumer-electronics' }
	])
	// Next runs this check on every getStaticProps result and fails the build on undefined.
	expect(isSerializableProps('/equities/sectors/[sector]', 'getStaticProps', props)).toBe(true)
})
