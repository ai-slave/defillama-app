import { type ColumnDef, createColumnHelper, type VisibilityState } from '@tanstack/react-table'
import * as React from 'react'
import { TAG_GROUP_SIZES, TAG_GROUP_VARIANTS } from '~/components/Select/types'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { formattedNum } from '~/utils'
import { type Segment, segmentHasOi } from './segments'
import { ExchangeName, MaterialChangeCell, VenueBadge } from './shared'
import type { ExchangeListRow } from './types'
import { type MarketsTablePreset, useMarketsTablePreset } from './useMarketsTablePreset'
import { pctChange } from './utils'

const columnHelper = createColumnHelper<ExchangeListRow>()

const COLUMN_VISIBILITY: Record<MarketsTablePreset, VisibilityState> = {
	wide: {},
	compact: {
		share: false,
		oi_change_24h: false,
		market_count: false
	},
	mobile: {
		exchange_type: false,
		share: false,
		total_oi_usd: false,
		oi_change_24h: false,
		market_count: false
	}
}

function renderShare(value: number, total: number): string {
	return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '–'
}

function buildColumns(segment: Segment, totalVolume: number): ColumnDef<ExchangeListRow, any>[] {
	const hasOi = segmentHasOi(segment)

	const columns: ColumnDef<ExchangeListRow, any>[] = [
		columnHelper.accessor('exchange', {
			id: 'exchange',
			header: 'Exchange',
			enableSorting: false,
			cell: ({ getValue }) => <ExchangeName exchange={getValue()} />,
			meta: { headerClassName: 'w-[150px]' }
		}),
		columnHelper.accessor('exchange_type', {
			id: 'exchange_type',
			header: 'Venue',
			cell: ({ getValue }) => <VenueBadge type={getValue()} />,
			meta: { headerClassName: 'w-[80px]' }
		}),
		columnHelper.accessor('total_volume_24h', {
			id: 'total_volume_24h',
			header: '24h Volume',
			cell: ({ getValue }) => (getValue() == null ? '–' : formattedNum(getValue(), true)),
			meta: { headerClassName: 'w-[120px]', align: 'end' as const }
		}),
		columnHelper.accessor((row) => pctChange(row.total_volume_24h, row.total_volume_prev_24h) ?? undefined, {
			id: 'volume_change_24h',
			header: 'Vol Δ',
			cell: ({ row }) => (
				<MaterialChangeCell current={row.original.total_volume_24h} previous={row.original.total_volume_prev_24h} />
			),
			meta: { headerClassName: 'w-[100px]', align: 'end' }
		}),
		columnHelper.accessor('total_volume_24h', {
			id: 'share',
			header: 'Share',
			cell: ({ getValue }) => renderShare(getValue(), totalVolume),
			meta: {
				headerClassName: 'w-[90px]',
				align: 'end',
				headerHelperText: "Share of the segment's total 24h volume across venues"
			}
		})
	]

	if (hasOi) {
		columns.push(
			columnHelper.accessor((row) => row.total_oi_usd ?? undefined, {
				id: 'total_oi_usd',
				header: 'OI',
				cell: ({ row }) => (row.original.total_oi_usd == null ? '–' : formattedNum(row.original.total_oi_usd, true)),
				meta: { headerClassName: 'w-[120px]', align: 'end' as const }
			}),
			columnHelper.accessor((row) => pctChange(row.total_oi_usd, row.total_oi_prev_usd) ?? undefined, {
				id: 'oi_change_24h',
				header: 'OI Δ',
				cell: ({ row }) => (
					<MaterialChangeCell current={row.original.total_oi_usd} previous={row.original.total_oi_prev_usd} />
				),
				meta: { headerClassName: 'w-[100px]', align: 'end' }
			})
		)
	}

	columns.push(
		columnHelper.accessor('market_count', {
			id: 'market_count',
			header: 'Markets',
			cell: ({ getValue }) => getValue() ?? '–',
			meta: { headerClassName: 'w-[90px]', align: 'end' }
		})
	)

	return columns
}

type VenueFilter = 'all' | 'cex' | 'dex'

const VENUE_OPTIONS: ReadonlyArray<{ id: VenueFilter; label: string }> = [
	{ id: 'all', label: 'All' },
	{ id: 'cex', label: 'CEX' },
	{ id: 'dex', label: 'DEX' }
]

export function ExchangesTable({
	exchanges,
	segment,
	embedded = false
}: {
	exchanges: ExchangeListRow[]
	segment: Segment
	embedded?: boolean
}) {
	const preset = useMarketsTablePreset()
	const [venue, setVenue] = React.useState<VenueFilter>('all')

	const { rows, totalVolume } = React.useMemo(() => {
		const rows: ExchangeListRow[] = []
		let totalVolume = 0
		for (const exchange of exchanges) {
			if (exchange.total_volume_24h <= 0 || (venue !== 'all' && exchange.exchange_type !== venue)) continue
			rows.push(exchange)
			totalVolume += exchange.total_volume_24h
		}
		rows.sort((a, b) => b.total_volume_24h - a.total_volume_24h)
		return { rows, totalVolume }
	}, [exchanges, venue])
	const columns = React.useMemo(() => buildColumns(segment, totalVolume), [segment, totalVolume])

	const leadingControls = (
		<div
			className={`${TAG_GROUP_VARIANTS.solid.container} ${TAG_GROUP_SIZES.md}`}
			role="group"
			aria-label="Venue filter"
		>
			{VENUE_OPTIONS.map((option) => (
				<button
					key={option.id}
					type="button"
					data-active={venue === option.id}
					onClick={() => setVenue(option.id)}
					className={TAG_GROUP_VARIANTS.solid.button}
				>
					{option.label}
				</button>
			))}
		</div>
	)

	return (
		<TableWithSearch
			key={`${segment}-${venue}-${preset}`}
			data={rows}
			columns={columns}
			columnToSearch="exchange"
			placeholder="Search exchanges..."
			leadingControls={leadingControls}
			searchAlign="start"
			columnVisibility={COLUMN_VISIBILITY[preset]}
			showColumnSelect
			csvExportAllColumns
			embedded={embedded}
			csvFileName={`markets-exchanges-${segment}`}
			sortingState={[{ id: 'total_volume_24h', desc: true }]}
		/>
	)
}
