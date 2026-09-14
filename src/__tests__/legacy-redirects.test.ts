import { describe, expect, test, vi } from 'vitest'
import { getServerSideProps as getDexRedirectServerSideProps } from '~/pages/dexs/[item]'
import { legacyRedirects } from '~/server/routeRegistry/legacyRedirects'

vi.mock('~/utils/telemetry', () => ({
	withServerSidePropsTelemetry: (_route: string, handler: any) => handler
}))

describe('legacy redirect shims', () => {
	test('encodes dynamic params as a single destination segment', async () => {
		await expect(getDexRedirectServerSideProps({ params: { item: 'foo/bar' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/protocol/dexs/foo%2Fbar',
				permanent: true
			}
		})
	})

	test('returns notFound when the dynamic param is missing', async () => {
		await expect(getDexRedirectServerSideProps({ params: {} } as never)).resolves.toEqual({ notFound: true })
	})
})

describe('legacy redirect table', () => {
	test('has no duplicate sources', () => {
		const sources = legacyRedirects.map((redirect) => redirect.source)
		expect(new Set(sources).size).toBe(sources.length)
	})

	test('redirects renamed chain and unlock slugs to their current routes', () => {
		const bySource = new Map(legacyRedirects.map((redirect) => [redirect.source, redirect.destination]))
		expect(bySource.get('/chain/story')).toBe('/chain/data-network')
		expect(bySource.get('/perps/chain/story')).toBe('/perps/chain/data-network')
		expect(bySource.get('/fees/chain/story')).toBe('/fees/chain/data-network')
		expect(bySource.get('/dexs/chain/story')).toBe('/dexs/chain/data-network')
		expect(bySource.get('/unlocks/story')).toBe('/unlocks/data-network')
		expect(bySource.get('/unlocks/arbitrum')).toBe('/unlocks/arbitrum-foundation')
	})
})
