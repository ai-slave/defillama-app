import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Raise } from './model'
import { getInvestorRaisesPageData, getInvestorsPageData, getRaisesPageData } from './queries'

const fetchRaisesMock = vi.hoisted(() => vi.fn())

vi.mock('./api', () => ({ fetchRaises: fetchRaisesMock }))

function raise(overrides: Partial<Raise>): Raise {
	return {
		date: 1,
		name: 'Protocol',
		round: 'Seed',
		amountUsd: null,
		chains: [],
		sector: 'DeFi',
		category: 'DeFi',
		categoryGroup: 'DeFi',
		leadInvestors: [],
		otherInvestors: [],
		valuationUsd: null,
		source: '',
		...overrides
	}
}

describe('Raises queries', () => {
	beforeEach(() => {
		fetchRaisesMock.mockReset()
	})
	afterEach(() => vi.useRealTimers())

	it('keeps whole-USD values in page and investor aggregates', async () => {
		fetchRaisesMock.mockResolvedValue({
			raises: [
				raise({ name: 'A', amountUsd: 3_000_000, leadInvestors: ['Fund'] }),
				raise({ name: 'B', amountUsd: 5_000_000, otherInvestors: ['Fund'] })
			]
		})

		const [raisesPage, investorsPage] = await Promise.all([getRaisesPageData(), getInvestorsPageData()])

		expect(raisesPage.raises.map((item) => item.amountUsd)).toEqual([3_000_000, 5_000_000])
		expect(investorsPage.investors[0]?.allTime.medianAmountUsd).toBe(4_000_000)
	})

	it.each([
		{ amounts: [null], median: null },
		{ amounts: [0, null], median: 0 },
		{ amounts: [9, 1, 5, null], median: 5 },
		{ amounts: [0, 6, 4, 2], median: 3 }
	])('uses only measured amounts for median: $amounts', async ({ amounts, median }) => {
		fetchRaisesMock.mockResolvedValue({
			raises: amounts.map((amountUsd) => raise({ amountUsd, leadInvestors: ['Fund'] }))
		})
		const { investors } = await getInvestorsPageData()
		expect(investors[0]?.allTime).toMatchObject({ deals: amounts.length, medianAmountUsd: median })
		expect(investors[0]?.last30d.medianAmountUsd).toBeNull()
	})

	it('counts one investor once per round, preserves case, and keeps separate rounds', async () => {
		const first = raise({ name: 'A', amountUsd: 10, leadInvestors: ['Fund', 'Fund'], otherInvestors: ['Fund', 'fund'] })
		const second = raise({ name: 'B', amountUsd: 5, category: 'CeFi', round: 'Series A', leadInvestors: ['Fund'] })
		fetchRaisesMock.mockResolvedValue({ raises: [first, second] })
		const { investors } = await getInvestorsPageData()
		expect(investors.map(({ name, allTime }) => [name, allTime.deals, allTime.medianAmountUsd])).toEqual([
			['Fund', 2, 7.5],
			['fund', 1, 10]
		])
		expect(investors[0]?.allTime).toMatchObject({ topCategory: 'DeFi', topRound: 'Seed' })
		const detail = await getInvestorRaisesPageData('fund')
		expect(detail).toMatchObject({ raises: [first, second], investorName: 'Fund', investors: [] })
		expect(await getInvestorRaisesPageData('missing-fund')).toEqual({ notFound: true })
	})

	it('includes each rolling cutoff and excludes the second before it', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-08-26T00:00:00Z'))
		const now = Date.now() / 1000
		const rows: Raise[] = []
		for (const days of [30, 180, 365]) {
			for (const offset of [0, -1]) rows.push(raise({ date: now - days * 86400 + offset, leadInvestors: ['Fund'] }))
		}
		fetchRaisesMock.mockResolvedValue({ raises: rows })
		const { investors } = await getInvestorsPageData()
		expect(investors[0]).toMatchObject({
			last30d: { deals: 1 },
			last180d: { deals: 3 },
			last1y: { deals: 5 },
			allTime: { deals: 6 }
		})
	})

	it('keeps successful empty data separate from source failure', async () => {
		fetchRaisesMock.mockResolvedValue({ raises: [] })
		expect(await getRaisesPageData()).toEqual({
			raises: [],
			investors: [],
			rounds: [],
			sectors: [],
			chains: [],
			investorName: null
		})
		expect(await getInvestorsPageData()).toEqual({ investors: [] })
		expect(await getInvestorRaisesPageData('fund')).toEqual({ notFound: true })
		fetchRaisesMock.mockRejectedValue(new Error('source unavailable'))
		await expect(getRaisesPageData()).rejects.toThrow('source unavailable')
		await expect(getInvestorsPageData()).rejects.toThrow('source unavailable')
		await expect(getInvestorRaisesPageData('fund')).rejects.toThrow('source unavailable')
	})
})
