import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/constants', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/constants')>()),
	SKIP_BUILD_STATIC_GENERATION: false
}))

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

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: {
		chainMetadata: {
			arbitrum: { id: 'arbitrum', name: 'Arbitrum One' }
		},
		protocolMetadata: {
			makerdao: { name: 'makerdao', displayName: 'Sky' }
		}
	},
	refreshMetadataIfStale: vi.fn().mockResolvedValue(undefined)
}))

import {
	getLiquidationsProtocolsList,
	getLiquidationsSitemapProtocolChains
} from '~/containers/LiquidationsV2/server/dataset.server'
import * as chainPage from '~/pages/liquidations/[protocol]/[chain]'
import * as protocolPage from '~/pages/liquidations/[protocol]/index'
import * as overviewPage from '~/pages/liquidations/index'

const mockedGetLiquidationsProtocolsList = getLiquidationsProtocolsList as unknown as ReturnType<typeof vi.fn>
const mockedGetLiquidationsSitemapProtocolChains = getLiquidationsSitemapProtocolChains as unknown as ReturnType<
	typeof vi.fn
>

beforeEach(() => {
	vi.clearAllMocks()
	mockedGetLiquidationsProtocolsList.mockResolvedValue({
		protocols: ['makerdao']
	})
	mockedGetLiquidationsSitemapProtocolChains.mockResolvedValue([{ protocolId: 'makerdao', chainIds: ['arbitrum'] }])
})

describe('liquidations SSG routes', () => {
	it('returns minimal shell props for the overview page', async () => {
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

	it('returns minimal shell props for the protocol page', async () => {
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
		expect(mockedGetLiquidationsProtocolsList).toHaveBeenCalledOnce()
	})

	it('returns notFound for an invalid protocol slug', async () => {
		await expect(protocolPage.getStaticProps({ params: { protocol: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	it('returns all protocol paths and enables blocking fallback', async () => {
		await expect(protocolPage.getStaticPaths()).resolves.toEqual({
			paths: [{ params: { protocol: 'makerdao' } }],
			fallback: 'blocking'
		})
	})

	it('returns minimal shell props for the chain page', async () => {
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
		expect(mockedGetLiquidationsSitemapProtocolChains).toHaveBeenCalledOnce()
		expect(mockedGetLiquidationsProtocolsList).not.toHaveBeenCalled()
	})

	it('returns notFound for an invalid chain slug', async () => {
		await expect(
			chainPage.getStaticProps({ params: { protocol: 'sky', chain: 'bad-chain' } } as never)
		).resolves.toEqual({
			notFound: true
		})
	})
})
