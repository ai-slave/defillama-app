import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Raise } from './model'
import { getInvestorsPageData, getRaisesPageData } from './queries'

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
		...overrides
	}
}

describe('Raises queries', () => {
	beforeEach(() => {
		fetchRaisesMock.mockReset()
	})

	it('keeps whole-USD values in page and investor aggregates', async () => {
		fetchRaisesMock.mockResolvedValue({
			raises: [
				raise({ name: 'A', amountUsd: 3_000_000, leadInvestors: ['Fund'] }),
				raise({ name: 'B', amountUsd: 5_000_000, otherInvestors: ['Fund'] })
			]
		})

		const [raisesPage, investorsPage] = await Promise.all([getRaisesPageData(), getInvestorsPageData()])

		expect(raisesPage.raises.map((item) => item.amountUsd)).toEqual([3_000_000, 5_000_000])
		expect(investorsPage.investors[0].allTime.medianAmountUsd).toBe(4_000_000)
	})
})
