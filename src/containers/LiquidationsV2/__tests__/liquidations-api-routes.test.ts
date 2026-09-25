import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

const {
	getLiquidationsOverviewPageDataMock,
	getLiquidationsProtocolPageDataMock,
	getLiquidationsChainPageDataMock,
	getTokenLiquidationsSectionDataMock
} = vi.hoisted(() => ({
	getLiquidationsOverviewPageDataMock: vi.fn(),
	getLiquidationsProtocolPageDataMock: vi.fn(),
	getLiquidationsChainPageDataMock: vi.fn(),
	getTokenLiquidationsSectionDataMock: vi.fn()
}))

vi.mock('~/containers/LiquidationsV2/server/dataset.server', () => ({
	getLiquidationsOverviewPageData: getLiquidationsOverviewPageDataMock,
	getLiquidationsProtocolPageData: getLiquidationsProtocolPageDataMock,
	getLiquidationsChainPageData: getLiquidationsChainPageDataMock,
	getTokenLiquidationsSectionData: getTokenLiquidationsSectionDataMock
}))

import { AUTH_SERVER, POCKETBASE_URL } from '~/constants'
import chainHandler from '~/pages/api/private/liquidations/[protocol]/[chain]'
import protocolHandler from '~/pages/api/private/liquidations/[protocol]/index'
import overviewHandler from '~/pages/api/private/liquidations/index'
import tokenHandler from '~/pages/api/private/token-liquidations/[symbol]'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
const { serve } = installFixtureFetch()
const { seed } = installMetadataSeeder()

const mockedGetLiquidationsOverviewPageData = vi.mocked(getLiquidationsOverviewPageDataMock)
const mockedGetLiquidationsProtocolPageData = vi.mocked(getLiquidationsProtocolPageDataMock)
const mockedGetLiquidationsChainPageData = vi.mocked(getLiquidationsChainPageDataMock)
const mockedGetTokenLiquidationsSectionData = vi.mocked(getTokenLiquidationsSectionDataMock)

