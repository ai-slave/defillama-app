import type { GetStaticPropsContext } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockState = {
	chains: ['Arbitrum One'] as Array<string>,
	platforms: ['Ondo Finance'] as Array<string>,
	assetGroups: ['US Treasuries'] as Array<string>,
	overviewData: { assets: [{ id: 'asset-1' }] } as unknown
}

vi.mock('~/constants', () => ({
	SKIP_BUILD_STATIC_GENERATION: false
}))

vi.mock('~/utils/metadata', () => ({
	default: {
		get rwaList() {
			return {
				chains: mockState.chains,
				categories: [],
				platforms: mockState.platforms,
				assetGroups: mockState.assetGroups
			}
		},
		get rwaPlatformsIndex() {
			return { generatedAt: 1, byPid: {}, platforms: {} }
		}
	}
}))

vi.mock('~/containers/RWA', () => ({
	RWAOverview: () => null
}))

vi.mock('~/containers/RWA/queries', () => ({
	getRWAAssetsOverview: vi.fn().mockImplementation(() => Promise.resolve(mockState.overviewData))
}))

vi.mock('~/containers/RWA/TabNav', () => ({
	RWATabNav: () => null
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

import * as assetGroupPage from '~/pages/rwa/asset-group/[assetGroup]'
import * as chainPage from '~/pages/rwa/chain/[chain]'
import * as platformPage from '~/pages/rwa/platform/[platform]'

describe('rwa group route canonical redirects', () => {
	beforeEach(() => {
		mockState.chains = ['Arbitrum One']
		mockState.platforms = ['Ondo Finance']
		mockState.assetGroups = ['US Treasuries']
		mockState.overviewData = { assets: [{ id: 'asset-1' }] }
	})

	test('redirects noncanonical asset group params to the canonical slug', async () => {
		await expect(
			assetGroupPage.getStaticProps({
				params: { assetGroup: 'US Treasuries' }
			} as never)
		).resolves.toEqual({
			redirect: {
				destination: '/rwa/asset-group/us-treasuries',
				permanent: false
			}
		})
	})

	test('redirects noncanonical chain params to the canonical slug', async () => {
		await expect(chainPage.getStaticProps({ params: { chain: 'Arbitrum One' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/rwa/chain/arbitrum-one',
				permanent: false
			}
		})
	})

	test('redirects noncanonical platform params to the canonical slug', async () => {
		await expect(
			platformPage.getStaticProps({
				params: { platform: 'Ondo Finance' }
			} as never)
		).resolves.toEqual({
			redirect: {
				destination: '/rwa/platform/ondo-finance',
				permanent: false
			}
		})
	})

	test('keeps the legacy platform page when the platform metadata is absent', async () => {
		const context: GetStaticPropsContext<{ platform: string }> = {
			params: { platform: 'ondo-finance' }
		}
		await expect(platformPage.getStaticProps(context)).resolves.toEqual({
			props: {
				assets: [{ id: 'asset-1' }],
				platformName: 'Ondo Finance',
				platformPage: null
			},
			revalidate: 123
		})
	})
})
