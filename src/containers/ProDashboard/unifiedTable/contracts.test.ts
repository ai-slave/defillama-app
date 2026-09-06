import { describe, expect, test } from 'vitest'
import { createProtocolsUnifiedTableResponse, type ProtocolAggregateTableRow } from './contracts'

const row: ProtocolAggregateTableRow = {
	rowType: 'protocol',
	id: 'protocol-alpha',
	name: 'Alpha',
	displayName: 'Alpha',
	protocolId: 'alpha',
	logo: 'alpha.png',
	category: null,
	chains: [],
	oracles: [],
	parentProtocolId: null,
	parentProtocolName: null,
	parentProtocolLogo: null,
	metrics: { tvl: 0, fees24h: null },
	chain: null
}

describe('protocol Unified Table response', () => {
	test('omits unavailable row metrics from the wire shape without dropping zero or row discriminants', () => {
		const input = structuredClone(row)
		const response = createProtocolsUnifiedTableResponse({ rows: [input], parentMetrics: {} })

		expect(response.rows[0]).toMatchObject({ rowType: 'protocol', chain: null, category: null })
		expect(response.rows[0]?.metrics).toEqual({ tvl: 0 })
		expect(response.rows[0]).toBe(input)
	})
})
