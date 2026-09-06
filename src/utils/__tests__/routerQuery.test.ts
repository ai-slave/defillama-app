import type { NextRouter } from 'next/router'
import { describe, expect, test, vi } from 'vitest'
import { pushShallowQuery } from '../routerQuery'

function createRouter(pathname: string, asPath: string, query: NextRouter['query']): NextRouter {
	return {
		pathname,
		asPath,
		query,
		push: vi.fn().mockResolvedValue(true)
	} as unknown as NextRouter
}

describe('pushShallowQuery', () => {
	test('omits a dynamic segment after resolving the current pathname', async () => {
		const router = createRouter('/equities/[ticker]', '/equities/AAPL:US', {
			ticker: 'AAPL:US',
			tab: 'overview'
		})

		await pushShallowQuery(router, { 'financials-table': 'balance-sheet' })

		expect(router.push).toHaveBeenCalledWith(
			{
				pathname: '/equities/AAPL:US',
				query: { tab: 'overview', 'financials-table': 'balance-sheet' }
			},
			undefined,
			{ shallow: true }
		)
	})

	test('omits every segment from a resolved multi-segment route', async () => {
		const router = createRouter('/liquidations/[protocol]/[chain]', '/liquidations/aave/ethereum', {
			protocol: 'aave',
			chain: 'ethereum'
		})

		await pushShallowQuery(router, { metric: 'usd' })

		expect(router.push).toHaveBeenCalledWith(
			{
				pathname: '/liquidations/aave/ethereum',
				query: { metric: 'usd' }
			},
			undefined,
			{ shallow: true }
		)
	})

	test('keeps dynamic segments when a route template needs them for interpolation', async () => {
		const router = createRouter('/yields/pool/[pool]', '/yields/pool/ethereum-aave', {
			pool: 'ethereum-aave',
			range: '1y'
		})

		await pushShallowQuery(router, { holderMode: 'balance' }, router.pathname)

		expect(router.push).toHaveBeenCalledWith(
			{
				pathname: '/yields/pool/[pool]',
				query: { pool: 'ethereum-aave', range: '1y', holderMode: 'balance' }
			},
			undefined,
			{ shallow: true }
		)
	})

	test('preserves query state on static routes', async () => {
		const router = createRouter('/equities', '/equities', { rankBy: 'market-cap' })

		await pushShallowQuery(router, { view: 'treemap' })

		expect(router.push).toHaveBeenCalledWith(
			{
				pathname: '/equities',
				query: { rankBy: 'market-cap', view: 'treemap' }
			},
			undefined,
			{ shallow: true }
		)
	})

	test('omits catch-all segment arrays from resolved paths', async () => {
		const router = createRouter('/research/[[...slug]]', '/research/defi/stablecoins', {
			slug: ['defi', 'stablecoins']
		})

		await pushShallowQuery(router, { preview: true })

		expect(router.push).toHaveBeenCalledWith(
			{
				pathname: '/research/defi/stablecoins',
				query: { preview: true }
			},
			undefined,
			{ shallow: true }
		)
	})
})
