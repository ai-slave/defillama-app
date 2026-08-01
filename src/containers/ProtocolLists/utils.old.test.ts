import { describe, expect, it } from 'vitest'
import type { ProtocolLite } from './api.types'
import { basicProtocolPropertiesToKeepV1List, formatProtocolsData } from './utils.old'

function protocol(overrides: Partial<ProtocolLite> = {}): ProtocolLite {
	return {
		name: 'Protocol A',
		symbol: 'A',
		logo: 'a.png',
		url: 'https://a.example',
		category: 'Dexs',
		chains: ['Ethereum', 'Base'],
		chainTvls: {
			Ethereum: { tvl: 100, tvlPrevDay: 80, tvlPrevWeek: 70, tvlPrevMonth: 60 },
			'Ethereum-staking': { tvl: 10, tvlPrevDay: 8, tvlPrevWeek: 7, tvlPrevMonth: 6 },
			'Ethereum-doublecounted': { tvl: 90, tvlPrevDay: 90, tvlPrevWeek: 90, tvlPrevMonth: 90 }
		},
		tvl: 150,
		tvlPrevDay: 120,
		tvlPrevWeek: 100,
		tvlPrevMonth: 90,
		mcap: 300,
		defillamaId: 'protocol-a',
		geckoId: null,
		...overrides
	}
}

describe('legacy protocol formatting', () => {
	it('constructs complete chain-specific rows from the canonical protocol DTO', () => {
		const [active, deprecated] = formatProtocolsData({
			chain: 'Ethereum',
			protocols: [protocol(), protocol({ name: 'Deprecated', defillamaId: 'deprecated', deprecated: true })]
		})

		expect(active).toMatchObject({
			name: 'Protocol A',
			url: 'https://a.example',
			contributesTvl: true,
			tvl: 100,
			tvlPrevDay: 80,
			change_1d: 25,
			mcaptvl: 3,
			extraTvl: { staking: { tvl: 10, tvlPrevDay: 8, tvlPrevWeek: 7, tvlPrevMonth: 6 } }
		})
		expect(active?.extraTvl).toEqual({
			staking: { tvl: 10, tvlPrevDay: 8, tvlPrevWeek: 7, tvlPrevMonth: 6 }
		})
		expect(deprecated).toMatchObject({
			name: 'Deprecated',
			deprecated: true,
			contributesTvl: false,
			tvl: null,
			tvlPrevDay: null
		})
	})

	it('distinguishes present null and zero current TVL from a missing selected-chain section', () => {
		const [unknown] = formatProtocolsData({
			chain: 'Ethereum',
			protocols: [
				protocol({ chainTvls: { Ethereum: { tvl: null, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null } } })
			]
		})
		const [zero] = formatProtocolsData({
			chain: 'Ethereum',
			protocols: [protocol({ chainTvls: { Ethereum: { tvl: 0, tvlPrevDay: 0, tvlPrevWeek: 0, tvlPrevMonth: 0 } } })]
		})
		const [missing] = formatProtocolsData({ chain: 'Ethereum', protocols: [protocol({ chainTvls: {} })] })

		expect(unknown?.tvl).toBeNull()
		expect(unknown?.contributesTvl).toBe(true)
		expect(zero?.tvl).toBe(0)
		expect(missing?.tvl).toBeNull()
	})

	it('returns only finite legacy market-cap ratios with a positive TVL denominator', () => {
		const [zeroMcap] = formatProtocolsData({ protocols: [protocol({ mcap: 0, tvl: 100 })] })
		const [zeroTvl] = formatProtocolsData({ protocols: [protocol({ mcap: 100, tvl: 0 })] })
		const [negativeTvl] = formatProtocolsData({ protocols: [protocol({ mcap: 100, tvl: -1 })] })
		const [overflow] = formatProtocolsData({
			protocols: [protocol({ mcap: Number.MAX_VALUE, tvl: Number.MIN_VALUE })]
		})

		expect(zeroMcap?.mcaptvl).toBe(0)
		expect(zeroTvl?.mcaptvl).toBeNull()
		expect(negativeTvl?.mcaptvl).toBeNull()
		expect(overflow?.mcaptvl).toBeNull()
	})

	it('keeps the directory projection limited to the requested fields', () => {
		const project = basicProtocolPropertiesToKeepV1List(['name', 'url'])

		expect(
			project({ protocols: [protocol()], chains: ['Ethereum'], parentProtocols: [], protocolCategories: ['Dexs'] })
		).toEqual({
			protocols: [{ name: 'Protocol A', url: 'https://a.example' }],
			chains: ['Ethereum'],
			parentProtocols: []
		})
	})
})
