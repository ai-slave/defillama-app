import type { ColumnDef } from '@tanstack/react-table'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { TokenLogo } from '~/components/TokenLogo'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { PercentChange } from '~/ui/PercentChange'
import {
	formatRatio,
	formatUsd,
	formatCompactNumber,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'

const renderChange = (value: number | null) => (
	<span
		className={`${value != null && value > 0 ? 'text-success' : value != null && value < 0 ? 'text-error' : 'text-pro-text-secondary'}`}
	>
		{value == null ? '-' : <PercentChange percent={value} fontWeight={100} />}
	</span>
)

export const chainsDatasetColumns: Array<ColumnDef<ChainsDatasetRow>> = [
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
		id: 'protocols',
		accessorFn: (row) => row.protocols ?? undefined,
		size: 100,
		cell: ({ row }) => <span className="text-pro-text-primary">{row.original.protocols}</span>
	},
	{
		header: 'Active Addresses',
		id: 'users',
		accessorFn: (row) => row.users ?? undefined,
		size: 130,
		cell: ({ row }) => (
			<span className="text-pro-text-primary">
				{row.original.users == null ? '-' : formatCompactNumber(row.original.users, NUMBER_LOWERCASE_MILLIONS_OPTIONS)}
			</span>
		)
	},
	{
		header: '1d Change',
		id: 'change_1d',
		accessorFn: (row) => row.change_1d ?? undefined,
		size: 90,
		cell: ({ row }) => renderChange(row.original.change_1d)
	},
	{
		header: '7d Change',
		id: 'change_7d',
		accessorFn: (row) => row.change_7d ?? undefined,
		size: 90,
		cell: ({ row }) => renderChange(row.original.change_7d)
	},
	{
		header: '1m Change',
		id: 'change_1m',
		accessorFn: (row) => row.change_1m ?? undefined,
		size: 90,
		cell: ({ row }) => renderChange(row.original.change_1m)
	},
	{
		header: 'DeFi TVL',
		id: 'tvl',
		accessorFn: (row) => row.tvl ?? undefined,
		size: 140,
		cell: ({ row }) => (
			<span className="text-pro-text-primary">
				{formatUsd(row.original.tvl, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: 'Bridged TVL',
		id: 'bridgedTvl',
		accessorFn: (row) => row.bridgedTvl ?? undefined,
		size: 120,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.bridgedTvl, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: 'Stables',
		id: 'stablesMcap',
		accessorFn: (row) => row.stablesMcap ?? undefined,
		size: 120,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.stablesMcap, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: '24h DEXs Volume',
		id: 'totalVolume24h',
		accessorFn: (row) => row.totalVolume24h ?? undefined,
		size: 150,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.totalVolume24h, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: '30d DEXs Volume',
		id: 'totalVolume30d',
		accessorFn: (row) => row.totalVolume30d ?? undefined,
		size: 150,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.totalVolume30d, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: '24h Chain Fees',
		id: 'totalFees24h',
		accessorFn: (row) => row.totalFees24h ?? undefined,
		size: 130,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.totalFees24h, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: '30d Chain Fees',
		id: 'totalFees30d',
		accessorFn: (row) => row.totalFees30d ?? undefined,
		size: 130,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.totalFees30d, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: '24h App Revenue',
		id: 'totalAppRevenue24h',
		accessorFn: (row) => row.totalAppRevenue24h ?? undefined,
		size: 120,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.totalAppRevenue24h, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: '30d App Revenue',
		id: 'totalAppRevenue30d',
		accessorFn: (row) => row.totalAppRevenue30d ?? undefined,
		size: 140,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.totalAppRevenue30d, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: '30d Chain Revenue',
		id: 'totalRevenue30d',
		accessorFn: (row) => row.totalRevenue30d ?? undefined,
		size: 140,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.totalRevenue30d, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: 'Mcap / DeFi TVL',
		id: 'mcaptvl',
		accessorFn: (row) => row.mcaptvl ?? undefined,
		size: 120,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{row.original.mcaptvl == null ? '-' : formatRatio(row.original.mcaptvl)}
			</span>
		)
	},
	{
		header: 'Market Cap',
		id: 'mcap',
		accessorFn: (row) => row.mcap ?? undefined,
		size: 140,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.mcap, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	},
	{
		header: 'NFT Volume',
		id: 'nftVolume',
		accessorFn: (row) => row.nftVolume ?? undefined,
		size: 120,
		cell: ({ row }) => (
			<span className="text-pro-text-secondary">
				{formatUsd(row.original.nftVolume, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}
			</span>
		)
	}
]
