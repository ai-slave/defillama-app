import { createColumnHelper } from '@tanstack/react-table'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { TextLink } from '~/ui/TextLink'
import { formatUsd } from '~/utils/numberFormat'
import type { IProtocolTotalValueLostInHacksByProtocol } from './types'

type ProtocolRow = IProtocolTotalValueLostInHacksByProtocol['protocols'][number]
const columnHelper = createColumnHelper<SearchTableFeatures, ProtocolRow>()

const DEFAULT_SORTING_STATE = [{ id: 'Net User Loss', desc: true }]

const columns = columnHelper.columns([
	columnHelper.accessor((row) => row.name, {
		id: 'Name',
		enableHiding: false,
		header: 'Name',
		cell: ({ row, getValue }) => {
			const name = getValue()
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo name={row.original.slug} kind="token" data-lgonly alt={`Logo of ${row.original.slug}`} />

					{row.original.route ? (
						<TextLink href={row.original.route} truncate>
							{name}
						</TextLink>
					) : (
						<span className="truncate label-md">{name}</span>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.totalHackedUsd ?? undefined, {
		id: 'Total Hacked',
		header: 'Total Hacked',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[130px]',
			align: 'center'
		}
	}),
	columnHelper.accessor((row) => row.returnedFundsUsd ?? undefined, {
		id: 'Returned Funds',
		header: 'Returned Funds',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[150px]',
			align: 'center'
		}
	}),
	columnHelper.accessor((row) => row.totalHackedUsd - row.returnedFundsUsd, {
		id: 'Net User Loss',
		header: 'Net User Loss',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[140px]',
			align: 'center',
			headerHelperText: 'Total Hacked - Returned Funds'
		}
	})
])

export function TotalValueLostContainer({ protocols }: IProtocolTotalValueLostInHacksByProtocol) {
	return (
		<SearchTableProvider options={{ data: protocols, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}>
			<Card padding="none">
				<PanelHeader>
					<PanelTitle as="h1" className="whitespace-nowrap">
						Total value lost in hacks
					</PanelTitle>
					<TableSearchInput columnId="Name" placeholder="Search…" width="inline" />
					<TableColumnSelect />
					<TableCsvExport filename="total-value-lost-in-hacks" />
				</PanelHeader>
				<VirtualSearchTableView compact />
			</Card>
		</SearchTableProvider>
	)
}