beforeEach(() => {
	vi.resetAllMocks()
	seed({
		chainMetadata: { arbitrum: { name: 'Arbitrum One', id: 'arbitrum' } },
		protocolMetadata: { sky: { displayName: 'Sky', name: 'sky' } },
		liquidationsTokenSymbolsSet: new Set(['wstETH'])
	})
	serve({
		[`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'active' } },
		[`${POCKETBASE_URL}/api/collections/users/auth-refresh`]: {}
	})
})

describe('liquidations api routes', () => {
	test('returns 405 for non-GET overview requests', async () => {
		const req = { method: 'POST', headers: {} } as NextApiRequest
		const res = createMockNextApiResponse()

		await overviewHandler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET'])
		expect(res.statusCode).toBe(405)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Method Not Allowed' })
	})

	test.each([
		['protocol', protocolHandler, {}, 'Missing protocol parameter'],
		['chain', chainHandler, { protocol: 'sky' }, 'Missing protocol or chain parameter'],
		['token', tokenHandler, {}, 'Missing symbol parameter']
	] as const)('returns 400 for missing %s route params before auth', async (_route, handler, query, error) => {
		const req = { method: 'GET', headers: {}, query } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error })
	})

	test('returns 403 for unauthorized protocol requests', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer bad' },
			query: { protocol: 'sky' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()
		serve({ [`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'inactive' } } })

		await protocolHandler(req, res)

		expect(res.statusCode).toBe(403)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Active subscription required' })
	})

	test('lets one snapshot-backed builder resolve protocol routes', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { protocol: 'unknown' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()
		mockedGetLiquidationsProtocolPageData.mockResolvedValue(null)

		await protocolHandler(req, res)

		expect(res.statusCode).toBe(404)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Liquidations protocol not found' })
	})

	test('serves overview data privately to a subscriber', async () => {
		const req = { method: 'GET', headers: { authorization: 'Bearer ok' }, query: {} } as unknown as NextApiRequest
		const res = createMockNextApiResponse()
		mockedGetLiquidationsOverviewPageData.mockResolvedValue({
			protocolLinks: [{ label: 'Overview', to: '/liquidations' }],
			timestamp: 1,
			protocolCount: 1,
			chainCount: 1,
			positionCount: 1,
			totalCollateralUsd: 100,
			distributionChart: { tokens: [] },
			protocolRows: [],
			chainRows: []
		})

		await overviewHandler(req, res)

		expect(res.statusCode).toBe(200)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
	})

	test('serves chain data privately to a subscriber', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { protocol: 'sky', chain: 'arbitrum-one' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()
		mockedGetLiquidationsChainPageData.mockResolvedValue({
			protocolLinks: [{ label: 'Overview', to: '/liquidations' }],
			chainLinks: [{ label: 'All Chains', to: '/liquidations/sky' }],
			protocolId: 'maker',
			protocolName: 'Sky',
			protocolSlug: 'sky',
			chainId: 'arbitrum',
			chainName: 'Arbitrum One',
			chainSlug: 'arbitrum-one',
			timestamp: 1,
			positionCount: 1,
			collateralCount: 1,
			totalCollateralUsd: 100,
			distributionChart: { tokens: [] },
			chainRows: [],
			ownerBlockExplorers: [],
			positions: []
		})

		await chainHandler(req, res)

		expect(res.statusCode).toBe(200)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
	})

	test('serves token liquidations privately to a subscriber', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { symbol: 'wstETH' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()
		mockedGetTokenLiquidationsSectionData.mockResolvedValue({
			tokenSymbol: 'wstETH',
			timestamp: 1,
			positionCount: 2,
			protocolCount: 2,
			chainCount: 1,
			totalCollateralUsd: 100,
			distributionChart: { tokens: [] },
			protocolRows: [],
			chainRows: []
		})

		await tokenHandler(req, res)

		expect(res.statusCode).toBe(200)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
	})

	test('returns 404 when a listed token has no liquidations snapshot', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { symbol: 'wstETH' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()
		mockedGetTokenLiquidationsSectionData.mockResolvedValue(null)

		await tokenHandler(req, res)

		expect(res.statusCode).toBe(404)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Token liquidations not found' })
	})

	test('does not substitute a differently cased token symbol', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { symbol: 'wsteth' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()
		// The builder would answer any symbol; only the exact-case symbol list may reject this one.
		mockedGetTokenLiquidationsSectionData.mockResolvedValue({
			tokenSymbol: 'wstETH',
			timestamp: 1,
			positionCount: 2,
			protocolCount: 2,
			chainCount: 1,
			totalCollateralUsd: 100,
			distributionChart: { tokens: [] },
			protocolRows: [],
			chainRows: []
		})

		await tokenHandler(req, res)

		expect(res.statusCode).toBe(404)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Token liquidations not found' })
	})

	test.each([
		['overview', overviewHandler, {}, 'Failed to fetch liquidations overview data'],
		['protocol', protocolHandler, { protocol: 'sky' }, 'Failed to fetch liquidations protocol data'],
		['chain', chainHandler, { protocol: 'sky', chain: 'arbitrum-one' }, 'Failed to fetch liquidations chain data'],
		['token', tokenHandler, { symbol: 'wsteth' }, 'Failed to fetch token liquidations data']
	] as const)('returns a 500 json error when %s auth validation throws', async (_route, handler, query, error) => {
		const req = { method: 'GET', headers: { authorization: 'Bearer bad' }, query } as unknown as NextApiRequest
		const res = createMockNextApiResponse()
		serve({
			[`${AUTH_SERVER}/subscription/status`]: () => {
				throw new Error('Auth service unavailable')
			}
		})

		await handler(req, res)

		expect(res.statusCode).toBe(500)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error })
	})
})
