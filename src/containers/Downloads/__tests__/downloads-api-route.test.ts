import type { NextApiHandler, NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AUTH_SERVER, POCKETBASE_URL, SERVER_URL, V2_SERVER_URL } from '~/constants'
import datasetHandler from '~/pages/api/private/downloads/[dataset]'
import breakdownHandler from '~/pages/api/private/downloads/chart-breakdown/[slug]'
import chartHandler from '~/pages/api/private/downloads/chart/[dataset]'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

vi.mock('~/server/db/llama', () => ({ llamaDb: { query: async () => [], any: async () => [] } }))
const { serve } = installFixtureFetch()
const protocols = Array.from({ length: 11 }, (_, i) => ({
	name: `item-${i + 1}`,
	tvl: 11 - i,
	chains: ['Ethereum'],
	chainTvls: { Ethereum: { tvl: 11 - i } }
}))
const chart = Array.from({ length: 11 }, (_, i) => [1_700_000_000 + i * 86_400, i + 1])
beforeEach(() =>
	serve({
		[`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'active' } },
		[`${POCKETBASE_URL}/api/collections/users/auth-refresh`]: { record: { flags: { is_trial: false } } },
		[`${SERVER_URL}/lite/protocols2`]: { protocols },
		[`${V2_SERVER_URL}/chart/tvl/protocol/aave`]: chart
	})
)
async function run(handler: NextApiHandler, query: NextApiRequest['query'], auth: string | undefined, method = 'GET') {
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ method, query, headers: { authorization: auth } }), res)
	expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
	return {
		status: res.statusCode,
		csv: res.send.mock.lastCall?.[0] as string,
		body: res.json.mock.lastCall?.[0],
		preview: res.setHeader.mock.calls.find(([name]) => name === 'X-Preview')?.[1]
	}
}

describe('download access and CSV output', () => {
	test('rejects unsupported methods', async () => {
		expect((await run(datasetHandler, { dataset: 'protocols' }, undefined, 'POST')).status).toBe(405)
	})
	test('limits anonymous and inactive subscribers to ten preview rows', async () => {
		const anonymous = await run(datasetHandler, { dataset: 'protocols' }, undefined)
		expect(anonymous).toMatchObject({ status: 200, preview: 'true' })
		expect(anonymous.csv).toContain('item-10')
		expect(anonymous.csv).not.toContain('item-11')
		serve({ [`${AUTH_SERVER}/subscription/status`]: fixtureStatus(403) })
		expect((await run(datasetHandler, { dataset: 'protocols' }, 'Bearer invalid')).csv).toBe(anonymous.csv)
	})
	test('includes every row for paid subscribers', async () => {
		const response = await run(datasetHandler, { dataset: 'protocols' }, 'Bearer paid')
		expect(response).toMatchObject({ status: 200, preview: undefined })
		expect(response.csv).toContain('item-11')
		expect(response.csv.split('\n')).toHaveLength(12)
	})
	test('allows trial chain options but rejects trial CSV downloads', async () => {
		serve({ [`${POCKETBASE_URL}/api/collections/users/auth-refresh`]: { record: { flags: { is_trial: true } } } })
		const query = { dataset: 'protocols' }
		expect(await run(datasetHandler, query, 'Bearer trial')).toMatchObject({
			status: 403,
			body: { error: 'CSV downloads are available only for paid users.' }
		})
		expect(await run(datasetHandler, { ...query, mode: 'chains' }, 'Bearer trial')).toMatchObject({
			status: 200,
			body: { chains: ['Ethereum'] }
		})
		expect((await run(chartHandler, { dataset: 'protocol-tvl-chart', param: 'aave' }, 'Bearer trial')).status).toBe(403)
		expect(
			(await run(breakdownHandler, { slug: 'protocol-tvl-chart', category: 'Lending' }, 'Bearer trial')).status
		).toBe(403)
	})
	test('previews the latest ten chart rows and exports full paid history', async () => {
		const query = { dataset: 'protocol-tvl-chart', param: 'aave' }
		const preview = await run(chartHandler, query, undefined)
		expect(preview).toMatchObject({ status: 200, preview: 'true' })
		expect(preview.csv).not.toContain('2023-11-14,1\r')
		expect(preview.csv).toContain('2023-11-24,11')
		const full = await run(chartHandler, query, 'Bearer paid')
		expect(full.csv).toContain('2023-11-14,1')
		expect(full.csv.split('\n')).toHaveLength(12)
	})
	test('validates the chart parameter before authentication', async () => {
		expect(await run(chartHandler, { dataset: 'protocol-tvl-chart' }, 'Bearer paid')).toMatchObject({
			status: 400,
			body: { error: 'Missing required "param" query parameter' }
		})
	})
	test('reports authentication service failures', async () => {
		serve({
			[`${AUTH_SERVER}/subscription/status`]: () => {
				throw new Error('Auth unavailable')
			}
		})
		expect((await run(datasetHandler, { dataset: 'protocols' }, 'Bearer paid')).status).toBe(500)
	})
	test('builds category breakdown CSV from matching upstream protocols', async () => {
		serve({
			[`${V2_SERVER_URL}/chart/fees/protocol-breakdown`]: [[1_700_000_000, { Aave: 12, Uniswap: 99 }]],
			[`${SERVER_URL}/overview/fees`]: {
				protocols: [
					{ name: 'Aave', category: 'Lending' },
					{ name: 'Uniswap', category: 'Dexs' }
				]
			}
		})
		const response = await run(breakdownHandler, { slug: 'protocol-fees-chart', category: 'Lending' }, undefined)
		expect(response.status).toBe(200)
		expect(response.csv).toBe('date,Aave\r\n2023-11-14,12')
	})
})
