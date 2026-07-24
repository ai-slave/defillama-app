import type { ColumnDef } from '@tanstack/react-table'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { TokenLogo } from '~/components/TokenLogo'
import { PercentChange } from '~/ui/PercentChange'
import { formatRatio, formatUsd, formatCompactNumber } from '~/utils/numberFormat'

export const chainsDatasetColumns: ColumnDef<any>[] = [
	{
		header: 'Chain',
		accessorKey: 'name',
		size: 200,
		enableGlobalFilter: true,
		cell: ({ row }) => {
			return (
				<div className="flex items-center gap-2">
					<TokenLogo name={row.original.name} kind="chain" alt={`Logo of ${row.original.name}`} size={24} />
					<span className="font-medium text-pro-text-primary">{row.original.name}</span>
					{row.original.deprecated ? <DeprecatedEntityMarker content="Deprecated chain" /> : null}
				</div>
			)
		}
	},
	{
		header: 'Protocols',
		accessorKey: 'protocols',
		size: 100,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return <span className="text-pro-text-primary">{value || 0}</span>
		}
	},
	{
		header: 'Active Addresses',
		accessorKey: 'users',
		size: 130,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-primary">
					{value ? formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }) : ''}
				</span>
			)
		}
	},
	{
		header: '1d Change',
		accessorKey: 'change_1d',
		size: 90,
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
		size: 90,
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
		header: '1m Change',
		accessorKey: 'change_1m',
		size: 90,
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
		header: 'DeFi TVL',
		accessorKey: 'tvl',
		size: 140,
		cell: ({ getValue }) => (
			<span className="text-pro-text-primary">
				{formatUsd(getValue() as number, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
		)
	},
	{
		header: 'Bridged TVL',
		accessorKey: 'bridgedTvl',
		size: 120,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: 'Stables',
		accessorKey: 'stablesMcap',
		size: 120,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: '24h DEXs Volume',
		accessorKey: 'totalVolume24h',
		size: 150,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: '30d DEXs Volume',
		accessorKey: 'totalVolume30d',
		size: 150,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: '24h Chain Fees',
		accessorKey: 'totalFees24h',
		size: 130,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: '30d Chain Fees',
		accessorKey: 'totalFees30d',
		size: 130,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: '24h App Revenue',
		accessorKey: 'totalAppRevenue24h',
		size: 120,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: '30d App Revenue',
		accessorKey: 'totalAppRevenue30d',
		size: 140,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: '30d Chain Revenue',
		accessorKey: 'totalRevenue30d',
		size: 140,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: 'Mcap / DeFi TVL',
		accessorKey: 'mcaptvl',
		size: 120,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return <span className="text-pro-text-secondary">{value ? formatRatio(value) : '-'}</span>
		}
	},
	{
		header: 'Market Cap',
		accessorKey: 'mcap',
		size: 140,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	},
	{
		header: 'NFT Volume',
		accessorKey: 'nftVolume',
		size: 120,
		cell: ({ getValue }) => {
			const value = getValue() as number
			return (
				<span className="text-pro-text-secondary">
					{value
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: '-'}
				</span>
			)
		}
	}
]
