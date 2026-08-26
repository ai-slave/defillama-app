import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hydrateMetadataCache, METADATA_CI_STUBS, type CoreMetadataPayload } from '~/utils/metadata/artifactContract'
import type { Hack } from './model'
import { getHacksPageData, getTotalValueLostInHacksByProtocol } from './queries'

const fetchHacksMock = vi.hoisted(() => vi.fn())

vi.mock('./api', () => ({ fetchHacks: fetchHacksMock }))

function hack(overrides: Partial<Hack> = {}): Hack {
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
		defillamaId: 'protocol',
		language: null,
		source: '',
		...overrides
	}
}

function metadataFixture() {
	const payload: CoreMetadataPayload = {
		...METADATA_CI_STUBS,
		protocols: {
			protocol: { name: 'protocol', displayName: 'Protocol', tvl: true, hacks: true },
			cex: { name: 'gate-cex', displayName: 'Gate', cex: true, hacks: true },
			'chain#tac': { hacks: true },
			'chain#missing': { hacks: true },
			stale: { hacks: true },
			'old-aave': { hacks: true },
			'active-aave': { name: 'aave', displayName: 'Aave', tvl: true },
			'duplicate-a': { hacks: true },
			'duplicate-b': { hacks: true },
			refund: { name: 'refund', displayName: 'Refund Protocol', tvl: true, hacks: true }
		},
		chains: {
			tac: { name: 'TAC', id: 'tac' }
		},
		cexs: [{ name: 'Gate', slug: 'gate-cex' }]
	}
	return hydrateMetadataCache(payload)
}

describe('Hacks queries', () => {
	beforeEach(() => {
		fetchHacksMock.mockReset()
	})

	it('uses whole USD and zero contribution for unknown aggregate values', async () => {
		fetchHacksMock.mockResolvedValue([
			hack({ amountUsd: 10_000_000, returnedFundsUsd: 2_000_000 }),
			hack({ amountUsd: null, returnedFundsUsd: null }),
			hack({ defillamaId: 'stale', name: 'Stale Protocol', amountUsd: null, returnedFundsUsd: null })
		])

		const [page, totals] = await Promise.all([
			getHacksPageData(),
			getTotalValueLostInHacksByProtocol({ metadataCache: metadataFixture() })
		])

		expect(page.data.map((item) => item.amountUsd)).toEqual([10_000_000, null, null])
		expect(page.monthlyHacksChartData.dataset.source[0]?.[1]).toBe(10_000_000)
		expect(totals.protocols).toEqual([
			expect.objectContaining({ totalHackedUsd: 10_000_000, returnedFundsUsd: 2_000_000 }),
			expect.objectContaining({ name: 'Stale Protocol', totalHackedUsd: 0, returnedFundsUsd: 0 })
		])
	})

	it('sorts unknown dates last and excludes them from monthly history', async () => {
		fetchHacksMock.mockResolvedValue([
			hack({ name: 'Unknown date', date: null, amountUsd: 5 }),
			hack({ name: 'Dated', date: 1_704_067_200, amountUsd: 10 })
		])

		const page = await getHacksPageData()

		expect(page.data.map((item) => item.name)).toEqual(['Dated', 'Unknown date'])
		expect(page.totalHacked).toBe('$15')
		expect(page.monthlyHacksChartData.dataset.source).toHaveLength(1)
	})

	it('uses current metadata identity instead of historical target labels', async () => {
		fetchHacksMock.mockResolvedValue([
			hack({ amountUsd: 10, targetType: 'CEX' }),
			hack({ amountUsd: null, targetType: 'DeFi Protocol' }),
			hack({ defillamaId: 'cex', name: 'Gate', amountUsd: 20, targetType: 'DeFi Protocol' }),
			hack({ defillamaId: 'chain#tac', name: 'TAC', amountUsd: 30 }),
			hack({ defillamaId: 'old-aave', name: 'Aave', amountUsd: 40 }),
			hack({ defillamaId: 'stale', name: 'Stale Protocol', amountUsd: 50 }),
			hack({ defillamaId: 'duplicate-a', name: 'Duplicate', amountUsd: 1 }),
			hack({ defillamaId: 'duplicate-b', name: 'Duplicate', amountUsd: 2 })
		])

		const { protocols } = await getTotalValueLostInHacksByProtocol({ metadataCache: metadataFixture() })

		expect(protocols.find((item) => item.name === 'Protocol')).toMatchObject({
			route: '/protocol/protocol',
			totalHackedUsd: 10
		})
		expect(protocols.find((item) => item.name === 'Gate')).toMatchObject({ route: '/cex/gate-cex' })
		expect(protocols.find((item) => item.name === 'TAC')).toMatchObject({ route: '/chain/tac' })
		expect(protocols.find((item) => item.name === 'Aave')).toMatchObject({ route: '/protocol/aave' })
		expect(protocols.find((item) => item.name === 'Stale Protocol')).toMatchObject({ route: null })
		expect(protocols.filter((item) => item.name === 'Duplicate').map((item) => item.totalHackedUsd)).toEqual([2, 1])
	})

	it('does not replace an unresolved authoritative identity with a same-name route', async () => {
		fetchHacksMock.mockResolvedValue([hack({ defillamaId: 'chain#missing', name: 'Protocol', amountUsd: 10 })])

		const { protocols } = await getTotalValueLostInHacksByProtocol({ metadataCache: metadataFixture() })

		expect(protocols).toEqual([
			expect.objectContaining({ name: 'Protocol', slug: 'protocol', route: null, totalHackedUsd: 10 })
		])
	})

	it('preserves producer order when protocol totals are equal', async () => {
		fetchHacksMock.mockResolvedValue([
			hack({ defillamaId: 'duplicate-b', name: 'Zulu', amountUsd: 10 }),
			hack({ defillamaId: 'duplicate-a', name: 'Alpha', amountUsd: 10 })
		])

		const { protocols } = await getTotalValueLostInHacksByProtocol({ metadataCache: metadataFixture() })

		expect(protocols.map((item) => item.slug)).toEqual(['zulu', 'alpha'])
	})

	it('preserves negative net loss when returned funds exceed measured losses', async () => {
		fetchHacksMock.mockResolvedValue([
			hack({ defillamaId: 'refund', amountUsd: 197_000_000, returnedFundsUsd: 240_000_000 })
		])

		const { protocols } = await getTotalValueLostInHacksByProtocol({ metadataCache: metadataFixture() })
		const protocol = protocols[0]

		expect(protocol).toBeDefined()
		expect((protocol?.totalHackedUsd ?? 0) - (protocol?.returnedFundsUsd ?? 0)).toBe(-43_000_000)
	})

	it('keeps successful empty separate from source failure', async () => {
		fetchHacksMock.mockResolvedValueOnce([])
		await expect(getTotalValueLostInHacksByProtocol({ metadataCache: metadataFixture() })).resolves.toEqual({
			protocols: []
		})

		fetchHacksMock.mockRejectedValueOnce(new Error('source unavailable'))
		await expect(getTotalValueLostInHacksByProtocol({ metadataCache: metadataFixture() })).rejects.toThrow(
			'source unavailable'
		)
	})
})
