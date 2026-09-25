import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

// Constants read the env at import time; build-time path generation is off unless this is false.
const originalSkip = vi.hoisted(() => {
	const value = process.env.SKIP_BUILD_STATIC_GENERATION
	process.env.SKIP_BUILD_STATIC_GENERATION = 'false'
	return value
})
afterAll(() => {
	if (originalSkip === undefined) delete process.env.SKIP_BUILD_STATIC_GENERATION
	else process.env.SKIP_BUILD_STATIC_GENERATION = originalSkip
})

vi.mock('~/layout', () => ({
	default: () => null
}))

vi.mock('~/containers/LiquidationsV2/RouteContent', () => ({
	LiquidationsOverviewRouteContent: () => null,
	LiquidationsProtocolRouteContent: () => null,
	LiquidationsChainRouteContent: () => null
}))

vi.mock('~/containers/LiquidationsV2/server/dataset.server', () => ({
	getLiquidationsProtocolsList: vi.fn(),
	getLiquidationsSitemapProtocolChains: vi.fn()
}))

import {
	getLiquidationsProtocolsList,
	getLiquidationsSitemapProtocolChains
} from '~/containers/LiquidationsV2/server/dataset.server'
import * as chainPage from '~/pages/liquidations/[protocol]/[chain]'
import * as protocolPage from '~/pages/liquidations/[protocol]/index'
import * as overviewPage from '~/pages/liquidations/index'
import { installMetadataSeeder } from '~/utils/test/metadataCache'

const { seed } = installMetadataSeeder()

const mockedGetLiquidationsProtocolsList = getLiquidationsProtocolsList as unknown as ReturnType<typeof vi.fn>
const mockedGetLiquidationsSitemapProtocolChains = getLiquidationsSitemapProtocolChains as unknown as ReturnType<
	typeof vi.fn
>

beforeEach(() => {
	seed({
		chainMetadata: { arbitrum: { id: 'arbitrum', name: 'Arbitrum One' } },
		protocolMetadata: { makerdao: { name: 'makerdao', displayName: 'Sky' } }
	} as never)
	mockedGetLiquidationsProtocolsList.mockResolvedValue({
		protocols: ['makerdao']
	})
	mockedGetLiquidationsSitemapProtocolChains.mockResolvedValue([{ protocolId: 'makerdao', chainIds: ['arbitrum'] }])
})

describe('liquidations SSG routes', () => {
	test('returns minimal shell props for the overview page', async () => {
		await expect(overviewPage.getStaticProps({} as never)).resolves.toEqual(
			expect.objectContaining({
				props: expect.objectContaining({
					protocolLinks: [
						{ label: 'Overview', to: '/liquidations' },
						{ label: 'Sky', to: '/liquidations/makerdao' }
					]
				})
			})
		)
	})

	test('returns minimal shell props for the protocol page', async () => {
		await expect(protocolPage.getStaticProps({ params: { protocol: 'sky' } } as never)).resolves.toEqual(
			expect.objectContaining({
				props: {
					protocolName: 'Sky',
					protocolSlug: 'makerdao',
					protocolLinks: [
						{ label: 'Overview', to: '/liquidations' },
						{ label: 'Sky', to: '/liquidations/makerdao' }
					],
					chainLinks: [{ label: 'All Chains', to: '/liquidations/makerdao' }]
				}
			})
		)
	})

	test('returns notFound for an invalid protocol slug', async () => {
		await expect(protocolPage.getStaticProps({ params: { protocol: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('returns all protocol paths and enables blocking fallback', async () => {
		await expect(protocolPage.getStaticPaths()).resolves.toEqual({
			paths: [{ params: { protocol: 'makerdao' } }],
			fallback: 'blocking'
		})
	})

	test('returns minimal shell props for the chain page', async () => {
		await expect(
			chainPage.getStaticProps({ params: { protocol: 'sky', chain: 'arbitrum-one' } } as never)
		).resolves.toEqual(
			expect.objectContaining({
				props: {
					protocolName: 'Sky',
					protocolSlug: 'makerdao',
					chainName: 'Arbitrum One',
					chainSlug: 'arbitrum',
					protocolLinks: [
						{ label: 'Overview', to: '/liquidations' },
						{ label: 'Sky', to: '/liquidations/makerdao' }
					],
					chainLinks: [
						{ label: 'All Chains', to: '/liquidations/makerdao' },
						{ label: 'Arbitrum One', to: '/liquidations/makerdao/arbitrum' }
					]
				}
			})
		)
	})

	test('returns notFound for an invalid chain slug', async () => {
		await expect(
			chainPage.getStaticProps({ params: { protocol: 'sky', chain: 'bad-chain' } } as never)
		).resolves.toEqual({
			notFound: true
		})
	})
})
