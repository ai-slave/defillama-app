/**
 * The venue's markets rolled up per token: one row per asset, across every segment it
 * trades here. The per-segment tables stay as they are; this is the "what can I do
 * with SOL on this venue" view.
 *
 * Columns mirror the merged listing on /exchanges, so a reader moving from the
 * directory to a venue meets the same figures under the same names.
 */
import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { Card } from '~/ui/Card'
import { Logo } from '~/ui/Logo'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { geckoTokenIconUrl, letterLogoDataUri } from '~/utils/icons'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { exchangeDefinitions } from './definitions'
import { EXCHANGE_SEGMENT_LABELS, type ExchangeProfileModel, type ExchangeSegment } from './models'
import { insideShown, IntraSpread, MarkoutHorizons, money, NA, SegmentLines, SlippageLadder } from './ProfileExecution'
import { exchangeTokenRows, type ExchangeTokenRow } from './profileTokens'

const columnHelper = createColumnHelper<SearchTableFeatures, ExchangeTokenRow>()

// The directory's merged columns, per token: a token row folds its markets (BTC/USDT,
// BTC/USDC, …) in each segment, execution merged by the volume measured on each.
const definitions = exchangeDefinitions.directory
const SEGMENTS = ['spot', 'linear_perp'] as const satisfies ReadonlyArray<ExchangeSegment>
const NOT_TRADED = <span className="text-tertiary">N/A</span>

/** One labeled line per segment the token trades in here; N/A when it trades in neither. */
function segmentLines(
	row: ExchangeTokenRow,
	value: (segment: ExchangeSegment) => React.ReactNode,
	segments: ReadonlyArray<ExchangeSegment> = SEGMENTS
) {
	return <SegmentLines present={segments.filter((segment) => row.segments.includes(segment))} value={value} />
}

/** Slippage or markout for one segment, the two rungs stacked as on the directory. */
function segmentExecColumn(spec: {
	id: string
	segment: ExchangeSegment
	definition: { label: string; description: string }
	field: 'realizedSlippage10kBps' | 'markout1mBps'
	width: string
}) {
	return columnHelper.accessor((row) => row.executionBySegment[spec.segment]?.[spec.field] ?? undefined, {
		id: spec.id,
		header: spec.definition.label,
		sortDescFirst: false,
		cell: ({ row }) => {
			if (!row.original.segments.includes(spec.segment)) return NOT_TRADED
			const execution = row.original.executionBySegment[spec.segment] ?? null
			return spec.field === 'markout1mBps' ? (
				<MarkoutHorizons execution={execution} />
			) : (
				<SlippageLadder execution={execution} />
			)
		},
		meta: { headerClassName: spec.width, align: 'end', headerHelperText: spec.definition.description }
	})
}

const nvolCell = (value: number | null, reported: boolean) =>
	value == null ? '–' : `${formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}${reported ? '*' : ''}`
