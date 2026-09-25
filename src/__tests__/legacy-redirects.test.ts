import { describe, expect, test } from 'vitest'
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
