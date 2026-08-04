import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchDashboardConfigMock, llamaQueryMock, requireSubscriptionMock } = vi.hoisted(() => ({
	fetchDashboardConfigMock: vi.fn(),
	llamaQueryMock: vi.fn(),
	requireSubscriptionMock: vi.fn()
}))

vi.mock('~/server/db/llama', () => ({ llamaDb: { query: llamaQueryMock } }))
vi.mock('~/server/api/requireSubscription', () => ({ requireSubscription: requireSubscriptionMock }))
vi.mock('~/containers/ProDashboard/queries.server', () => ({ fetchDashboardConfig: fetchDashboardConfigMock }))
vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler
}))

import { parseTokenUsageQuery, publicDashboardTokenUsageHandler, tokenUsageApiHandler } from './tokenUsageRoute'

beforeEach(() => {
	llamaQueryMock.mockReset()
	requireSubscriptionMock.mockReset()
	fetchDashboardConfigMock.mockReset()
})

describe('/api/public/pro-dashboard/dashboard-token-usage', () => {
	it('allows only the exact Token Usage capability saved in a public dashboard', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			visibility: 'public',
			data: {
				items: [
					{
						id: 'token-usage',
						kind: 'dataset-table',
						datasetType: 'token-usage',
						tokenSymbols: ['USDC', 'USDT'],
						includeCex: false
					}
				]
			}
		})
		llamaQueryMock.mockResolvedValue([])
		const req = createMockNextApiRequest({
			method: 'GET',
			query: {
				dashboardId: 'public-dashboard',
				'symbols[]': ['USDT', 'USDC'],
				includeCex: 'false'
			}
		})
		const res = createMockNextApiResponse()

		await publicDashboardTokenUsageHandler(req, res)

		expect(fetchDashboardConfigMock).toHaveBeenCalledWith('public-dashboard', null)
		expect(llamaQueryMock).toHaveBeenCalledOnce()
		expect(res.setHeader).toHaveBeenLastCalledWith('Cache-Control', 'public, max-age=300')
		expect(res.status).toHaveBeenCalledWith(200)
	})

	it('rejects arbitrary symbols that are not configured by the public dashboard', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			visibility: 'public',
			data: {
				items: [
					{
						id: 'token-usage',
						kind: 'dataset-table',
						datasetType: 'token-usage',
						tokenSymbols: ['USDC'],
						includeCex: false
					}
				]
			}
		})
		const req = createMockNextApiRequest({
			method: 'GET',
			query: { dashboardId: 'public-dashboard', 'symbols[]': 'USDT', includeCex: 'true' }
		})
		const res = createMockNextApiResponse()

		await publicDashboardTokenUsageHandler(req, res)

		expect(llamaQueryMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
	})

	it('does not turn a private dashboard config into an anonymous capability', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			visibility: 'private',
			data: {
				items: [
					{
						id: 'token-usage',
						kind: 'dataset-table',
						datasetType: 'token-usage',
						tokenSymbols: ['USDC'],
						includeCex: false
					}
				]
			}
		})
		const req = createMockNextApiRequest({
			method: 'GET',
			query: { dashboardId: 'private-dashboard', 'symbols[]': 'USDC', includeCex: 'false' }
		})
		const res = createMockNextApiResponse()

		await publicDashboardTokenUsageHandler(req, res)

		expect(llamaQueryMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(403)
	})
})

describe('parseTokenUsageQuery', () => {
	it('normalizes symbols and parses the CEX policy once at the Lens boundary', () => {
		expect(
			parseTokenUsageQuery({
				'symbols[]': [' usdc ', 'USDC', 'usdt'],
				includeCex: 'true'
			})
		).toEqual({ tokenSymbols: ['USDC', 'USDT'], includeCex: true })
	})

	it('rejects missing symbols and ambiguous boolean values', () => {
		expect(parseTokenUsageQuery({ includeCex: 'false' })).toBeNull()
		expect(parseTokenUsageQuery({ 'symbols[]': 'USDC', includeCex: ['true', 'false'] })).toBeNull()
		expect(parseTokenUsageQuery({ 'symbols[]': 'USDC', includeCex: '1' })).toBeNull()
	})
})

describe('/api/dynamic/pro-dashboard/token-usage', () => {
	it('rejects an anonymous arbitrary query before touching the warehouse', async () => {
		requireSubscriptionMock.mockImplementation(async (_header, res) => {
			res.status(401).json({ error: 'Authentication required' })
			return null
		})
		const req = createMockNextApiRequest({
			method: 'GET',
			query: { 'symbols[]': 'USDC', includeCex: 'true' }
		})
		const res = createMockNextApiResponse()

		await tokenUsageApiHandler(req, res)

		expect(requireSubscriptionMock).toHaveBeenCalledWith(undefined, res)
		expect(llamaQueryMock).not.toHaveBeenCalled()
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(401)
	})

	it('serves a valid request only after subscription validation', async () => {
		requireSubscriptionMock.mockResolvedValue({ valid: true })
		llamaQueryMock.mockResolvedValue([])
		const req = createMockNextApiRequest({
			method: 'GET',
			query: { 'symbols[]': 'USDC', includeCex: 'false' },
			headers: { authorization: 'Bearer pro-token' }
		})
		const res = createMockNextApiResponse()

		await tokenUsageApiHandler(req, res)

		expect(requireSubscriptionMock).toHaveBeenCalledWith('Bearer pro-token', res)
		expect(llamaQueryMock).toHaveBeenCalledOnce()
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([])
	})
})
