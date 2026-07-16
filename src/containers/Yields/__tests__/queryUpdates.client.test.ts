import type { NextRouter } from 'next/router'
import { describe, expect, it, vi } from 'vitest'
import { pushYieldsQuery } from '../queryUpdates.client'

function router(pathname: string, query: NextRouter['query']): NextRouter {
	return {
		pathname,
		query,
		push: vi.fn().mockResolvedValue(true)
	} as unknown as NextRouter
}

describe('pushYieldsQuery', () => {
	it('preserves table page state for pagination updates', async () => {
		const testRouter = router('/yields/loop', {
			page: '3',
			pageSize: '50',
			token: 'ETH'
		})

		await pushYieldsQuery(testRouter, { page: '4' }, { resetPage: false })

		expect(testRouter.push).toHaveBeenCalledWith(
			{
				pathname: '/yields/loop',
				query: {
					page: '4',
					pageSize: '50',
					token: 'ETH'
				}
			},
			undefined,
			{ shallow: true }
		)
	})

	it('does not clear page on non-yields routes', async () => {
		const testRouter = router('/borrow', {
			page: '3',
			chain: 'Ethereum'
		})

		await pushYieldsQuery(testRouter, { chain: 'Base' })

		expect(testRouter.push).toHaveBeenCalledWith(
			{
				pathname: '/borrow',
				query: {
					page: '3',
					chain: 'Base'
				}
			},
			undefined,
			{ shallow: true }
		)
	})
})