const TOKEN_COLUMNS = columnHelper.columns([
	columnHelper.accessor('token', {
		id: 'token',
		enableHiding: false,
		header: 'Token',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const token = getValue()
			const { marketCount, segments, maxLeverage } = row.original
			return (
				<span className="flex min-w-0 items-center gap-2">
					<Logo
						src={row.original.geckoId ? geckoTokenIconUrl(row.original.geckoId, 20) : null}
						size={20}
						fallbackSrc={letterLogoDataUri(token)}
						alt=""
					/>
					<Tooltip
						content={`${marketCount} market${marketCount === 1 ? '' : 's'} here: ${segments
							.map((segment) => EXCHANGE_SEGMENT_LABELS[segment])
							.join(', ')}`}
						render={
							<BasicLink
								href={`/token/${encodeURIComponent(token)}`}
								className="min-w-0 truncate label-md text-link hover:underline"
							/>
						}
					>
						{token}
					</Tooltip>
					{/* Sibling of the link, never inside it: leverage must not become link text. */}
					{maxLeverage == null ? null : (
						<Tooltip content={`Up to ${maxLeverage}x leverage on this token's perps here`}>
							<span className="shrink-0 label-sm text-tertiary">{`${maxLeverage}x`}</span>
						</Tooltip>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[152px]',
			headerHelperText: 'Base asset, with the highest leverage its perps offer here. Hover for the segments trading it.'
		}
	}),
	columnHelper.accessor(
		(row) =>
			row.executionBySegment.linear_perp?.costToTradeBps ?? row.executionBySegment.spot?.costToTradeBps ?? undefined,
		{
			id: 'cost',
			header: definitions.execCostToTrade.label,
			sortDescFirst: false,
			cell: ({ row }) =>
				segmentLines(row.original, (segment) => {
					const cost = row.original.executionBySegment[segment]?.costToTradeBps
					return cost == null ? NA : money(cost)
				}),
			meta: {
				headerClassName: 'w-[160px]',
				align: 'end',
				headerHelperText:
					'All-in cost of a $10k market order on this token here: taker fee plus half the effective spread, one line per segment.'
			}
		}
	),
	segmentExecColumn({
		id: 'spotSlippage',
		segment: 'spot',
		definition: definitions.spotSlippage,
		field: 'realizedSlippage10kBps',
		width: 'w-[204px]'
	}),
	segmentExecColumn({
		id: 'perpSlippage',
		segment: 'linear_perp',
		definition: definitions.perpSlippage,
		field: 'realizedSlippage10kBps',
		width: 'w-[204px]'
	}),
	segmentExecColumn({
		id: 'spotMarkout',
		segment: 'spot',
		definition: definitions.spotMarkout,
		field: 'markout1mBps',
		width: 'w-[140px]'
	}),
	segmentExecColumn({
		id: 'perpMarkout',
		segment: 'linear_perp',
		definition: definitions.perpMarkout,
		field: 'markout1mBps',
		width: 'w-[150px]'
	}),
	columnHelper.accessor(
		(row) => {
			const shown = SEGMENTS.map((segment) => insideShown(row.executionBySegment[segment]?.insideSpreadPct)).filter(
				(value): value is number => value != null
			)
			return shown.length > 0 ? Math.max(...shown) : undefined
		},
		{
			id: 'intraSpread',
			header: definitions.intraSpread.label,
			sortDescFirst: true,
			cell: ({ row }) => {
				const flagged = SEGMENTS.filter(
					(segment) => insideShown(row.original.executionBySegment[segment]?.insideSpreadPct) != null
				)
				return flagged.length === 0
					? null
					: segmentLines(
							row.original,
							(segment) => <IntraSpread pct={row.original.executionBySegment[segment]?.insideSpreadPct} />,
							flagged
						)
			},
			meta: { headerClassName: 'w-[150px]', align: 'end', headerHelperText: definitions.intraSpread.description }
		}
	),
	columnHelper.accessor(
		(row) =>
			row.spotActiveLiquidity == null && row.perpActiveLiquidity == null
				? undefined
				: (row.spotActiveLiquidity ?? 0) + (row.perpActiveLiquidity ?? 0),
		{
			id: 'activeLiquidity',
			header: definitions.segmentActiveLiquidity.label,
			cell: ({ row }) =>
				segmentLines(
					row.original,
					(segment) =>
						formatUsd(
							segment === 'spot' ? row.original.spotActiveLiquidity : row.original.perpActiveLiquidity,
							USD_LOWERCASE_MILLIONS_OPTIONS
						) ?? '–'
				),
			meta: {
				headerClassName: 'w-[180px]',
				align: 'end',
				headerHelperText: definitions.segmentActiveLiquidity.description
			}
		}
	),
	columnHelper.accessor((row) => row.perpOpenInterestUsd ?? undefined, {
		id: 'perpOpenInterest',
		header: definitions.perpOpenInterest.label,
		cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: definitions.perpOpenInterest.description
		}
	}),
	columnHelper.accessor((row) => row.spotNormalizedVolume ?? undefined, {
		id: 'spotNormalizedVolume',
		header: definitions.spotNormalizedVolume.label,
		cell: ({ row }) =>
			row.original.segments.includes('spot')
				? nvolCell(row.original.spotNormalizedVolume, row.original.spotVolumeIsReported)
				: NOT_TRADED,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: `${definitions.spotNormalizedVolume.description} * = a market without a captured book counts at reported volume.`
		}
	}),
	columnHelper.accessor((row) => row.perpNormalizedVolume ?? undefined, {
		id: 'perpNormalizedVolume',
		header: definitions.perpNormalizedVolume.label,
		cell: ({ row }) =>
			row.original.segments.includes('linear_perp')
				? nvolCell(row.original.perpNormalizedVolume, row.original.perpVolumeIsReported)
				: NOT_TRADED,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: `${definitions.perpNormalizedVolume.description} * = a market without a captured book counts at reported volume.`
		}
	})
])

export function ProfileTokenTable({
	profile,
	leadingControls
}: {
	profile: ExchangeProfileModel
	leadingControls?: React.ReactNode
}) {
	const rows = React.useMemo(() => exchangeTokenRows(profile), [profile])
	return (
		<SearchTableProvider options={{ data: rows, columns: TOKEN_COLUMNS }}>
			<Card padding="none">
				<TableToolbar>
					{leadingControls ? <div className="mr-auto flex items-center overflow-x-auto">{leadingControls}</div> : null}
					<TableSearchInput
						columnId="token"
						placeholder="Search tokens…"
						width={leadingControls ? 'inline' : 'standalone'}
					/>
					<TableColumnSelect />
					<TableCsvExport filename={`${profile.slug}-tokens`} includeHiddenColumns />
				</TableToolbar>
				{/* Two-line execution cells need the taller row. */}
				<VirtualSearchTableView rowSize={56} tableLayout="fixed" />
			</Card>
		</SearchTableProvider>
	)
}
