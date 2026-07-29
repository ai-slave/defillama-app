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
			'Ethereum-staking': { tvl: 10, tvlPrevDay: 8, tvlPrevWeek: 7, tvlPrevMonth: 6 }
		},
		tvl: 150,
		tvlPrevDay: 120,
		tvlPrevWeek: 100,
		tvlPrevMonth: 90,
		mcap: 300,
		defillamaId: 'protocol-a',
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
			tvl: 100,
			tvlPrevDay: 80,
			change_1d: 25,
			mcaptvl: 3,
			extraTvl: { staking: { tvl: 10, tvlPrevDay: 8, tvlPrevWeek: 7, tvlPrevMonth: 6 } }
		})
		expect(deprecated).toMatchObject({ name: 'Deprecated', deprecated: true, tvl: null, tvlPrevDay: null })
	})

	it('keeps the directory projection limited to the requested fields', () => {
		const project = basicProtocolPropertiesToKeepV1List(['name', 'url'])

		expect(project({ protocols: [protocol()], chains: ['Ethereum'], parentProtocols: [] })).toEqual({
			protocols: [{ name: 'Protocol A', url: 'https://a.example' }],
			chains: ['Ethereum'],
			parentProtocols: []
		})
	})
})
