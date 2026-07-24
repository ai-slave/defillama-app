import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IETFFlowApiItem, IETFSnapshotApiItem } from './api.types'
import { buildETFChartSpec } from './chartData'
import { getETFData } from './queries'

const mocks = vi.hoisted(() => ({
	fetchETFSnapshot: vi.fn<() => Promise<IETFSnapshotApiItem[]>>(),
	fetchETFFlows: vi.fn<() => Promise<IETFFlowApiItem[]>>()
}))

vi.mock('./api', () => ({
	fetchETFSnapshot: mocks.fetchETFSnapshot,
	fetchETFFlows: mocks.fetchETFFlows
}))

describe('ETF API response to chart contract', () => {
	beforeEach(() => vi.clearAllMocks())

	it('normalizes raw snake-case responses and feeds the actual chart builder', async () => {
		mocks.fetchETFSnapshot.mockResolvedValue([
			{
				ticker: 'ETHA',
				issuer: 'BlackRock',
				etf_name: 'iShares Ethereum Trust',
				custodian: 'Coinbase',
				pct_fee: 0.25,
				url: 'https://example.com/etha',
				price: 30,
				volume: 2_000,
				aum: 400,
				shares: 10,
				btc: 0,
				flows: 20,
				asset: 'ethereum'
			},
			{
				ticker: 'IBIT',
				issuer: 'BlackRock',
				etf_name: 'iShares Bitcoin Trust',
				custodian: 'Coinbase',
				pct_fee: 0.25,
				url: 'https://example.com/ibit',
				price: 60,
				volume: 3_000,
				aum: 600,
				shares: 10,
				btc: 5,
				flows: 30,
				asset: 'bitcoin'
			}
		] satisfies IETFSnapshotApiItem[])
		mocks.fetchETFFlows.mockResolvedValue([
			{ gecko_id: 'bitcoin', day: '2026-07-16', total_flow_usd: 100 },
			{ gecko_id: 'ethereum', day: '2026-07-16', total_flow_usd: 25 },
			{ gecko_id: 'bitcoin', day: '2026-07-17', total_flow_usd: -10 }
		] satisfies IETFFlowApiItem[])

		const result = await getETFData()
		const chart = buildETFChartSpec({
			flows: result.flows,
			groupBy: 'daily',
			assets: ['Bitcoin', 'Ethereum']
		})

		expect(result.snapshot.map(({ ticker, chain }) => ({ ticker, chain }))).toEqual([
			{ ticker: 'IBIT', chain: ['Bitcoin'] },
			{ ticker: 'ETHA', chain: ['Ethereum'] }
		])
		expect(result.totalsByAsset).toEqual({
			bitcoin: { aum: 600, flows: 30 },
			ethereum: { aum: 400, flows: 20 }
		})
		expect(result.lastUpdated).toBe('Jul 17, 2026')
		expect(chart.dataset).toEqual({
			dimensions: ['timestamp', 'Bitcoin', 'Ethereum'],
			source: [
				[Date.parse('2026-07-16T00:00:00Z'), 100, 25],
				[Date.parse('2026-07-17T00:00:00Z'), -10, null]
			]
		})
		expect(chart.charts.map(({ name, encode }) => ({ name, encode }))).toEqual([
			{ name: 'Bitcoin', encode: { x: 0, y: 1 } },
			{ name: 'Ethereum', encode: { x: 0, y: 2 } }
		])
	})

	it('keeps snapshot data usable when the optional flows request fails', async () => {
		mocks.fetchETFSnapshot.mockResolvedValue([])
		mocks.fetchETFFlows.mockRejectedValue(new Error('unavailable'))

		await expect(getETFData()).resolves.toEqual({
			snapshot: [],
			flows: {},
			totalsByAsset: {},
			lastUpdated: 'N/A'
		})
	})
})
