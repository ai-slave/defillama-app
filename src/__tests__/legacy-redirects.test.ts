import { describe, expect, test } from 'vitest'
import { filterRwaPerpsRows, getRwaPerpsFilterDefinitions } from '~/containers/RWA/perpsFilters'
import { perpsAsset } from '~/containers/RWA/table/__tests__/fixtures'
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
	const destinationOf = (source: string) => {
		const destination = legacyRedirects.find((redirect) => redirect.source === source)!.destination
		return new URL(destination, 'https://defillama.com').searchParams
	}

	test('the asset and asset group list pages open the Perps overview under a Group by it reads', () => {
		for (const source of ['/rwa/perps/assets', '/rwa/perps/asset-groups']) {
			const groupBy = destinationOf(source).get('groupBy')
			expect(parseRwaGroupBy(groupBy ?? undefined, 'perpsOverview')).toBe(groupBy)
		}
	})

	test('the forex page opens the Perps overview narrowed to its forex markets', () => {
		const query = Object.fromEntries(destinationOf('/rwa/perps/forex'))
		const rows = [
			perpsAsset({ id: 'eur-usd', assetClass: ['Forex Perps'] }),
			perpsAsset({ id: 'gold', assetClass: ['Commodity Perp'] })
		]
		const definitions = getRwaPerpsFilterDefinitions(rows, 'perpsOverview', query)
		expect(filterRwaPerpsRows(rows, query, definitions).map((row) => row.id)).toEqual(['eur-usd'])
	})
})
