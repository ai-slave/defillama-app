import { type ColumnDef, createColumnHelper, type SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { Tooltip } from '~/ui/Tooltip'
import { formatUsd, formatCompactNumber, formatNumber, formatPercent } from '~/utils/numberFormat'
import { parseSelectedEarnColumns } from '../Filters/columnOptions'
import { YIELD_PERCENT_OPTIONS } from '../poolDetail/format'
import { NameYield, PoolNameLockup } from './Name'
import { PaginatedYieldsTable } from './PaginatedYieldsTable'
import { Sparkline } from './Sparkline'
import { hasSparkline } from './sparklineModel'
import type { IYieldsTableProps, IYieldTableRow, YieldsTableAppearance } from './types'
import { EarnApyCell, EmptyCell, RewardApyCell, SupplyCapBar, type EarnApyMedian } from './YieldsCells'

const STABILITY_RATING_STYLES: Record<string, string> = {
	stable: 'bg-(--apy-mid)/10 text-(--yield-positive-text)',
	mixed: 'bg-surface-elevated-1 text-secondary',
	volatile: 'bg-(--apy-very)/10 text-(--yield-negative-text)'
}

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
	const className = STABILITY_RATING_STYLES[rating] ?? 'bg-surface-elevated-1 text-secondary'
	const label = rating.charAt(0).toUpperCase() + rating.slice(1)
	// Math.round matches stabilityRatingFromScore's bucketing input.
	const scoreStr = score != null ? String(Math.round(score * 100)) : null
	// The td centers via text-align, so the bare pill must stay inline-flex; inside
	// the block-level Tooltip anchor, justify-center re-centers it.
	const hasTooltip = score != null
	const pill = (
		<span className={`inline-flex items-center rounded-full px-2 py-0.5 label-sm ${className}`}>
			<span className={hasTooltip ? 'underline decoration-secondary decoration-dotted' : undefined}>
				{label}
				{scoreStr != null ? <span className="text-secondary">{` ${scoreStr}`}</span> : null}
			</span>
		</span>
	)
	if (!hasTooltip) return pill

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
			<span className="body-xs opacity-50">Score = 100 / (1 + σ/avg)</span>
		</span>
	)
	return (
		<Tooltip content={content} className="justify-center">
			{pill}
		</Tooltip>
	)
}

function ProjectNameCell({ row }: { row: { original: IYieldTableRow } }) {
	return (
		<NameYield
			project={row.original.project}
			projectslug={row.original.projectslug}
			airdrop={row.original.airdrop}
			raiseValuationUsd={row.original.raiseValuationUsd}
		/>
	)
}

const columnHelper = createColumnHelper<IYieldTableRow>()
const OPTIONAL_COLUMN_IDS = new Set([
	'category',
	'apyBase',
	'apyReward',
	'apyMean30d',
	'volumeUsd1d',
	'pricePerShare',
	'top10Pct',
	'avgPositionUsd'
])
const EMPTY_SORTING_STATE: SortingState = []

function apyHeader(query: Record<string, unknown>, label: string) {
	const suffix = query.apyWindow === 'avg_7d' ? ' (7d)' : query.apyWindow === 'avg_30d' ? ' (30d)' : ''
	return `${label}${suffix}`
}

