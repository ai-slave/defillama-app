import type { ColumnDef } from '@tanstack/react-table'
import { TokenLogo } from '~/components/TokenLogo'
import { PercentChange } from '~/ui/PercentChange'
import { formatUsd } from '~/utils/numberFormat'

export const optionsDatasetColumns: ColumnDef<any>[] = [
	{
		header: 'Protocol',
		accessorKey: 'name',
		size: 280,
		enableGlobalFilter: true,
		cell: ({ row }) => {
			return (
				<div className="flex items-center gap-3">
					<TokenLogo src={row.original.logo} alt={`Logo of ${row.original.name}`} size={28} />
					<span className="font-medium text-pro-text-primary">{row.original.name}</span>
				</div>
			)
		}
	},

	{
		header: '24h Change',
		accessorKey: 'change_1d',
		size: 100,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className={`${value > 0 ? 'text-success' : value < 0 ? 'text-error' : 'text-pro-text-secondary'}`}>
					{value ? <PercentChange percent={value} fontWeight={100} /> : '-'}
				</span>
			)
		}
	},
	{
		header: '7d Change',
		accessorKey: 'change_7d',
		size: 100,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className={`${value > 0 ? 'text-success' : value < 0 ? 'text-error' : 'text-pro-text-secondary'}`}>
					{value ? <PercentChange percent={value} fontWeight={100} /> : '-'}
				</span>
			)
		}
	},
	{
		header: '24h Volume',
		accessorKey: 'total24h',
		size: 145,
		cell: ({ getValue }) => (
			<span className="text-pro-text-primary">
				{formatUsd(getValue() as number, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
		)
	},

	{
		header: '7d Volume',
		accessorKey: 'total7d',
		size: 120,
		cell: ({ getValue }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(getValue() as number, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
		)
	},
	{
		header: '30d Volume',
		accessorKey: 'total30d',
		size: 120,
		cell: ({ getValue }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(getValue() as number, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
		)
	},
	{
		header: '% of Total',
		accessorKey: 'dominance',
		size: 100,
		cell: ({ row, table }) => {
			const total24h = table.getFilteredRowModel().rows.reduce((sum, r) => sum + (r.original.total24h || 0), 0)
			const percentage = total24h > 0 ? (row.original.total24h / total24h) * 100 : 0
			return (
				<span className="text-pro-text-secondary">
					<PercentChange percent={percentage} noSign />
				</span>
			)
		}
	}
]
