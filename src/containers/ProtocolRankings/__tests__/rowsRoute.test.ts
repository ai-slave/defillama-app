import { describe, expect, test, vi } from 'vitest'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'
import type { ProtocolRankingsCanonicalSnapshot } from '../server/tableData.server'
import type { IProtocol } from '../types'

const mocks = vi.hoisted(() => ({ readCurrent: vi.fn() }))
vi.mock('~/server/datasetSnapshots/redisBlobStore.server', async (original) => ({
	...(await original<typeof import('~/server/datasetSnapshots/redisBlobStore.server')>()),
	createRedisBlobStore: () => mocks
}))

import handler from '~/pages/api/dynamic/protocol-rankings/rows'

function row(name: string, children?: Array<string>): IProtocol {
	return {
		id: name,
		name,
		slug: name,
		chains: ['Ethereum'],
		category: null,
		tvl: { default: { tvl: 1, tvlPrevDay: 1, tvlPrevWeek: 1, tvlPrevMonth: 1 } },
		tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
		mcap: null,
		tokenPrice: null,
		mcaptvl: null,
		strikeTvl: false,
		...(children ? { childProtocols: children.map((child) => row(child)) } : {})
	} as IProtocol
}

const snapshot: ProtocolRankingsCanonicalSnapshot = {
	chain: 'All',
	createdAt: 1,
	availableActivityMetrics: [],
	source: { chains: ['Ethereum'], feeProtocols: null, dexs: null, perps: null },
	snapshot: 'aK3f9Qm2xLpR7Bn0Wc-T',
	protocols: [row('Aave'), row('Lido'), row('Uniswap Labs', ['Uniswap V3', 'Uniswap V2'])]
}
mocks.readCurrent.mockResolvedValue(snapshot)

async function call(body: unknown, method = 'POST') {
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ method, body }), res)
	return {
		statusCode: res.statusCode,
		payload: res.json.mock.calls.at(-1)?.[0],
		headers: Object.fromEntries(res.setHeader.mock.calls)
	}
}

describe('protocol rankings rows route', () => {
	test('returns rows for watched parent names and parents of watched children', async () => {
		const res = await call({ names: ['Lido', 'Uniswap V2'] })

		expect(res.statusCode).toBe(200)
		const { rows, snapshot: version } = res.payload as { rows: Array<IProtocol>; snapshot: string }
		expect(rows.map((item) => item.name)).toEqual(['Lido', 'Uniswap Labs'])
		expect(version).toBe(snapshot.snapshot)
		expect(res.headers['Cache-Control']).toBe('no-store')
	})

	test('returns an empty set for an empty watchlist without filtering', async () => {
		const res = await call({ names: [] })
		expect(res.statusCode).toBe(200)
		expect((res.payload as { rows: Array<IProtocol> }).rows).toEqual([])
	})

	test('rejects malformed bodies and oversized name lists', async () => {
		expect((await call({})).statusCode).toBe(400)
		expect((await call({ names: 'Lido' })).statusCode).toBe(400)
		expect((await call({ names: [1, 2] })).statusCode).toBe(400)
		expect((await call({ names: Array.from({ length: 501 }, (_, index) => `p${index}`) })).statusCode).toBe(400)
	})

	test('rejects non-POST methods', async () => {
		const res = await call({ names: ['Lido'] }, 'GET')
		expect(res.statusCode).toBe(405)
		expect(res.headers.Allow).toBe('POST')
	})
})
