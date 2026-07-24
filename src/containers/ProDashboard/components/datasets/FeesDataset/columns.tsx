import type { ColumnDef } from '@tanstack/react-table'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/server/datasets'
import { PercentChange } from '~/ui/PercentChange'
import { formatUsd } from '~/utils/numberFormat'
import { percentageSortingFn } from '../../../utils/tableSorting'

export const feesDatasetColumns: ColumnDef<DimensionDatasetProtocol>[] = [
	{
		header: 'Name',
		id: 'name',
		accessorFn: (row) => row.displayName || row.name,
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const index = row.index
			const name = getValue() as string
			return (
				<span className="relative flex items-center gap-2 pl-6">
					<span className="shrink-0">{index + 1}</span>
					<TokenLogo size={20} src={row.original.logo} alt={`Logo of ${name}`} data-lgonly />
					<BasicLink href={`/fees/${row.original.slug}`} className="truncate text-sm font-medium text-link">
						{name}
					</BasicLink>
				</span>
			)
		},
		size: 280
	},
	{
		header: 'Category',
		accessorKey: 'category',
		cell: ({ getValue }) => {
			const value = getValue() as string
			return <span className="text-sm text-pro-text-secondary">{value || '-'}</span>
		},
		size: 120
	},
	{
		header: '24h Fees',
		accessorKey: 'total24h',
		cell: ({ getValue }) => {
			const value = getValue() as number
			return <>{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
		},
		size: 145,
		meta: {
			align: 'end'
		}
	},
	{
		header: '7d Fees',
		accessorKey: 'total7d',
		cell: ({ getValue }) => {
			const value = getValue() as number
			return <>{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
		},
		size: 120,
		meta: {
			align: 'end'
		}
	},
	{
		header: '30d Fees',
		accessorKey: 'total30d',
		cell: ({ getValue }) => {
			const value = getValue() as number
			return <>{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
		},
		size: 120,
		meta: {
			align: 'end'
		}
	},
	{
		header: '24h Change',
		accessorKey: 'change_1d',
		size: 100,
		sortUndefined: 'last',
		sortingFn: percentageSortingFn,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className={` ${value > 0 ? 'text-success' : value < 0 ? 'text-error' : 'text-pro-text-secondary'}`}>
					{value ? <PercentChange percent={value} fontWeight={100} /> : '-'}
				</span>
			)
		},
		meta: {
			align: 'end'
		}
	},
	{
		header: '7d Change',
		accessorKey: 'change_7d',
		size: 100,
		sortUndefined: 'last',
		sortingFn: percentageSortingFn,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className={` ${value > 0 ? 'text-success' : value < 0 ? 'text-error' : 'text-pro-text-secondary'}`}>
					{value ? <PercentChange percent={value} fontWeight={100} /> : '-'}
				</span>
			)
		},
		meta: {
			align: 'end'
		}
	}
]
