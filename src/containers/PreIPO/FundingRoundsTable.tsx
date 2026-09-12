import { createColumnHelper } from '@tanstack/react-table'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import type { PreIpoRaise } from './api.types'
import { PRE_IPO_USD_OPTIONS } from './constants'
import { preIpoDefinitions } from './definitions'

const columnHelper = createColumnHelper<SearchTableFeatures, PreIpoRaise>()
const DEFAULT_SORTING = [
	{ id: 'date', desc: true },
	{ id: 'amountRaised', desc: true }
]
const columns = columnHelper.columns([
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
		header: preIpoDefinitions.fundingRound.amountRaised.label,
		cell: ({ getValue }) => formatUsd(getValue(), PRE_IPO_USD_OPTIONS) ?? '-',
		meta: {
			headerClassName: 'w-[150px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.fundingRound.amountRaised.description
		}
	}),
	columnHelper.accessor((row) => row.valuation ?? undefined, {
		id: 'valuation',
		header: preIpoDefinitions.fundingRound.valuation.label,
		cell: ({ getValue }) => formatUsd(getValue(), PRE_IPO_USD_OPTIONS) ?? '-',
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: preIpoDefinitions.fundingRound.valuation.description
		}
	})
])

export function FundingRoundsTable({ companyName, raises }: { companyName: string; raises: Array<PreIpoRaise> }) {
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
			initialSorting={DEFAULT_SORTING}
			skipVirtualization
		/>
	)
}
