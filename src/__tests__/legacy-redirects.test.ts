import { describe, expect, test } from 'vitest'
import { parseRwaGroupBy } from '~/containers/RWA/table/groupBy'
import { getServerSideProps as getDexRedirectServerSideProps } from '~/pages/dexs/[item]'
import { legacyRedirects } from '~/server/routeRegistry/legacyRedirects'

describe('legacy redirect shims', () => {
	test('encodes dynamic params as a single destination segment', async () => {
		await expect(
			getDexRedirectServerSideProps({
				params: { item: 'foo/bar' },
				req: { method: 'GET' },
				resolvedUrl: '/dexs/foo%2Fbar'
			} as never)
		).resolves.toEqual({
			redirect: {
				destination: '/protocol/dexs/foo%2Fbar',
				permanent: true
			}
		})
	})

	test('returns notFound when the dynamic param is missing', async () => {
		await expect(
			getDexRedirectServerSideProps({ params: {}, req: { method: 'GET' }, resolvedUrl: '/dexs/' } as never)
		).resolves.toEqual({ notFound: true })
	})
})

describe('legacy redirect table', () => {
	test('has no duplicate sources', () => {
		const sources = legacyRedirects.map((redirect) => redirect.source)
		expect(new Set(sources).size).toBe(sources.length)
	})
})

describe('the perps mini-site redirects', () => {
	const destinationOf = (source: string) => legacyRedirects.find((redirect) => redirect.source === source)?.destination

	test('the three list pages open the Perps overview with their Group by', () => {
		// Venue is the platform Group by on perps rows and the Perps overview's default, so the URL carries none.
		expect(destinationOf('/rwa/perps/venues')).toBe('/rwa/perps')
		expect(destinationOf('/rwa/perps/assets')).toBe('/rwa/perps?groupBy=asset')
		expect(destinationOf('/rwa/perps/asset-groups')).toBe('/rwa/perps?groupBy=assetGroup')
		for (const source of ['/rwa/perps/assets', '/rwa/perps/asset-groups']) {
			const groupBy = new URL(destinationOf(source)!, 'https://defillama.com').searchParams.get('groupBy')
			expect(parseRwaGroupBy(groupBy ?? undefined, 'perpsOverview')).toBe(groupBy)
		}
	})

	test('the forex page opens the Perps overview filtered to the forex asset class', () => {
		const destination = new URL(destinationOf('/rwa/perps/forex')!, 'https://defillama.com')
		expect(destination.pathname).toBe('/rwa/perps')
		expect(destination.searchParams.getAll('assetClasses')).toEqual(['Forex Perps'])
	})
})
