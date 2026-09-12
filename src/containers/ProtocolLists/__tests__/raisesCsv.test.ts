import { describe, expect, test } from 'vitest'
import { constructTestTable } from '~/components/Table/__tests__/helpers/constructTestTable'
import { prepareTableCsv } from '~/components/Table/utils'
import type { RaisesSummary } from '~/containers/Raises/summary'
import { airdropsColumns, tableFeaturesConfig, type RecentlyListedProtocolsTable } from '../RecentProtocolsTable'

type Row = Parameters<typeof RecentlyListedProtocolsTable>[0]['data'][number]
function row(name: string, raiseSummary: RaisesSummary): Row {
	return {
		name,
		raiseSummary,
		symbol: '-',
		logo: null,
		url: '',
		category: 'Lending',
		chains: [],
		chainTvls: {},
		tvl: null,
		tvlPrevDay: null,
		tvlPrevWeek: null,
		tvlPrevMonth: null,
		mcap: null,
		listedAt: 1,
		defillamaId: name,
		extraTvl: {},
		change_1d: null,
		change_7d: null,
		change_1m: null,
		mcaptvl: null
	}
}

describe('Potential Airdrops funding export', () => {
	test('sorts and exports disclosed subtotals with unknown-round counts, preserving zero', () => {
		const table = constructTestTable({
			features: tableFeaturesConfig,
			data: [
				row('Unknown', { totalUsd: null, undisclosedCount: 2 }),
				row('Partial', { totalUsd: 16_500_000, undisclosedCount: 1 }),
				row('Zero', { totalUsd: 0, undisclosedCount: 0 })
			],
			columns: airdropsColumns,
			state: { sorting: [{ id: 'totalRaised', desc: true }] },
			defaultColumn: { sortUndefined: 'last' },
			renderFallbackValue: null
		})
		const csv = prepareTableCsv({ instance: table, filename: 'airdrops' })
		const header = csv.rows[0]!
		const amountIndex = header.indexOf('Disclosed Money Raised')
		const countIndex = header.indexOf('Undisclosed Funding Rounds')
		expect(csv.rows.slice(1).map((cells) => [cells[amountIndex], cells[countIndex]])).toEqual([
			[16_500_000, 1],
			[0, 0],
			['', 2]
		])
	})
})
