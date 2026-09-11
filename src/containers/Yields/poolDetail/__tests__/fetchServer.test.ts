import { beforeEach, describe, expect, test, vi } from 'vitest'

const { fetchReportedPoolDetail, fetchReportedPoolHistory, fetchVerifiedPoolDetail, fetchVerifiedPoolHistory } =
	vi.hoisted(() => ({
		fetchReportedPoolDetail: vi.fn(),
		fetchReportedPoolHistory: vi.fn(),
		fetchVerifiedPoolDetail: vi.fn(),
		fetchVerifiedPoolHistory: vi.fn()
	}))
vi.mock('../fetch', () => ({
	fetchReportedPoolDetail,
	fetchReportedPoolHistory,
	fetchVerifiedPoolDetail,
	fetchVerifiedPoolHistory,
	mergePoolVerifiedHistory: (history: Array<Record<string, unknown>>, verified: Array<unknown> | null) =>
		verified?.length ? history.map((row) => ({ ...row, verified: verified[0] })) : history
}))

import { fetchPoolDetailCached, fetchPoolHistoryCached } from '../fetch.server'

beforeEach(() => {
	vi.clearAllMocks()
	fetchReportedPoolDetail.mockResolvedValue({ id: 'p' })
	fetchVerifiedPoolDetail.mockResolvedValue({ apy: { avg_1d: 1 } })
	fetchReportedPoolHistory.mockImplementation((_id: string, range: string) => Promise.resolve([{ date: range }]))
	fetchVerifiedPoolHistory.mockResolvedValue([{ date: 'max', apy: { avg_1d: 1 } }])
})

describe('server-side pool fetch memo', () => {
	// Without it a subscriber's pool page fetches the same history twice: once for the render,
	// once for the private route that fills in its measured half.
	test('serves repeated reads of one range from a single upstream call', async () => {
		const id = `shared-${Math.random()}`

		await Promise.all([fetchPoolHistoryCached(id, 'max'), fetchPoolHistoryCached(id, 'max')])
		await fetchPoolHistoryCached(id, 'max')
		expect(fetchReportedPoolHistory).toHaveBeenCalledOnce()
		expect(fetchVerifiedPoolHistory).not.toHaveBeenCalled()

		expect(await fetchPoolHistoryCached(id, '30d')).toEqual([{ date: '30d' }])
		expect(fetchReportedPoolHistory).toHaveBeenCalledTimes(2)
	})

	test('memoizes the detail per pool', async () => {
		const id = `detail-${Math.random()}`

		await fetchPoolDetailCached(id)
		await fetchPoolDetailCached(id)

		expect(fetchReportedPoolDetail).toHaveBeenCalledOnce()
		expect(fetchVerifiedPoolDetail).not.toHaveBeenCalled()
	})

	test('adds the verified sidecars only for an opted-in measured caller', async () => {
		const id = `verified-${Math.random()}`

		const detail = await fetchPoolDetailCached(id, true)
		const history = await fetchPoolHistoryCached(id, 'max', true)

		expect(detail.verified).toEqual({ apy: { avg_1d: 1 } })
		expect(history[0]?.verified).toEqual({ date: 'max', apy: { avg_1d: 1 } })
		expect(fetchReportedPoolDetail).toHaveBeenCalledOnce()
		expect(fetchVerifiedPoolDetail).toHaveBeenCalledOnce()
		expect(fetchReportedPoolHistory).toHaveBeenCalledOnce()
		expect(fetchVerifiedPoolHistory).toHaveBeenCalledOnce()
	})
})
