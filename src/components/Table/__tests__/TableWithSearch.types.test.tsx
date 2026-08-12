import { createColumnHelper } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import { formatNumber } from '~/utils/numberFormat'
import { TableWithSearch } from '../TableWithSearch'

interface TestRow {
	name: string
	amount: number
	tags: string[]
}

const columnHelper = createColumnHelper<TestRow>()
const columns = [
	columnHelper.accessor('name', {
		header: 'Name',
		cell: (info) => info.getValue().toUpperCase(),
		meta: { headerClassName: 'w-[160px] min-w-[160px]' }
	}),
	columnHelper.accessor('amount', {
		header: 'Amount',
		cell: (info) => formatNumber(info.getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
		meta: { headerClassName: 'w-[120px] min-w-[120px]' }
	}),
	columnHelper.accessor((row) => row.tags.length, {
		id: 'tagCount',
		header: 'Tags',
		cell: (info) => info.getValue().toString(),
		meta: { headerClassName: 'w-[100px] min-w-[100px]' }
	}),
	columnHelper.display({
		id: 'actions',
		header: 'Actions',
		cell: () => null,
		meta: { headerClassName: 'w-[100px] min-w-[100px]' }
	})
]

describe('TableWithSearch column contract', () => {
	it('accepts heterogeneous createColumnHelper columns without erasing accessor value types', () => {
		const table = <TableWithSearch<TestRow> data={[]} columns={columns} csvFileName="test" />

		expect(table.props.columns).toBe(columns)
	})
})
