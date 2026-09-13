import type { ColumnDef } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import type { RawTreasuryProtocol } from './api.types'
import { Treasuries } from './index'
import { buildNetProjectTreasuryRows, buildTreasuryRows } from './queries'
import type { ITreasuryRow } from './types'

const renderTable = vi.hoisted(() => vi.fn())
const renderCsv = vi.hoisted(() => vi.fn())

vi.mock('~/components/Table/search/SearchTableProvider', () => ({
	SearchTableProvider: ({
		options,
		children
	}: {
		options: { columns: Array<ColumnDef<SearchTableFeatures, ITreasuryRow>>; data: Array<ITreasuryRow> }
		children: React.ReactNode
	}) => {
		renderTable(options)
		return children
	}
}))
vi.mock('~/components/Table/search/TableCsvExport', () => ({
	TableCsvExport: ({ filename }: { filename: string }) => {
		renderCsv(filename)
		return null
	}
}))
vi.mock('~/components/Table/search/TableSearchInput', () => ({ TableSearchInput: () => null }))
vi.mock('~/components/Table/search/VirtualSearchTableView', () => ({ VirtualSearchTableView: () => null }))

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
	test('keeps protocol-only metrics out of entity treasuries after switching to accessor functions', () => {
		renderToStaticMarkup(<Treasuries data={[{ ...row, protocolHref: null }]} entity />)
		const entityTable = renderTable.mock.calls.at(-1)?.[0] as {
			columns: Array<ColumnDef<SearchTableFeatures, ITreasuryRow>>
			csvFileName: string
		}
		renderToStaticMarkup(<Treasuries data={[row]} entity={false} />)
		const protocolTable = renderTable.mock.calls.at(-1)?.[0] as {
			columns: Array<ColumnDef<SearchTableFeatures, ITreasuryRow>>
			csvFileName: string
		}
		const columnIds = (columns: Array<ColumnDef<SearchTableFeatures, ITreasuryRow>>) =>
			columns.map((column) => column.id ?? ('accessorKey' in column ? column.accessorKey : ''))
		const entityColumnIds = columnIds(entityTable.columns)
		const protocolColumnIds = columnIds(protocolTable.columns)
		for (const id of ['ownTokens', 'coreTvl', 'mcap']) {
			expect(entityColumnIds).not.toContain(id)
			expect(protocolColumnIds).toContain(id)
		}
		expect(entityColumnIds).toContain('tvl')
		expect(renderCsv.mock.calls.at(-2)?.[0]).toBe('entities')
		expect(renderCsv.mock.calls.at(-1)?.[0]).toBe('treasuries')

		const mcapColumn = protocolTable.columns.find((column) => column.id === 'mcap')
		if (!mcapColumn || !('accessorFn' in mcapColumn) || !mcapColumn.accessorFn) {
			throw new Error('Missing Mcap accessor')
		}
		expect(mcapColumn.accessorFn(row, 0)).toBeUndefined()
		expect(mcapColumn.accessorFn({ ...row, mcap: 5 }, 0)).toBe(5)
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
