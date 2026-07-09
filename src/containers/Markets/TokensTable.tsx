import { type ColumnDef, createColumnHelper, type VisibilityState } from '@tanstack/react-table'
import * as React from 'react'
import { selectTriggerStyles } from '~/components/Select/types'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { formattedNum } from '~/utils'
import { type Segment, segmentHasOi } from './segments'
import {
	ChangeCell,
	MaterialChangeCell,
	renderFunding8h,
	renderLeverage,
	renderPrice,
	SentimentBadge,
	TagPills,
	TokenName,
	type KnownTokenSlugs
} from './shared'
import type { SymbolStat } from './types'
import { type MarketsTablePreset, useMarketsTablePreset } from './useMarketsTablePreset'
import { pctChange, sentiment, topSymbols } from './utils'

const columnHelper = createColumnHelper<SymbolStat>()

const COLUMN_VISIBILITY: Record<MarketsTablePreset, VisibilityState> = {
	wide: {
		leverage: false,
		tags: false
	},
	compact: {
		funding_rate_8h: false,
		leverage: false,
		market_count: false,
		exchange_count: false,
		tags: false
	},
	mobile: {
		volume_change_24h: false,
		oi_usd: false,
		oi_change_24h: false,
		funding_rate_8h: false,
		leverage: false,
		market_count: false,
		exchange_count: false,
		sentiment: false,
		tags: false
	}
}

function buildColumns(segment: Segment, knownTokenSlugs: KnownTokenSlugs): ColumnDef<SymbolStat, any>[] {
	const hasOi = segmentHasOi(segment)

	const columns: ColumnDef<SymbolStat, any>[] = [
		columnHelper.accessor('symbol', {
			id: 'symbol',
			header: 'Asset',
			enableSorting: false,
			cell: ({ getValue }) => <TokenName base={getValue()} knownTokenSlugs={knownTokenSlugs} />,
			meta: { headerClassName: 'min-w-[140px]' }
		}),
		columnHelper.accessor((row) => row.price ?? undefined, {
			id: 'price',
			header: 'Price',
			cell: ({ row }) => renderPrice(row.original.price),
			meta: { headerClassName: 'w-[120px]', align: 'end' as const }
		}),
		columnHelper.accessor((row) => row.price_change_24h ?? undefined, {
			id: 'price_change_24h',
			header: '24h',
			cell: ({ row }) => <ChangeCell fraction={row.original.price_change_24h} />,
			meta: { headerClassName: 'w-[100px]', align: 'end' }
		}),
		columnHelper.accessor('volume_24h', {
			id: 'volume_24h',
			header: '24h Volume',
			cell: ({ getValue }) => (getValue() == null ? '–' : formattedNum(getValue(), true)),
			meta: { headerClassName: 'w-[120px]', align: 'end' as const }
		}),
		columnHelper.accessor((row) => pctChange(row.volume_24h, row.volume_prev_24h) ?? undefined, {
			id: 'volume_change_24h',
			header: 'Vol Δ',
			cell: ({ row }) => (
				<MaterialChangeCell current={row.original.volume_24h} previous={row.original.volume_prev_24h} />
			),
			meta: { headerClassName: 'w-[100px]', align: 'end' }
		})
	]

	if (hasOi) {
		columns.push(
			columnHelper.accessor((row) => row.oi_usd ?? undefined, {
				id: 'oi_usd',
				header: 'Open Interest',
				cell: ({ row }) => (row.original.oi_usd == null ? '–' : formattedNum(row.original.oi_usd, true)),
				meta: { headerClassName: 'w-[120px]', align: 'end' as const }
			}),
			columnHelper.accessor((row) => pctChange(row.oi_usd, row.oi_prev_usd) ?? undefined, {
				id: 'oi_change_24h',
				header: 'OI Δ',
				cell: ({ row }) => <MaterialChangeCell current={row.original.oi_usd} previous={row.original.oi_prev_usd} />,
				meta: { headerClassName: 'w-[100px]', align: 'end' }
			}),
			columnHelper.accessor((row) => row.funding_rate_8h ?? undefined, {
				id: 'funding_rate_8h',
				header: 'Funding 8h',
				cell: ({ row }) => renderFunding8h(row.original.funding_rate_8h),
				meta: { headerClassName: 'w-[110px]', align: 'end' }
			})
		)
	}

	columns.push(
		columnHelper.accessor((row) => row.leverage_max ?? undefined, {
			id: 'leverage',
			header: 'Lev',
			cell: ({ row }) => renderLeverage(row.original.leverage_min, row.original.leverage_max),
			meta: { headerClassName: 'w-[90px]', align: 'end' }
		}),
		columnHelper.accessor('market_count', {
			id: 'market_count',
			header: 'Mkts',
			cell: ({ getValue }) => getValue() ?? '–',
			meta: { headerClassName: 'w-[80px]', align: 'end' }
		}),
		columnHelper.accessor('exchange_count', {
			id: 'exchange_count',
			header: 'Venues',
			cell: ({ getValue }) => getValue() ?? '–',
			meta: { headerClassName: 'w-[90px]', align: 'end' }
		}),
		columnHelper.display({
			id: 'sentiment',
			header: 'Sentiment',
			cell: ({ row }) => <SentimentBadge sentiment={sentiment(row.original, segment)} />,
			meta: { headerClassName: 'w-[110px]' }
		}),
		columnHelper.display({
			id: 'tags',
			header: 'Tags',
			cell: ({ row }) => <TagPills tags={row.original.tags} />,
			meta: { headerClassName: 'w-[180px]' }
		})
	)

	return columns
}

const SORT_OPTIONS: ReadonlyArray<{ id: 'volume' | 'oi'; label: string }> = [
	{ id: 'volume', label: 'by 24h volume' },
	{ id: 'oi', label: 'by open interest' }
]

export function TokensTable({
	rows,
	segment,
	knownTokenSlugs,
	embedded = false
}: {
	rows: SymbolStat[]
	segment: Segment
	knownTokenSlugs: KnownTokenSlugs
	embedded?: boolean
}) {
	const preset = useMarketsTablePreset()
	const hasOi = segmentHasOi(segment)
	const [sortBy, setSortBy] = React.useState<'volume' | 'oi'>('volume')
	const effectiveSort = hasOi ? sortBy : 'volume'

	const columns = React.useMemo(() => buildColumns(segment, knownTokenSlugs), [segment, knownTokenSlugs])
	const data = React.useMemo(() => topSymbols(rows, effectiveSort, 100), [rows, effectiveSort])
	const sortColumn = effectiveSort === 'oi' ? 'oi_usd' : 'volume_24h'

	const leadingControls = hasOi ? (
		<select
			value={sortBy}
			onChange={(e) => setSortBy(e.target.value as 'volume' | 'oi')}
			className={selectTriggerStyles('filter', 'md')}
		>
			{SORT_OPTIONS.map((option) => (
				<option key={option.id} value={option.id}>
					{option.label}
				</option>
			))}
		</select>
	) : null

	return (
		<TableWithSearch
			key={`${segment}-${effectiveSort}-${preset}`}
			data={data}
			columns={columns}
			columnToSearch="symbol"
			placeholder="Search assets..."
			leadingControls={leadingControls}
			searchAlign="start"
			columnVisibility={COLUMN_VISIBILITY[preset]}
			showColumnSelect
			csvExportAllColumns
			embedded={embedded}
			csvFileName={`markets-tokens-${segment}`}
			sortingState={[{ id: sortColumn, desc: true }]}
		/>
	)
}
