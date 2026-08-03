import type { ColumnDef } from '@tanstack/react-table'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { TokenLogo } from '~/components/TokenLogo'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { PercentChange } from '~/ui/PercentChange'
import { formatRatio, formatUsd, formatCompactNumber } from '~/utils/numberFormat'

const formatNullableUsd = (value: number | null) =>
	value == null ? '-' : formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })

const renderChange = (value: number | null) => (
	<span
		className={`${value != null && value > 0 ? 'text-success' : value != null && value < 0 ? 'text-error' : 'text-pro-text-secondary'}`}
	>
		{value == null ? '-' : <PercentChange percent={value} fontWeight={100} />}
	</span>
)

export const chainsDatasetColumns: ColumnDef<ChainsDatasetRow>[] = [
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
		cell: ({ row }) => <span className="text-pro-text-primary">{row.original.protocols}</span>
	},
	{
		header: 'Active Addresses',
		accessorKey: 'users',
		size: 130,
		cell: ({ row }) => (
			<span className="text-pro-text-primary">
				{row.original.users == null
					? '-'
					: formatCompactNumber(row.original.users, {
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
			</span>
		)
	},
	{
		header: '1d Change',
		accessorKey: 'change_1d',
		size: 90,
		cell: ({ row }) => renderChange(row.original.change_1d)
	},
	{
		header: '7d Change',
		accessorKey: 'change_7d',
		size: 90,
		cell: ({ row }) => renderChange(row.original.change_7d)
	},
	{
		header: '1m Change',
		accessorKey: 'change_1m',
		size: 90,
		cell: ({ row }) => renderChange(row.original.change_1m)
	},
	{
		header: 'DeFi TVL',
		accessorKey: 'tvl',
		size: 140,
		cell: ({ row }) => <span className="text-pro-text-primary">{formatNullableUsd(row.original.tvl)}</span>
	},
	{
		header: 'Bridged TVL',
		accessorKey: 'bridgedTvl',
		size: 120,
		cell: ({ row }) => <span className="text-pro-text-secondary">{formatNullableUsd(row.original.bridgedTvl)}</span>
	},
	{
		header: 'Stables',
		accessorKey: 'stablesMcap',
		size: 120,
		cell: ({ row }) => <span className="text-pro-text-secondary">{formatNullableUsd(row.original.stablesMcap)}</span>
	},
	{
		header: '24h DEXs Volume',
		accessorKey: 'totalVolume24h',
		size: 150,
		cell: ({ row }) => <span className="text-pro-text-secondary">{formatNullableUsd(row.original.totalVolume24h)}</span>
	},
	{
		header: '30d DEXs Volume',
		accessorKey: 'totalVolume30d',
		size: 150,
		cell: ({ row }) => <span className="text-pro-text-secondary">{formatNullableUsd(row.original.totalVolume30d)}</span>
	},
	{
		header: '24h Chain Fees',
		accessorKey: 'totalFees24h',
		size: 130,
		cell: ({ row }) => <span className="text-pro-text-secondary">{formatNullableUsd(row.original.totalFees24h)}</span>
	},
	{
		header: '30d Chain Fees',
		accessorKey: 'totalFees30d',
		size: 130,
		cell: ({ row }) => <span className="text-pro-text-secondary">{formatNullableUsd(row.original.totalFees30d)}</span>
	},
	{
		header: '24h App Revenue',
		accessorKey: 'totalAppRevenue24h',
		size: 120,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">{formatNullableUsd(row.original.totalAppRevenue24h)}</span>
		)
	},
	{
		header: '30d App Revenue',
		accessorKey: 'totalAppRevenue30d',
		size: 140,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">{formatNullableUsd(row.original.totalAppRevenue30d)}</span>
		)
	},
	{
		header: '30d Chain Revenue',
		accessorKey: 'totalRevenue30d',
		size: 140,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">{formatNullableUsd(row.original.totalRevenue30d)}</span>
		)
	},
	{
		header: 'Mcap / DeFi TVL',
		accessorKey: 'mcaptvl',
		size: 120,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{row.original.mcaptvl == null ? '-' : formatRatio(row.original.mcaptvl)}
			</span>
		)
	},
	{
		header: 'Market Cap',
		accessorKey: 'mcap',
		size: 140,
		cell: ({ row }) => <span className="text-pro-text-secondary">{formatNullableUsd(row.original.mcap)}</span>
	},
	{
		header: 'NFT Volume',
		accessorKey: 'nftVolume',
		size: 120,
		cell: ({ row }) => <span className="text-pro-text-secondary">{formatNullableUsd(row.original.nftVolume)}</span>
	}
]
