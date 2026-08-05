import { describe, expect, it } from 'vitest'
import {
	DEFAULT_PROTOCOL_RANKING_QUERY,
	parseStructuredProtocolRankingQuery,
	protocolRankingQuerySignature
} from '../query'

describe('protocol ranking query contract', () => {
	it('parses the structured export query without flattening arrays or custom sort state', () => {
		expect(
			parseStructuredProtocolRankingQuery({
				...DEFAULT_PROTOCOL_RANKING_QUERY,
				sort: 'custom',
				customSort: { formula: 'fees_30d / tvl', formatType: 'number' },
				tvlKeys: ['staking', 'not-a-tvl-key', 'pool2', 'staking']
			})
		).toEqual({
			...DEFAULT_PROTOCOL_RANKING_QUERY,
			sort: 'custom',
			customSort: { formula: 'fees_30d / tvl', formatType: 'number' },
			tvlKeys: ['pool2', 'staking']
		})
	})

	it('rejects malformed structured values and excludes UI-only preset state from signatures', () => {
		expect(parseStructuredProtocolRankingQuery({ ...DEFAULT_PROTOCOL_RANKING_QUERY, minTvl: '100' })).toBeNull()
		expect(parseStructuredProtocolRankingQuery({ ...DEFAULT_PROTOCOL_RANKING_QUERY, sort: 'unknown' })).toBeNull()
		const withUiPresetState = { ...DEFAULT_PROTOCOL_RANKING_QUERY, metric: 'Fees', period: '7d' }
		expect(protocolRankingQuerySignature(withUiPresetState)).toBe(
			protocolRankingQuerySignature(DEFAULT_PROTOCOL_RANKING_QUERY)
		)
	})
})
