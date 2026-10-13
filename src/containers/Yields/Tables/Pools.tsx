import { createColumnHelper, type SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import type { ApiQuery } from '~/server/api/types'
import { StatusBadge } from '~/ui/StatusBadge'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { formatCompactNumber, formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { windowSuffix } from '../domain/csvApy'
import { parseSelectedEarnColumns } from '../Filters/columnOptions'
import { stabilityStatus, YIELD_PERCENT_OPTIONS } from '../poolDetail/format'
import { MeasuredColumnHint, MeasuredExitColumnHint } from './Measured'
import { NameYield, PoolNameLockup } from './Name'
import { PaginatedYieldsTable } from './PaginatedYieldsTable'
import { Sparkline } from './Sparkline'
import { hasSparkline } from './sparklineModel'
import type { IYieldsTableProps, IYieldTableRow, YieldsTableAppearance } from './types'
import { EarnApyCell, EmptyCell, ExitCell, RewardApyCell, SupplyCapBar, type EarnApyMedian } from './YieldsCells'

function ApyStabilityIndicator({
	score,
	rating,
	avg30d
}: {
	score?: number | null
	rating?: string | null
	avg30d?: number | null
}) {
	if (rating == null) return <EmptyCell />
	const label = rating.charAt(0).toUpperCase() + rating.slice(1)
	if (score == null) return <StatusBadge status={stabilityStatus(rating)}>{label}</StatusBadge>

	// σ derived from score and avg (score = 1 / (1 + σ/|avg|)), keeping the displayed
	// numbers mutually consistent.
	const sigma = score > 0 && avg30d != null ? (1 / score - 1) * Math.abs(avg30d) : null
	const content = (
		<span className="flex flex-col gap-1">
			{avg30d != null ? (
				<span className="flex justify-between gap-4">
					<span className="text-secondary">30d Avg APY</span>
					<span>{formatPercent(avg30d, YIELD_PERCENT_OPTIONS)}</span>
				</span>
			) : null}
			{sigma != null ? (
				<span className="flex justify-between gap-4">
					<span className="text-secondary">Volatility (σ)</span>
					<span>{formatPercent(sigma, YIELD_PERCENT_OPTIONS)}</span>
				</span>
			) : null}
			<span className="body-xs text-tertiary">Score = 100 / (1 + σ/avg)</span>
		</span>
	)
	// Math.round matches stabilityRatingFromScore's bucketing input.
	return (
		<StatusBadge status={stabilityStatus(rating)} tooltip={content}>
			{`${label} ${Math.round(score * 100)}`}
		</StatusBadge>
	)
}

const columnHelper = createColumnHelper<typeof paginatedTableFeatures, IYieldTableRow>()
const OPTIONAL_COLUMN_IDS = new Set([
	'category',
	'apyBase',
	'apyReward',
	'apyMean30d',
	'exitStatus',
	'volumeUsd1d',
	'pricePerShare',
	'top10Pct',
	'avgPositionUsd'
])
const EMPTY_SORTING_STATE: SortingState = []

function apyHeader(query: ApiQuery, label: string) {
	return `${label}${windowSuffix(query)}`
}

function createEarnColumns(query: ApiQuery, median?: EarnApyMedian, defaultColumns: ReadonlyArray<string> = []) {
	const selected = new Set(parseSelectedEarnColumns(query.column, defaultColumns))
	const columns = columnHelper.columns([
		columnHelper.accessor('pool', {
			id: 'pool',
			header: 'Pool',
			enableSorting: false,
			cell: ({ getValue, row }) => (
				<PoolNameLockup
					rowId={row.id}
					value={getValue()}
					configID={row.original.configID}
					url={row.original.url}
					poolMeta={row.original.poolMeta}
					exploited={row.original.exploited}
					hasRiskData={row.original.hasRiskData}
				/>
			),
			meta: { headerClassName: 'min-w-[190px]' }
		}),
		columnHelper.accessor((row) => row.referenceAsset ?? undefined, {
			id: 'referenceAsset',
			header: 'Reference',
			enableSorting: false,
			cell: (info) => {
				const value = info.getValue()
				if (!value) return <EmptyCell />
				const route = info.row.original.referenceTokenRoute
				return (
					<Tooltip content={value} onlyWhenClipped render={<span className="block max-w-full truncate" />}>
						{route ? (
							<BasicLink href={route} target="_blank" rel="noopener noreferrer" className="hover:underline">
								{value}
							</BasicLink>
						) : (
							value
						)}
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'min-w-[110px]',
				headerHelperText: 'The asset you provide to enter the pool'
			}
		}),
		columnHelper.accessor('project', {
			id: 'project',
			header: 'Protocol',
			enableSorting: false,
			cell: ({ row }) => (
				<NameYield
					project={row.original.project}
					projectslug={row.original.projectslug}
					airdrop={row.original.airdrop}
					raiseValuationUsd={row.original.raiseValuationUsd}
				/>
			),
			meta: { headerClassName: 'min-w-[130px]' }
		}),
		columnHelper.accessor((row) => row.category ?? undefined, {
			id: 'category',
			header: 'Category',
			enableSorting: false,
			cell: (info) => {
				const value = info.getValue()
				return value ? (
					<Tooltip content={value} onlyWhenClipped render={<span className="block max-w-full truncate" />}>
						{value}
					</Tooltip>
				) : (
					<EmptyCell />
				)
			},
			meta: { headerClassName: 'min-w-[110px]' }
		}),
		columnHelper.accessor('chains', {
			id: 'chains',
			header: 'Chain',
			enableSorting: false,
			cell: (info) => <IconsRow items={toChainIconItems(info.getValue(), (chain) => chainHref('/chain', chain))} />,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.tvl ?? undefined, {
			id: 'tvl',
			header: 'TVL',
			enableSorting: true,
			cell: ({ row }) =>
				row.original.tvl == null ? (
					<EmptyCell />
				) : (
					<span className="flex flex-col items-end gap-1">
						<span>
							{formatUsd(row.original.tvl, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
						{row.original.availableSupplyUsd != null ? (
							<SupplyCapBar tvl={row.original.tvl} available={row.original.availableSupplyUsd} />
						) : null}
					</span>
				),
			meta: {
				headerClassName: 'min-w-[100px]',
				align: 'end',
				headerHelperText: 'Total value deposited in the pool. For lending pools, this is total supplied.'
			}
		}),
		columnHelper.accessor((row) => row.apy ?? undefined, {
			id: 'apy',
			header: apyHeader(query, 'APY'),
			enableSorting: true,
			cell: ({ row }) => <EarnApyCell row={row.original} median={median} />,
			meta: {
				headerClassName: 'min-w-[136px]',
				align: 'end',
				// The lock sits on the column, not beside a figure, where it read as a fixed rate.
				headerTrail: () => <MeasuredColumnHint />,
				headerHelperText:
					'Follows the APY controls above: the composition you toggled (+Reward / +Intrinsic) over the selected window (Latest / 7d / 30d).'
			}
		}),
		// Measured exit outcome. Sorts on the numeric `exitStatus` (higher is better: withdrawable
		// USD > instant > partial > queued by ETA > blocked), while the cell reads `verified.exit` —
		// the same score/label split the Stability column uses. Unmeasured pools sort last in
		// both directions, because the server always pushes null keys to the bottom.
		columnHelper.accessor((row) => row.exitStatus ?? undefined, {
			id: 'exitStatus',
			header: 'Exit Status',
			enableSorting: true,
			cell: ({ row }) => <ExitCell row={row.original} />,
			meta: {
				// The longest label with its fee warning ("Queued ~14d" and the alert icon). A three-digit ETA with
				// the icon wraps to a second line, which stays readable, so the column is not sized for it.
				headerClassName: 'min-w-[154px]',
				align: 'end',
				headerTrail: () => <MeasuredExitColumnHint />,
				headerHelperText:
					'Whether you could actually withdraw, and how: instantly, after a queue, only in part, or not at all. Measured daily onchain.'
			}
		}),
		columnHelper.accessor((row) => row.apyBase ?? undefined, {
			id: 'apyBase',
			header: apyHeader(query, 'APY Base'),
			enableSorting: true,
			cell: (info) =>
				info.getValue() == null ? <EmptyCell /> : <span>{formatPercent(info.getValue(), YIELD_PERCENT_OPTIONS)}</span>,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.apyRewardRaw ?? undefined, {
			id: 'apyReward',
			header: apyHeader(query, 'APY Reward'),
			enableSorting: true,
			cell: (info) => (
				<RewardApyCell
					value={info.getValue()}
					chain={info.row.original.chains[0]}
					tokens={info.row.original.rewardTokens}
				/>
			),
			// Three reward-token icons beside "123.45%"; without a window suffix the header is narrower.
			meta: { headerClassName: 'min-w-[143px]', align: 'end' }
		}),
		columnHelper.accessor((row) => row.apyMean30d ?? undefined, {
			id: 'apyMean30d',
			header: '30d Avg APY',
			enableSorting: true,
			cell: (info) =>
				info.getValue() == null ? <EmptyCell /> : <span>{formatPercent(info.getValue(), YIELD_PERCENT_OPTIONS)}</span>,
			meta: {
				align: 'end',
				headerHelperText: 'Rolling 30-day average of APY Base + APY Reward'
			}
		}),
		columnHelper.accessor((row) => row.sparkline ?? undefined, {
			id: 'apyTrend30d',
			header: '30d Trend',
			enableSorting: false,
			cell: ({ row }) =>
				hasSparkline(row.original.sparkline) ? (
					<BasicLink
						href={`/yields/pool/${row.original.configID}`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex justify-center pl-6"
						aria-label="Open pool page"
					>
						<Sparkline points={row.original.sparkline} />
					</BasicLink>
				) : (
					<EmptyCell />
				),
			meta: {
				// The link's 24px inset plus the 84px sparkline.
				headerClassName: 'min-w-[132px] whitespace-nowrap',
				align: 'center',
				headerHelperText: 'Follows the APY composition toggled above (+Reward / +Intrinsic)'
			}
		}),
		columnHelper.accessor((row) => row.stabilityScore ?? undefined, {
			id: 'stabilityScore',
			header: '30d Stability',
			enableSorting: true,
			cell: ({ row }) => (
				<ApyStabilityIndicator
					score={row.original.stabilityScore}
					rating={row.original.stabilityRating}
					{...(row.original.stabilityAvg30d !== undefined ? { avg30d: row.original.stabilityAvg30d } : {})}
				/>
			),
			meta: {
				align: 'center',
				headerHelperText:
					'30-day APY stability score, 0–100 — higher is steadier (≥67 Stable · 33–66 Mixed · <33 Volatile). Follows the APY composition toggled above'
			}
		}),
		columnHelper.accessor((row) => row.holderCount ?? undefined, {
			id: 'holderCount',
			header: 'Holders',
			enableSorting: true,
			cell: ({ getValue, row }) => {
				const count = getValue()
				if (count == null) return <EmptyCell />
				const { top10Pct, avgPositionUsd } = row.original
				const content =
					top10Pct == null && avgPositionUsd == null ? null : (
						<span className="flex flex-col gap-1">
							{top10Pct != null ? (
								<span className="flex justify-between gap-4">
									<span className="text-secondary">Top 10 share</span>
									<span>
										{formatPercent(top10Pct, {
											input: 'percent',
											minimumFractionDigits: 1,
											maximumFractionDigits: 1,
											useGrouping: false
										})}
									</span>
								</span>
							) : null}
							{avgPositionUsd != null ? (
								<span className="flex justify-between gap-4">
									<span className="text-secondary">Avg position</span>
									<span>
										{formatUsd(avgPositionUsd, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
									</span>
								</span>
							) : null}
						</span>
					)
				return (
					<Definition content={content} className="justify-end">
						{formatCompactNumber(count, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
					</Definition>
				)
			},
			meta: {
				align: 'end',
				headerHelperText: 'Unique token holders'
			}
		}),
		columnHelper.accessor((row) => row.volumeUsd1d ?? undefined, {
			id: 'volumeUsd1d',
			header: '1d Volume',
			enableSorting: true,
			cell: (info) =>
				info.getValue() == null ? (
					<EmptyCell />
				) : (
					formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				),
			meta: {
				align: 'end',
				headerHelperText: '$ Volume in the last 24 hours.'
			}
		}),
		columnHelper.accessor((row) => row.pricePerShare ?? undefined, {
			id: 'pricePerShare',
			header: 'Price per Share',
			enableSorting: true,
			cell: (info) =>
				info.getValue() == null ? (
					<EmptyCell />
				) : (
					<span>{formatNumber(info.getValue(), { maximumFractionDigits: 4 })}</span>
				),
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.top10Pct ?? undefined, {
			id: 'top10Pct',
			header: 'Top 10 %',
			enableSorting: true,
			cell: (info) => {
				const value = info.getValue()
				if (value == null) return <EmptyCell />
				const accentClass = value >= 80 ? 'bg-error' : value >= 50 ? 'bg-warning' : 'bg-success'
				const riskLabel =
					value >= 80 ? 'High concentration' : value >= 50 ? 'Medium concentration' : 'Low concentration'
				return (
					<Definition content={riskLabel} className="justify-end gap-1.5">
						<span className={`size-2 shrink-0 rounded-full ${accentClass}`} />
						{formatPercent(value, {
							input: 'percent',
							minimumFractionDigits: 1,
							maximumFractionDigits: 1,
							useGrouping: false
						})}
					</Definition>
				)
			},
			meta: {
				align: 'end',
				headerHelperText: 'Percentage of TVL held by the top 10 holders. Higher = more concentrated.'
			}
		}),
		columnHelper.accessor((row) => row.avgPositionUsd ?? undefined, {
			id: 'avgPositionUsd',
			header: 'Avg Position',
			enableSorting: true,
			cell: (info) =>
				info.getValue() == null ? (
					<EmptyCell />
				) : (
					<span>
						{formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
					</span>
				),
			meta: {
				align: 'end',
				headerHelperText: 'Average position size in USD (TVL / holder count).'
			}
		})
	])

	return columns.filter((column) => !OPTIONAL_COLUMN_IDS.has(column.id ?? '') || selected.has(column.id ?? ''))
}

export function PaginatedYieldsPoolTable({
	data,
	initialPageSize = 10,
	initialPageIndex = 0,
	rowCount,
	manualPagination = false,
	manualSorting = false,
	paginationState,
	sortingState = EMPTY_SORTING_STATE,
	onPaginationChange,
	onSortingChange,
	interactionDisabled = false,
	loadingLabel,
	appearance = 'standalone',
	median,
	defaultColumns
}: IYieldsTableProps & {
	appearance?: YieldsTableAppearance
	median?: EarnApyMedian
	/** Optional columns shown when the URL names none. Only the earn page's measured tier sets this. */
	defaultColumns?: ReadonlyArray<string>
}) {
	const { query } = useRouter()
	const columns = createEarnColumns(query, median, defaultColumns)

	return (
		<PaginatedYieldsTable
			data={data}
			columns={columns}
			tableClassName="[&_td]:py-1.5"
			initialPageSize={initialPageSize}
			initialPageIndex={initialPageIndex}
			{...(rowCount !== undefined ? { rowCount } : {})}
			manualPagination={manualPagination}
			manualSorting={manualSorting}
			{...(paginationState ? { paginationState } : {})}
			sortingState={sortingState}
			{...(onPaginationChange ? { onPaginationChange } : {})}
			{...(onSortingChange ? { onSortingChange } : {})}
			interactionDisabled={interactionDisabled}
			{...(loadingLabel ? { loadingLabel } : {})}
			shell={appearance === 'embedded' ? 'none' : 'default'}
		/>
	)
}
