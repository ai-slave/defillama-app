import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

const { llamaQuery, validateSubscription } = vi.hoisted(() => ({
	llamaQuery: vi.fn(),
	validateSubscription: vi.fn()
}))
vi.mock('~/server/db/llama', () => ({ llamaDb: { query: llamaQuery } }))
vi.mock('~/utils/apiAuth', () => ({ validateSubscription }))

import { parseTokenUsageQuery, publicDashboardTokenUsageHandler, tokenUsageApiHandler } from '../tokenUsageRoute'

const http = installFixtureFetch()

const usageRows = [
	{ protocol: 'aave', name: 'Aave', category: 'lending', symbol: 'USDC', amount_usd: 10 },
	{ protocol: 'aave', name: 'Aave', category: 'lending', symbol: 'USDT', amount_usd: 5 }
]
const aaveUsage = {
	name: 'Aave',
	category: 'Lending',
	amountUsd: 15,
	logo: expect.stringContaining('aave'),
	tokens: { USDC: 10, USDT: 5 }
}

function serveDashboard(visibility: 'public' | 'private', tokenSymbols: Array<string>) {
	http.serve({
		'/dashboards/saved': {
			id: 'saved',
			created: '2026-01-01T00:00:00Z',
			updated: '2026-01-01T00:00:00Z',
			visibility,
			data: {
				items: [{ id: 'usage', kind: 'dataset-table', datasetType: 'token-usage', tokenSymbols, includeCex: false }]
			}
		}
	})
}

function publicRequest(symbols: string | Array<string>, includeCex: string) {
	return createMockNextApiRequest({
		method: 'GET',
		query: { dashboardId: 'saved', 'symbols[]': symbols, includeCex }
	})
}

beforeEach(() => {
	llamaQuery.mockReset().mockResolvedValue(usageRows)
	validateSubscription.mockReset()
})

describe('/api/public/pro-dashboard/dashboard-token-usage', () => {
	test('serves the exact Token Usage query saved in a public dashboard, publicly cached', async () => {
		serveDashboard('public', ['USDC', 'USDT'])
		const res = createMockNextApiResponse()

		await publicDashboardTokenUsageHandler(publicRequest(['USDT', 'USDC'], 'false'), res)

		expect(res.setHeader).toHaveBeenLastCalledWith('Cache-Control', 'public, max-age=300')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([aaveUsage])
	})

	test('rejects symbols or CEX policy the public dashboard did not save', async () => {
		serveDashboard('public', ['USDC'])
		const res = createMockNextApiResponse()

		await publicDashboardTokenUsageHandler(publicRequest('USDT', 'true'), res)

		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(llamaQuery).not.toHaveBeenCalled()
	})

	test('does not turn a private dashboard config into an anonymous capability', async () => {
		serveDashboard('private', ['USDC'])
		const res = createMockNextApiResponse()

		await publicDashboardTokenUsageHandler(publicRequest('USDC', 'false'), res)

		expect(res.status).toHaveBeenCalledWith(403)
		expect(llamaQuery).not.toHaveBeenCalled()
	})
})

describe('parseTokenUsageQuery', () => {
	test('normalizes symbols and parses the CEX policy', () => {
		expect(parseTokenUsageQuery({ 'symbols[]': [' usdc ', 'USDC', 'usdt'], includeCex: 'true' })).toEqual({
			tokenSymbols: ['USDC', 'USDT'],
			includeCex: true
		})
	})

	test('rejects missing symbols and ambiguous boolean values', () => {
		expect(parseTokenUsageQuery({ includeCex: 'false' })).toBeNull()
		expect(parseTokenUsageQuery({ 'symbols[]': 'USDC', includeCex: ['true', 'false'] })).toBeNull()
		expect(parseTokenUsageQuery({ 'symbols[]': 'USDC', includeCex: '1' })).toBeNull()
	})
})

describe('/api/dynamic/pro-dashboard/token-usage', () => {
	beforeEach(() => {
		validateSubscription.mockImplementation(async (header: string | undefined) =>
			header === 'Bearer pro-token' ? { valid: true } : { valid: false, status: 401, error: 'Authentication required' }
		)
	})

	test('rejects an anonymous arbitrary query', async () => {
		const res = createMockNextApiResponse()

		await tokenUsageApiHandler(
			createMockNextApiRequest({ method: 'GET', query: { 'symbols[]': 'USDC', includeCex: 'true' } }),
			res
		)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(401)
		expect(llamaQuery).not.toHaveBeenCalled()
	})

	test('serves protocols summed across the requested tokens for a subscribed caller', async () => {
		const res = createMockNextApiResponse()

		await tokenUsageApiHandler(
			createMockNextApiRequest({
				method: 'GET',
				query: { 'symbols[]': ['USDC', 'USDT'], includeCex: 'false' },
				headers: { authorization: 'Bearer pro-token' }
			}),
			res
		)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([aaveUsage])
	})
})
