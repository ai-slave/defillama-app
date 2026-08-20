import { describe, expect, it } from 'vitest'
import type { ProtocolAggregateTableRow } from '../../../unifiedTable/contracts'
import { filterRowsByConfig, hasProtocolSubsetFilters } from './dataFilters'

const DAY_IN_SECONDS = 86_400
const NOW_SECONDS = 2_000_000_000

function protocolRow(protocolId: string): ProtocolAggregateTableRow {
	return {
		rowType: 'protocol',
		id: protocolId,
		name: protocolId,
		protocolId,
		displayName: protocolId,
		logo: '',
		chain: null,
		category: null,
		chains: [],
		oracles: [],
		parentProtocolId: null,
		parentProtocolName: null,
		parentProtocolLogo: null,
		metrics: {}
	}
}

describe('protocol age filters', () => {
	it('keeps protocols inside the configured rolling age range', () => {
		const rows = [protocolRow('new'), protocolRow('boundary'), protocolRow('old'), protocolRow('unknown')]
		const listedAtById: Record<string, number | undefined> = {
			new: NOW_SECONDS - 30 * DAY_IN_SECONDS,
			boundary: NOW_SECONDS - 90 * DAY_IN_SECONDS,
			old: NOW_SECONDS - 91 * DAY_IN_SECONDS
		}

		const result = filterRowsByConfig(rows, { protocolAgeDaysMax: 90 }, {}, {}, {
			getListedAt: (protocolId) => listedAtById[protocolId],
			nowSeconds: NOW_SECONDS
		})

		expect(result.map((row) => row.protocolId)).toEqual(['new', 'boundary'])
	})

	it('supports a minimum age and clamps future listing timestamps to zero days', () => {
		const rows = [protocolRow('future'), protocolRow('mature')]
		const result = filterRowsByConfig(rows, { protocolAgeDaysMin: 10 }, {}, {}, {
			getListedAt: (protocolId) =>
				protocolId === 'future' ? NOW_SECONDS + DAY_IN_SECONDS : NOW_SECONDS - 10 * DAY_IN_SECONDS,
			nowSeconds: NOW_SECONDS
		})

		expect(result.map((row) => row.protocolId)).toEqual(['mature'])
	})

	it('marks age constraints as protocol subset filters', () => {
		expect(hasProtocolSubsetFilters({ protocolAgeDaysMax: 90 })).toBe(true)
	})
})
