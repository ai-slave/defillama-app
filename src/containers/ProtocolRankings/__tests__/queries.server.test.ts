import { describe, expect, test } from 'vitest'
import { COINS_SERVER_URL, SERVER_URL, V2_SERVER_URL } from '~/constants'
import type { ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { getProtocolsByChain } from '../queries.server'

const http = installFixtureFetch()

const protocolMetadata = {
	'solo-protocol': { displayName: 'Solo Protocol', chains: ['Ethereum'] }
} satisfies Record<string, IProtocolMetadata>

const chainMetadata = {
	ethereum: { id: 'ethereum', name: 'Ethereum', fees: true, dexs: false }
} satisfies Record<string, IChainMetadata>

const solo: ProtocolLite = {
	category: 'Dexes',
	chains: ['Ethereum'],
	mcap: null,
	name: 'Solo Raw',
	symbol: 'SOLO',
	logo: '',
	url: '',
	tvl: 10,
	tvlPrevDay: 9,
	tvlPrevWeek: 8,
	tvlPrevMonth: 7,
	chainTvls: { Ethereum: { tvl: 10, tvlPrevDay: 9, tvlPrevWeek: 8, tvlPrevMonth: 7 } },
	defillamaId: 'solo-protocol',
	geckoId: 'solo'
}

const protocols: ProtocolsResponse = {
	protocols: [solo],
	parentProtocols: [],
	chains: ['Ethereum'],
	protocolCategories: ['Dexes']
}

const metric = (total24h: number) => ({ allChains: [], protocols: [{ defillamaId: 'solo-protocol', total24h }] })
const notFound = () => new Response('{}', { status: 404 })

function serveUpstream(overrides: Record<string, unknown> = {}) {
	http.serve({
		[`${SERVER_URL}/lite/protocols2`]: protocols,
		[`${COINS_SERVER_URL}/`]: { coins: { 'coingecko:solo': { price: 3 } } },
		[`${SERVER_URL}/emissionsBreakdownAggregated`]: {
			protocols: [
				{ name: 'Solo Protocol', defillamaId: 'solo-protocol', emission24h: 1, emission7d: 7, emission30d: 30 }
			]
		},
		[`${V2_SERVER_URL}/metrics/fees`]: metric(5),
		[`${V2_SERVER_URL}/metrics/fees?dataType=dailyRevenue`]: metric(4),
		[`${V2_SERVER_URL}/metrics/fees?dataType=dailyHoldersRevenue`]: metric(2),
		[`${V2_SERVER_URL}/metrics/dexs`]: metric(100),
		[`${V2_SERVER_URL}/chart/dexs`]: [[1_700_000_000, 100]],
		...overrides
	})
}

describe('getProtocolsByChain', () => {
	test('builds all-chain rows from protocols, adapter metrics, emissions and token prices', async () => {
		serveUpstream()

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })

		expect(data?.chains).toEqual(['Ethereum'])
		expect(data?.dexs?.totalDataChart).toEqual([[1_700_000_000, 100]])
		expect(data?.protocols.map((row) => row.name)).toEqual(['Solo Protocol'])
		const row = data?.protocols[0]
		expect([row?.tokenPrice, row?.fees?.total24h, row?.revenue?.total24h, row?.holdersRevenue?.total24h]).toEqual([
			3, 5, 4, 2
		])
		expect(row?.dexs?.total24h).toBe(100)
		expect(row?.emissions).toEqual({
			total24h: 1,
			total7d: 7,
			total30d: 30,
			total1y: null,
			monthlyAverage1y: null,
			totalAllTime: null
		})
		expect(row?.perps).toBeUndefined()
		expect(data?.emissionsData?.['solo-protocol']?.emissions7d).toBe(7)
	})

	test('keeps the adapter sources that loaded when sibling metric requests fail', async () => {
		serveUpstream({
			[`${V2_SERVER_URL}/metrics/fees?dataType=dailyRevenue`]: notFound,
			[`${V2_SERVER_URL}/metrics/dexs`]: notFound
		})

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })
		const row = data?.protocols[0]

		expect([row?.fees?.total24h, row?.holdersRevenue?.total24h]).toEqual([5, 2])
		expect(row?.revenue).toBeUndefined()
		expect(row?.dexs).toBeUndefined()
		expect(data?.dexs).toBeNull()
	})

	test('keeps rows without token prices when the price service fails', async () => {
		serveUpstream({ [`${COINS_SERVER_URL}/`]: notFound })

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })

		expect(data?.protocols.map((row) => [row.name, row.tokenPrice, row.fees?.total24h])).toEqual([
			['Solo Protocol', null, 5]
		])
	})

	test('requests extended activity metrics only when asked', async () => {
		serveUpstream({
			[`${V2_SERVER_URL}/metrics/derivatives`]: metric(20),
			[`${V2_SERVER_URL}/metrics/open-interest`]: metric(50)
		})
		const allMetrics = {
			...chainMetadata,
			ethereum: { ...chainMetadata.ethereum, dexs: false, perps: true, openInterest: true }
		}

		const basic = await getProtocolsByChain({ chain: 'Ethereum', chainMetadata: allMetrics, protocolMetadata })
		expect(basic?.protocols[0]?.perps).toBeUndefined()
		const basicUrls = http.urls()

		const extended = await getProtocolsByChain({
			chain: 'Ethereum',
			chainMetadata: allMetrics,
			protocolMetadata,
			includeExtendedMetrics: true
		})

		expect(basicUrls.filter((url) => url.includes('/metrics/'))).toEqual([
			`${V2_SERVER_URL}/metrics/fees/chain/ethereum`,
			`${V2_SERVER_URL}/metrics/fees/chain/ethereum?dataType=dailyRevenue`,
			`${V2_SERVER_URL}/metrics/fees/chain/ethereum?dataType=dailyHoldersRevenue`
		])
		expect([extended?.protocols[0]?.perps?.total24h, extended?.protocols[0]?.openInterest?.total24h]).toEqual([20, 50])
		expect(extended?.perps?.protocols).toHaveLength(1)
	})

	test('reads a single chain by its slug without emissions and returns null for an unknown chain', async () => {
		serveUpstream()

		const ethereum = await getProtocolsByChain({ chain: 'ethereum', chainMetadata, protocolMetadata })
		const unknown = await getProtocolsByChain({ chain: 'Nowhere', chainMetadata, protocolMetadata })

		// Rows filter and read TVL by the chain's display name, not the slug the caller passed.
		expect(ethereum?.protocols.map((row) => [row.name, row.tvl?.default.tvl])).toEqual([['Solo Protocol', 10]])
		expect(ethereum?.emissionsData).toBeNull()
		expect(ethereum?.protocols[0]?.emissions).toBeUndefined()
		expect(http.urls().some((url) => url.includes('emissionsBreakdownAggregated'))).toBe(false)
		expect(unknown).toBeNull()
	})
})