function createEarnColumns(
	query: Record<string, unknown>,
	median?: EarnApyMedian
): Array<ColumnDef<IYieldTableRow, unknown>> {
	const selected = new Set(parseSelectedEarnColumns(query.column as string | string[] | undefined))
	const columns: Array<ColumnDef<IYieldTableRow, unknown>> = [
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
			meta: { headerClassName: 'w-[190px] min-w-[190px]' }
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
					<Tooltip content={value} className="block">
						{route ? (
							<BasicLink href={route} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
								{value}
							</BasicLink>
						) : (
							<span className="truncate">{value}</span>
						)}
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[110px] min-w-[110px]',
				headerHelperText: 'The asset you provide to enter the pool'
			}
		}),
		columnHelper.accessor('project', {
			id: 'project',
			header: 'Protocol',
			enableSorting: false,
			cell: ({ row }) => <ProjectNameCell row={row} />,
			meta: { headerClassName: 'w-[130px] min-w-[130px]' }
		}),
		columnHelper.accessor((row) => row.category ?? undefined, {
			id: 'category',
			header: 'Category',
			enableSorting: false,
			cell: (info) => {
				const value = info.getValue()
				return value ? (
					<Tooltip content={value} className="block">
						<span className="truncate">{value}</span>
					</Tooltip>
				) : (
					<EmptyCell />
				)
			},
			meta: { headerClassName: 'w-[110px] min-w-[110px]' }
		}),
		columnHelper.accessor('chains', {
			id: 'chains',
			header: 'Chain',
			enableSorting: false,
			cell: (info) => <IconsRow items={toChainIconItems(info.getValue(), (chain) => chainHref('/chain', chain))} />,
			meta: { headerClassName: 'w-[60px] min-w-[60px]', align: 'end' }
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
				headerClassName: 'w-[100px] min-w-[100px]',
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
				headerClassName: 'w-[120px] min-w-[120px]',
				align: 'end',
				headerHelperText:
					'Follows the APY controls above: the composition you toggled (+Reward / +Intrinsic) over the selected window (Now / 7d / 30d)'
			}
		}),
		columnHelper.accessor((row) => row.apyBase ?? undefined, {
			id: 'apyBase',
			header: apyHeader(query, 'APY Base'),
			enableSorting: true,
			cell: (info) =>
				info.getValue() == null ? <EmptyCell /> : <span>{formatPercent(info.getValue(), YIELD_PERCENT_OPTIONS)}</span>,
			meta: { headerClassName: 'w-[150px] min-w-[150px]', align: 'end' }
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
			meta: { headerClassName: 'w-[150px] min-w-[150px]', align: 'end' }
		}),
		columnHelper.accessor((row) => row.apyMean30d ?? undefined, {
			id: 'apyMean30d',
			header: '30d Avg APY',
			enableSorting: true,
			cell: (info) =>
				info.getValue() == null ? <EmptyCell /> : <span>{formatPercent(info.getValue(), YIELD_PERCENT_OPTIONS)}</span>,
			meta: {
				headerClassName: 'w-[135px] min-w-[135px]',
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
				headerClassName: 'w-[124px] min-w-[124px] whitespace-nowrap',
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
					avg30d={row.original.stabilityAvg30d}
				/>
			),
			meta: {
				headerClassName: 'w-[120px] min-w-[120px]',
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
					<Tooltip content={content} className="justify-end">
						<span className={content ? 'underline decoration-dotted' : undefined}>
							{formatCompactNumber(count, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
						</span>
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[90px] min-w-[90px]',
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
				headerClassName: 'w-[110px] min-w-[110px]',
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
			meta: { headerClassName: 'w-[130px] min-w-[130px]', align: 'end' }
		}),
		columnHelper.accessor((row) => row.top10Pct ?? undefined, {
			id: 'top10Pct',
			header: 'Top 10 %',
			enableSorting: true,
			cell: (info) => {
				const value = info.getValue()
				if (value == null) return <EmptyCell />
				const accentClass = value >= 80 ? 'bg-data-down' : value >= 50 ? 'bg-warning' : 'bg-data-up'
				const riskLabel =
					value >= 80 ? 'High concentration' : value >= 50 ? 'Medium concentration' : 'Low concentration'
				return (
					<Tooltip content={riskLabel} className="justify-end">
						<span className="inline-flex items-center gap-1.5">
							<span className={`size-2 shrink-0 rounded-full ${accentClass}`} />
							<span className="underline decoration-dotted">
								{formatPercent(value, {
									input: 'percent',
									minimumFractionDigits: 1,
									maximumFractionDigits: 1,
									useGrouping: false
								})}
							</span>
						</span>
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[110px] min-w-[110px]',
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
				headerClassName: 'w-[110px] min-w-[110px]',
				align: 'end',
				headerHelperText: 'Average position size in USD (TVL / holder count).'
			}
		})
	]

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
	median
}: IYieldsTableProps & { appearance?: YieldsTableAppearance; median?: EarnApyMedian }) {
	const { query } = useRouter()
	const columns = createEarnColumns(query, median)

	return (
		<PaginatedYieldsTable
			data={data}
			columns={columns}
			tableClassName="min-w-[1180px] [&_td]:py-1.5"
			initialPageSize={initialPageSize}
			initialPageIndex={initialPageIndex}
			rowCount={rowCount}
			manualPagination={manualPagination}
			manualSorting={manualSorting}
			paginationState={paginationState}
			sortingState={sortingState}
			onPaginationChange={onPaginationChange}
			onSortingChange={onSortingChange}
			interactionDisabled={interactionDisabled}
			loadingLabel={loadingLabel}
			shell={appearance === 'embedded' ? 'none' : 'default'}
		/>
	)
}
