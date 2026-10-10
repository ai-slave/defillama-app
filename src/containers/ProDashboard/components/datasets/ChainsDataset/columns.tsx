import type { ColumnDef } from '@tanstack/react-table'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { TokenLogo } from '~/components/TokenLogo'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { Change } from '~/ui/Change'
import {
	formatCompactNumber,
	formatRatio,
	formatUsd,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import type { tableFeaturesConfig } from './index'

const renderChange = (value: number | null) => (
	<span className="text-secondary">{value == null ? '-' : <Change value={value} />}</span>
)

type UsdColumnKey =
	| 'bridgedTvl'
	| 'stablesMcap'
	| 'totalVolume24h'
	| 'totalVolume30d'
	| 'totalFees24h'
	| 'totalFees30d'
	| 'totalAppRevenue24h'
	| 'totalAppRevenue30d'
	| 'totalRevenue30d'
	| 'mcap'

// The secondary money columns differ only in header, field and width.
const usdColumn = (
	header: string,
	id: UsdColumnKey,
	size: number
): ColumnDef<typeof tableFeaturesConfig, ChainsDatasetRow> => ({
	header,
	id,
	accessorFn: (row) => row[id] ?? undefined,
	size,
	cell: ({ row }) => (
		<span className="text-secondary">{formatUsd(row.original[id], USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}</span>
	)
})

export const chainsDatasetColumns: Array<ColumnDef<typeof tableFeaturesConfig, ChainsDatasetRow>> = [
	{
		header: 'Chain',
		id: 'name',
		accessorKey: 'name',
		size: 200,
		cell: ({ row }) => {
			return (
				<div className="flex items-center gap-2">
					<TokenLogo name={row.original.name} kind="chain" alt={`Logo of ${row.original.name}`} size={24} />
					<span className="font-medium text-primary">{row.original.name}</span>
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
		cell: ({ row }) => <span className="text-primary">{row.original.protocols}</span>
	},
	{
		header: 'Active Addresses',
		id: 'users',
		accessorFn: (row) => row.users ?? undefined,
		size: 130,
		cell: ({ row }) => (
			<span className="text-primary">
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
			<span className="text-primary">{formatUsd(row.original.tvl, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '-'}</span>
		)
	},
	usdColumn('Bridged TVL', 'bridgedTvl', 120),
	usdColumn('Stables', 'stablesMcap', 120),
	usdColumn('24h DEXs Volume', 'totalVolume24h', 150),
	usdColumn('30d DEXs Volume', 'totalVolume30d', 150),
	usdColumn('24h Chain Fees', 'totalFees24h', 130),
	usdColumn('30d Chain Fees', 'totalFees30d', 130),
	usdColumn('24h App Revenue', 'totalAppRevenue24h', 120),
	usdColumn('30d App Revenue', 'totalAppRevenue30d', 140),
	usdColumn('30d Chain Revenue', 'totalRevenue30d', 140),
	{
		header: 'Mcap / DeFi TVL',
		id: 'mcaptvl',
		accessorFn: (row) => row.mcaptvl ?? undefined,
		size: 120,
		cell: ({ row }) => (
			<span className="text-secondary">{row.original.mcaptvl == null ? '-' : formatRatio(row.original.mcaptvl)}</span>
		)
	},
	usdColumn('Market Cap', 'mcap', 140)
]
