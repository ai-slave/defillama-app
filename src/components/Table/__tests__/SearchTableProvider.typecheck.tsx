import { createColumnHelper } from '@tanstack/react-table'
import type { ComponentProps } from 'react'
import type { PairTable } from '~/containers/Exchanges/PairTable'
import { formatNumber } from '~/utils/numberFormat'
import { searchTableFeatures } from '../features/search'
import { SearchTableProvider } from '../search/SearchTableProvider'
import { SearchTableView } from '../search/SearchTableView'
const features = searchTableFeatures

interface TestRow {
	name: string
	amount: number
	tags: Array<string>
}

const columnHelper = createColumnHelper<typeof features, TestRow>()
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

function assertExplicitRowType() {
	return (
		<SearchTableProvider<TestRow> options={{ data: [], columns }}>
			<SearchTableView />
		</SearchTableProvider>
	)
}
void assertExplicitRowType

function assertInferredRowType() {
	const data: Array<TestRow> = []
	const table = (
		<SearchTableProvider options={{ data, columns }}>
			<SearchTableView />
		</SearchTableProvider>
	)
	void table

	const invalid = (
		// @ts-expect-error These columns require a numeric amount without an explicit row generic.
		<SearchTableProvider options={{ columns, data: [{ name: 'Invalid', amount: 'wrong', tags: [] }] }}>
			<SearchTableView />
		</SearchTableProvider>
	)
	void invalid
}

function assertPairTableLayoutContract() {
	type Props = ComponentProps<typeof PairTable>
	const common = {
		pairs: [],
		segment: 'spot' as const,
		capabilities: { openInterest: false, funding: false, depth: false },
		csvFileName: 'pairs'
	}
	const defaults: Props = { ...common, header: 'Markets', placeholder: 'Search pairs' }
	const composed: Props = { ...common, children: <div>Custom controls</div> }
	// @ts-expect-error A custom layout would silently ignore the default heading.
	const ignoredHeading: Props = { ...composed, header: 'Ignored' }
	// @ts-expect-error A custom layout owns its search input.
	const ignoredSearch: Props = { ...composed, columnToSearch: 'pair' }
	// @ts-expect-error Default toolbar controls cannot be combined with custom children.
	const ignoredControls: Props = { ...composed, leadingControls: <button type="button">Ignored</button> }
	void defaults
	void composed
	void ignoredHeading
	void ignoredSearch
	void ignoredControls
}

void assertInferredRowType
void assertPairTableLayoutContract
