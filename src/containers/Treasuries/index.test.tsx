import { describe, expect, test } from 'vitest'
import type { RawTreasuryProtocol } from './api.types'
import { treasuryTableColumns } from './index'
import { buildNetProjectTreasuryRows, buildTreasuryRows } from './queries'
import type { ITreasuryRow } from './types'

const row: ITreasuryRow = {
	name: 'Example',
	logo: '',
	protocolHref: '/protocol/example?treasury=true&tvl=false',
	tokenBreakdowns: { stablecoins: 1, majors: 2, ownTokens: 3, others: 4 },
	coreTvl: 7,
	totalTvl: 10,
	mcap: 0
}

function treasury(overrides: Partial<RawTreasuryProtocol> = {}): RawTreasuryProtocol {
	return {
		id: '10-treasury',
		name: 'Example (treasury)',
		logo: 'https://icons.llama.fi/example.jpg',
		slug: 'example-(treasury)',
		tvl: 60,
		chainTvls: { OwnTokens: 40 },
		tokenBreakdowns: { stablecoins: 10, majors: 20, ownTokens: 40, others: 30 },
		mcap: 0,
		...overrides
	}
}

describe('treasury table columns', () => {
	const columnIds = (entity: boolean) =>
		treasuryTableColumns(entity).map((column) => column.id ?? ('accessorKey' in column ? column.accessorKey : ''))

	test('keeps protocol-only metrics out of entity treasuries', () => {
		for (const id of ['ownTokens', 'coreTvl', 'mcap']) {
			expect(columnIds(true)).not.toContain(id)
			expect(columnIds(false)).toContain(id)
		}
		expect(columnIds(true)).toContain('tvl')
	})

	test('leaves a zero market cap blank rather than showing $0', () => {
		const mcap = treasuryTableColumns(false).find((column) => column.id === 'mcap')
		if (!mcap || !('accessorFn' in mcap) || !mcap.accessorFn) throw new Error('Missing Mcap accessor')

		expect(mcap.accessorFn(row, 0)).toBeUndefined()
		expect(mcap.accessorFn({ ...row, mcap: 5 }, 0)).toBe(5)
	})
})

describe('Treasury page data', () => {
	test('projects exact producer fields and separates Treasury links from Entity presentation', () => {
		const source = treasury()
		const treasuryRow = buildTreasuryRows([source], true)[0]
		const entityRow = buildTreasuryRows([source], false)[0]

		expect(treasuryRow).toEqual({
			name: 'Example',
			logo: source.logo,
			protocolHref: '/protocol/example?treasury=true&tvl=false',
			tokenBreakdowns: source.tokenBreakdowns,
			coreTvl: 60,
			totalTvl: 100,
			mcap: 0
		})
		expect(entityRow?.protocolHref).toBeNull()
	})

	test('removes only terminal Treasury suffixes and sorts by default TVL', () => {
		const rows = buildTreasuryRows(
			[
				treasury({ name: 'Internal (treasury) Label', slug: 'internal-(treasury)-label', tvl: 1 }),
				treasury({ id: '11-treasury', name: 'Largest (treasury)', slug: 'largest-(treasury)', tvl: 2 })
			],
			true
		)

		expect(rows.map((item) => [item.name, item.protocolHref])).toEqual([
			['Largest', '/protocol/largest?treasury=true&tvl=false'],
			['Internal (treasury) Label', '/protocol/internal-(treasury)-label?treasury=true&tvl=false']
		])
	})

	test('treats omitted and explicit-zero OwnTokens as zero without changing signed breakdowns', () => {
		const [omitted, explicit] = buildTreasuryRows(
			[
				treasury({
					id: '12-treasury',
					chainTvls: {},
					tokenBreakdowns: { stablecoins: 10, majors: -5, ownTokens: 0, others: 2 }
				}),
				treasury({ id: '13-treasury', chainTvls: { OwnTokens: 0 } })
			],
			true
		)

		expect(omitted?.totalTvl).toBe(60)
		expect(explicit?.totalTvl).toBe(60)
		expect(omitted?.tokenBreakdowns.majors).toBe(-5)
	})

	test('keeps the exact three-field Net Treasury sum and producer route identity', () => {
		const rows = buildNetProjectTreasuryRows([
			treasury({ tokenBreakdowns: { stablecoins: 10, majors: 20, ownTokens: 1000, others: 30 } }),
			treasury({
				id: '11-treasury',
				name: 'Excluded (treasury)',
				slug: 'excluded-(treasury)',
				tokenBreakdowns: { stablecoins: -10, majors: 0, ownTokens: 1000, others: 10 }
			})
		])

		expect(rows).toEqual([
			{
				name: 'Example',
				logo: 'https://icons.llama.fi/example.jpg',
				slug: 'example',
				netTreasury: 60
			}
		])
	})
})
