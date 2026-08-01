import { createTable, getCoreRowModel, getSortedRowModel, type TableState } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import type { IProtocolRow } from './proTable.types'
import { createNullableProtocolNumberColumn } from './useProTableColumns'

const protocolRow = (name: string, tvl: number | null): IProtocolRow => ({
	name,
	contributesTvl: tvl !== null,
	tvl,
	tvlPrevDay: tvl,
	tvlPrevWeek: tvl,
	tvlPrevMonth: tvl,
	mcap: null,
	chainTvls: {},
	change_1d: null,
	change_7d: null,
	change_1m: null,
	mcaptvl: null,
	chains: [],
	logo: null,
	url: '',
	defillamaId: name
})

const tableState = (desc: boolean): TableState => ({
	columnFilters: [],
	columnOrder: [],
	columnPinning: { left: [], right: [] },
	columnSizing: {},
	columnSizingInfo: {
		columnSizingStart: [],
		deltaOffset: null,
		deltaPercentage: null,
		isResizingColumn: false,
		startOffset: null,
		startSize: null
	},
	columnVisibility: {},
	expanded: {},
	globalFilter: undefined,
	grouping: [],
	pagination: { pageIndex: 0, pageSize: 10 },
	rowPinning: { top: [], bottom: [] },
	rowSelection: {},
	sorting: [{ id: 'tvl', desc }]
})

const sortByTvl = (desc: boolean): string[] => {
	const table = createTable<IProtocolRow>({
		columns: [createNullableProtocolNumberColumn('tvl', { header: 'TVL' })],
		data: [protocolRow('Unavailable', null), protocolRow('Positive', 10), protocolRow('Zero', 0)],
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onStateChange: () => undefined,
		renderFallbackValue: null,
		state: tableState(desc)
	})

	return table.getSortedRowModel().rows.map((row) => row.original.name)
}

describe('nullable Pro table numeric sorting', () => {
	it('keeps unavailable values last while sorting explicit zero as a number', () => {
		expect(sortByTvl(false)).toEqual(['Zero', 'Positive', 'Unavailable'])
		expect(sortByTvl(true)).toEqual(['Positive', 'Zero', 'Unavailable'])
	})
})
