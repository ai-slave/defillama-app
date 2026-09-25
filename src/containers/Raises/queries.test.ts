import { afterEach, describe, expect, test, vi } from 'vitest'
import { SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import type { RaisesApiItem } from './api.types'
import { getInvestorRaisesPageData, getInvestorsPageData, getRaisesPageData } from './queries'

const http = installFixtureFetch()

function raise(overrides: Partial<RaisesApiItem>): RaisesApiItem {
	return {
		date: 1,
		name: 'Protocol',
		round: 'Seed',
		amount: null,
		chains: [],
		sector: 'DeFi',
		category: 'DeFi',
		categoryGroup: 'DeFi',
		leadInvestors: [],
		otherInvestors: [],
		valuation: null,
		source: '',
		...overrides
	}
}

describe('Raises queries', () => {
	afterEach(() => vi.useRealTimers())

	test('keeps whole-USD values in page and investor aggregates', async () => {
		http.serve({
			[`${SERVER_URL}/raises`]: {
				raises: [
					raise({ name: 'A', amount: 3, leadInvestors: ['Fund'] }),
					raise({ name: 'B', amount: 5, otherInvestors: ['Fund'] })
				]
			}
		})

		const [raisesPage, investorsPage] = await Promise.all([getRaisesPageData(), getInvestorsPageData()])

		expect(raisesPage.raises.map((item) => item.amountUsd)).toEqual([3_000_000, 5_000_000])
		expect(investorsPage.investors[0]?.allTime.medianAmountUsd).toBe(4_000_000)
	})

	test.each([
		{ amounts: [null], median: null },
		{ amounts: [0, null], median: 0 },
		{ amounts: [9, 1, 5, null], median: 5 },
		{ amounts: [0, 6, 4, 2], median: 3 }
	])('uses only measured amounts for median: $amounts', async ({ amounts, median }) => {
		http.serve({
			[`${SERVER_URL}/raises`]: {
				raises: amounts.map((amount) => raise({ amount, leadInvestors: ['Fund'] }))
			}
		})
		const { investors } = await getInvestorsPageData()
		expect(investors[0]?.allTime).toMatchObject({
			deals: amounts.length,
			medianAmountUsd: median === null ? null : median * 1_000_000
		})
		expect(investors[0]?.last30d.medianAmountUsd).toBeNull()
	})

	test('counts one investor once per round, preserves case, and keeps separate rounds', async () => {
		const first = raise({ name: 'A', amount: 10, leadInvestors: ['Fund', 'Fund'], otherInvestors: ['Fund', 'fund'] })
		const second = raise({ name: 'B', amount: 5, category: 'CeFi', round: 'Series A', leadInvestors: ['Fund'] })
		http.serve({ [`${SERVER_URL}/raises`]: { raises: [first, second] } })
		const { investors } = await getInvestorsPageData()
		expect(investors.map(({ name, allTime }) => [name, allTime.deals, allTime.medianAmountUsd])).toEqual([
			['Fund', 2, 7_500_000],
			['fund', 1, 10_000_000]
		])
		expect(investors[0]?.allTime).toMatchObject({ topCategory: 'DeFi', topRound: 'Seed' })
		const detail = await getInvestorRaisesPageData('fund')
		expect(detail).toMatchObject({
			raises: [
				expect.objectContaining({ name: 'A', amountUsd: 10_000_000 }),
				expect.objectContaining({ name: 'B', amountUsd: 5_000_000 })
			],
			investorName: 'Fund',
			investors: []
		})
		expect(await getInvestorRaisesPageData('missing-fund')).toEqual({ notFound: true })
	})

	test('includes each rolling cutoff and excludes the second before it', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-08-26T00:00:00Z'))
		const now = Date.now() / 1000
		const rows: Array<RaisesApiItem> = []
		for (const days of [30, 180, 365]) {
			for (const offset of [0, -1]) rows.push(raise({ date: now - days * 86_400 + offset, leadInvestors: ['Fund'] }))
		}
		http.serve({ [`${SERVER_URL}/raises`]: { raises: rows } })
		const { investors } = await getInvestorsPageData()
		expect(investors[0]).toMatchObject({
			last30d: { deals: 1 },
			last180d: { deals: 3 },
			last1y: { deals: 5 },
			allTime: { deals: 6 }
		})
	})

	test('keeps successful empty data separate from source failure', async () => {
		http.serve({ [`${SERVER_URL}/raises`]: { raises: [] } })
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
		http.serve({ [`${SERVER_URL}/raises`]: fixtureStatus(404, { error: 'source unavailable' }) })
		await expect(getRaisesPageData()).rejects.toThrow('source unavailable')
		await expect(getInvestorsPageData()).rejects.toThrow('source unavailable')
		await expect(getInvestorRaisesPageData('fund')).rejects.toThrow('source unavailable')
	})
})
