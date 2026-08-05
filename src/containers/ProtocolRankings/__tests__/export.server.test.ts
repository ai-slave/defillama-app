import { describe, expect, it } from 'vitest'
import { buildProtocolRankingsCsv } from '../export.server'
import type { IProtocol } from '../types'

const protocol = {
	id: 'formula-safe',
	name: ' =Formula Safe',
	slug: 'formula-safe',
	chains: ['Ethereum'],
	category: 'Dexs',
	tvl: { default: { tvl: 10, tvlPrevDay: 10, tvlPrevWeek: 10, tvlPrevMonth: 10 } },
	tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
	mcap: 20,
	tokenPrice: null,
	mcaptvl: 2,
	strikeTvl: false
} satisfies IProtocol

describe('protocol ranking full CSV export', () => {
	it('exports the full server query with selected and custom columns safely', () => {
		const csv = buildProtocolRankingsCsv({
			rows: [protocol],
			columns: [
				{ key: 'name', name: 'Name' },
				{ key: 'tvl', name: 'TVL' },
				{ key: 'custom_formula_0', name: 'Double TVL', formula: 'tvl * 2' }
			]
		})

		expect(csv).toBe("Name,TVL,Double TVL\r\n' =Formula Safe,10,20")
	})
})
