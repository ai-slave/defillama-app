import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { Select } from '~/components/Select/Select'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { formatUsd } from '~/utils/numberFormat'
import type { IProtocolTotalValueLostInHacksByProtocol } from './types'

type ProtocolRow = IProtocolTotalValueLostInHacksByProtocol['protocols'][number]
const columnHelper = createColumnHelper<SearchTableFeatures, ProtocolRow>()

const DEFAULT_SORTING_STATE = [{ id: 'Net User Loss', desc: true }]

const columns = columnHelper.columns([
	columnHelper.accessor((row) => row.name, {
		id: 'Name',
		header: 'Name',
		cell: ({ row, getValue }) => {
			const name = getValue()
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo name={row.original.slug} kind="token" data-lgonly alt={`Logo of ${row.original.slug}`} />

					{row.original.route ? (
						<BasicLink href={row.original.route} className="truncate text-sm font-medium text-link hover:underline">
							{name}
						</BasicLink>
					) : (
						<span className="truncate text-sm font-medium">{name}</span>
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

const columnIds: Array<string> = columns.map((c) => c.id).filter((id): id is string => id != null)

export function TotalValueLostContainer({ protocols }: IProtocolTotalValueLostInHacksByProtocol) {
	const [selectedColumns, setSelectedColumns] = React.useState<Array<string>>([
		'Name',
		'Total Hacked',
		'Returned Funds',
		'Net User Loss'
	])

	const filteredColumns = React.useMemo(() => {
		return columns.filter((c) => c.id != null && selectedColumns.includes(c.id))
	}, [selectedColumns])

	return (
		<TableWithSearch
			data={protocols}
			columns={filteredColumns}
			placeholder="Search..."
			columnToSearch="Name"
			header="Total Value Lost in Hacks"
			headingAs="h1"
			compact
			customFilters={() => (
				<Select
					allValues={columnIds}
					selectedValues={selectedColumns}
					setSelectedValues={setSelectedColumns}
					label="Columns"
					labelType="smol"
					variant="filter-responsive"
					size="md"
				/>
			)}
			csvFileName="total-value-lost-in-hacks"
			initialSorting={DEFAULT_SORTING_STATE}
		/>
	)
}
