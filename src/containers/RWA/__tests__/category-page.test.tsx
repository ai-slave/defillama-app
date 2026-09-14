import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockState = {
	categories: ['Treasuries', 'RWA Perps'] as Array<string>,
	overviewData: { assets: [] } as unknown
}

vi.mock('~/constants', () => ({
	SKIP_BUILD_STATIC_GENERATION: false
}))

vi.mock('~/utils/metadata', () => ({
	default: {
		get rwaList() {
			return {
				chains: [],
				categories: mockState.categories,
				platforms: [],
				assetGroups: []
			}
		}
	}
}))

vi.mock('~/containers/RWA', () => ({
	RWAOverview: () => null
}))

vi.mock('~/containers/RWA/queries', () => ({
	getRWAAssetsOverview: vi.fn().mockImplementation(() => Promise.resolve(mockState.overviewData))
}))

vi.mock('~/layout', () => ({
	default: () => null
}))

vi.mock('~/utils/maxAgeForNext', () => ({
	maxAgeForNext: () => 123
}))

vi.mock('~/utils/perf', () => ({
	withPerformanceLogging: (_label: string, fn: any) => fn
}))

import * as page from '~/pages/rwa/category/[category]'

describe('rwa category page', () => {
	beforeEach(() => {
		mockState.categories = ['Treasuries', 'RWA Perps']
		mockState.overviewData = { assets: [] }
	})

	test('omits the RWA Perps category from static paths', async () => {
		mockState.categories = ['Treasuries', 'RWA Perps', 'Private Credit']

		await expect(page.getStaticPaths()).resolves.toEqual({
			paths: [{ params: { category: 'treasuries' } }, { params: { category: 'private-credit' } }],
			fallback: 'blocking'
		})
	})

	test('returns notFound for the RWA Perps category route', async () => {
		await expect(page.getStaticProps({ params: { category: 'rwa-perps' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('redirects noncanonical category params to the canonical slug', async () => {
		await expect(page.getStaticProps({ params: { category: 'Treasuries' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/rwa/category/treasuries',
				permanent: false
			}
		})
	})
})
