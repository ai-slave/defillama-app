import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import type { Hack } from './model'
import { getHacksPageData, getTotalValueLostInHacksByProtocol } from './queries'

const fetchHacksMock = vi.hoisted(() => vi.fn())

vi.mock('./api', () => ({ fetchHacks: fetchHacksMock }))

function hack(overrides: Partial<Hack>): Hack {
	return {
		date: 1_704_067_200,
		name: 'Protocol',
		classification: 'Access Control',
		technique: 'Key Compromise',
		amountUsd: 0,
		chain: ['Ethereum'],
		bridgeHack: false,
		targetType: 'DeFi Protocol',
		returnedFundsUsd: 0,
		defillamaId: '1',
		language: null,
		...overrides
	}
}

describe('Hacks queries', () => {
	beforeEach(() => {
		fetchHacksMock.mockReset()
	})

	it('uses whole USD for chart points and net-value-lost aggregates', async () => {
		fetchHacksMock.mockResolvedValue([
			hack({ amountUsd: 10_000_000, returnedFundsUsd: 2_000_000 }),
			hack({ amountUsd: 5_000_000, returnedFundsUsd: 1_000_000 })
		])

		const metadata = { '1': { displayName: 'Protocol' } } as unknown as Record<string, IProtocolMetadata>
		const [page, totals] = await Promise.all([
			getHacksPageData(),
			getTotalValueLostInHacksByProtocol({ protocolMetadata: metadata })
		])

		expect(page.monthlyHacksChartData.dataset.source[0][1]).toBe(15_000_000)
		expect(totals.protocols[0]).toMatchObject({ totalHackedUsd: 15_000_000, returnedFundsUsd: 3_000_000 })
		expect(totals.protocols[0].totalHackedUsd - totals.protocols[0].returnedFundsUsd).toBe(12_000_000)
	})
})
