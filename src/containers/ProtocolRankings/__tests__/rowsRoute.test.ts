import { describe, expect, it, vi } from 'vitest'
import type { IProtocol } from '../types'

const mocks = vi.hoisted(() => ({ loadProtocolRankingSnapshot: vi.fn() }))
vi.mock('../server/api', () => ({ loadProtocolRankingSnapshot: mocks.loadProtocolRankingSnapshot }))
vi.mock('~/utils/telemetry', () => ({
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler
}))

import handler from '~/pages/api/dynamic/protocol-rankings/rows'

function row(name: string, children?: string[]): IProtocol {
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

const snapshot = {
	snapshot: 'aK3f9Qm2xLpR7Bn0Wc-T',
	protocols: [row('Aave'), row('Lido'), row('Uniswap Labs', ['Uniswap V3', 'Uniswap V2'])]
}
mocks.loadProtocolRankingSnapshot.mockResolvedValue({ snapshot, mismatch: false })

function call(body: unknown, method = 'POST') {
	const res = {
		statusCode: 0,
		payload: undefined as unknown,
		headers: {} as Record<string, string>,
		setHeader(key: string, value: string) {
			this.headers[key] = value
		},
		status(code: number) {
			this.statusCode = code
			return this
		},
		json(payload: unknown) {
			this.payload = payload
			return this
		}
	}
	return (handler as (req: unknown, res: unknown) => Promise<unknown>)({ method, body }, res).then(() => res)
}

describe('protocol rankings rows route', () => {
	it('returns rows for watched parent names and parents of watched children', async () => {
		const res = await call({ names: ['Lido', 'Uniswap V2'] })

		expect(res.statusCode).toBe(200)
		const { rows, snapshot: version } = res.payload as { rows: IProtocol[]; snapshot: string }
		expect(rows.map((item) => item.name)).toEqual(['Lido', 'Uniswap Labs'])
		expect(version).toBe(snapshot.snapshot)
		expect(res.headers['Cache-Control']).toBe('no-store')
	})

	it('returns an empty set for an empty watchlist without filtering', async () => {
		const res = await call({ names: [] })
		expect(res.statusCode).toBe(200)
		expect((res.payload as { rows: IProtocol[] }).rows).toEqual([])
	})

	it('rejects malformed bodies and oversized name lists', async () => {
		expect((await call({})).statusCode).toBe(400)
		expect((await call({ names: 'Lido' })).statusCode).toBe(400)
		expect((await call({ names: [1, 2] })).statusCode).toBe(400)
		expect((await call({ names: Array.from({ length: 501 }, (_, index) => `p${index}`) })).statusCode).toBe(400)
	})

	it('rejects non-POST methods', async () => {
		const res = await call({ names: ['Lido'] }, 'GET')
		expect(res.statusCode).toBe(405)
		expect(res.headers.Allow).toBe('POST')
	})
})
