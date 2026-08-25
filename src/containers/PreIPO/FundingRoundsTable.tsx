import { createColumnHelper } from '@tanstack/react-table'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import type { PreIpoRaise } from './api.types'

function formatMoney(value: number | null | undefined): string {
	return (
		formatUsd(value, {
			compact: true,
			minimumCompactValue: 1_000_000,
			maximumFractionDigits: 2
		}) ?? '-'
	)
}

const columnHelper = createColumnHelper<PreIpoRaise>()
const DEFAULT_SORTING = [
	{ id: 'date', desc: true },
	{ id: 'amountRaised', desc: true }
]
const columns = [
	columnHelper.accessor('date', {
		header: 'Date',
		cell: ({ getValue }) => formatDate(getValue()) ?? '-',
		meta: { headerClassName: 'w-[130px]', align: 'start' }
	}),
	columnHelper.accessor('series', {
		header: 'Round',
		enableSorting: false,
		meta: { headerClassName: 'w-[180px]', align: 'start' }
	}),
	columnHelper.accessor((row) => row.amountRaised ?? undefined, {
		id: 'amountRaised',
		header: 'Amount Raised',
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: { headerClassName: 'w-[150px]', align: 'end' }
	}),
	columnHelper.accessor((row) => row.valuation ?? undefined, {
		id: 'valuation',
		header: 'Round Valuation',
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: { headerClassName: 'w-[160px]', align: 'end' }
	})
]

export function FundingRoundsTable({ companyName, raises }: { companyName: string; raises: PreIpoRaise[] }) {
	if (raises.length === 0) {
		return (
			<Panel padding="none">
				<PanelHeader>
					<PanelTitle>Funding Rounds</PanelTitle>
				</PanelHeader>
				<p className="p-8 text-center body-md text-secondary">No funding rounds available.</p>
			</Panel>
		)
	}

	return (
		<TableWithSearch
			data={raises}
			columns={columns}
			header="Funding Rounds"
			placeholder="Search rounds..."
			columnToSearch="series"
			csvFileName={`${companyName}-funding-rounds`}
			sortingState={DEFAULT_SORTING}
			skipVirtualization
		/>
	)
}
