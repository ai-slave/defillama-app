import type { ColumnDef } from '@tanstack/react-table'
import type { CexAnalyticsSnapshotRow } from '~/containers/Cexs/api.types'
import { formatPercent, formatRatio, formatUsd } from '~/utils/numberFormat'

const renderRatio = (value: number | null, suffix = 'x') => {
	const formatted = formatRatio(value)
	return formatted == null ? (
		<span className="text-pro-text-tertiary">-</span>
	) : (
		<span>
			{formatted}
			{suffix}
		</span>
	)
}

const renderPercent = (value: number | null) => {
	const formatted = formatPercent(value, { input: 'percent' })
	return formatted == null ? <span className="text-pro-text-tertiary">-</span> : <span>{formatted}</span>
}

const renderCurrency = (value: number | null) => {
	const formatted = formatUsd(value)
	return formatted == null ? <span className="text-pro-text-tertiary">-</span> : <>{formatted}</>
}

export const cexAnalyticsColumns: ColumnDef<CexAnalyticsSnapshotRow>[] = [
	{
		header: 'CEX',
		id: 'venue',
		accessorFn: (row) => row.venue,
		enableSorting: false,
		size: 280,
		cell: ({ getValue, row }) => (
			<span className="relative flex items-center gap-2 pl-6">
				<span className="shrink-0">{row.index + 1}</span>
				<span className="truncate text-sm font-medium">{getValue() as string}</span>
			</span>
		)
	},
	{
		header: 'Spot 24h',
		accessorKey: 'spotVolume24h',
		size: 140,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderCurrency(getValue() as number)
	},
	{
		header: 'Derivatives 24h',
		accessorKey: 'derivativesVolume24h',
		size: 150,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderCurrency(getValue() as number)
	},
	{
		header: 'Spot Share',
		accessorKey: 'spotShare',
		size: 110,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderPercent(getValue() as number)
	},
	{
		header: 'Derivatives Share',
		accessorKey: 'derivativesShare',
		size: 140,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderPercent(getValue() as number)
	},
	{
		header: 'Derivatives / Spot',
		accessorKey: 'derivativesToSpotRatio',
		size: 145,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderRatio(getValue() as number | null)
	},
	{
		header: 'Open Interest',
		accessorKey: 'openInterest',
		size: 135,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderCurrency(getValue() as number | null)
	},
	{
		header: 'Avg Leverage',
		accessorKey: 'avgLeverage',
		size: 120,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderRatio(getValue() as number | null)
	},
	{
		header: 'Clean TVL',
		accessorKey: 'cleanTvl',
		size: 120,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderCurrency(getValue() as number | null)
	},
	{
		header: 'Volume / TVL',
		accessorKey: 'volumeToTvl',
		size: 120,
		meta: { align: 'end' },
		cell: ({ getValue }) => renderRatio(getValue() as number | null)
	}
]
