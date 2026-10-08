import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { BasicLink } from '~/components/Link'
import { SortIcon } from '~/components/Table/SortIcon'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { formatPercentChangeText } from '~/ui/PercentChange'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { CategoryBreakdownTable, rowBreakdownColumns, type BreakdownColumn } from './CategoryBreakdown'
import { GradeBadge, ScoreBar } from './grades'
import {
	syncUtrLeaderboardPaging,
	UTR_LEADERBOARD_PAGE_SIZE,
	type UtrFocusRequest,
	type UtrLeaderboardPaging
} from './navigation'
import { PerformanceMatrix } from './PerformanceMatrix'
import { ClaimProfileBanner } from './TokenPage'
import type { UtrGradeScaleEntry, UtrGradingConfig, UtrLeaderboardRow } from './types'

function ExpandedRow({ row, grading }: { row: UtrLeaderboardRow; grading?: UtrGradingConfig | null }) {
	const columns = rowBreakdownColumns(row)
	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex flex-col gap-4 xl:flex-row">
				<div className="flex min-w-0 flex-1 flex-col gap-4">
					<CategoryBreakdownTable
						title="Disclosures: Breakdown by Category"
						columns={columns.disclosure}
						gradingScale={grading?.disclosure.scale}
					/>
					<CategoryBreakdownTable
						title="Performance: Breakdown by Category"
						columns={columns.performance}
						gradingScale={grading?.performance.scale}
					/>
				</div>
				<div className="flex flex-col gap-3 xl:w-96 xl:shrink-0">
					<div className="flex flex-1 rounded-lg border border-subtle bg-surface">
						<PerformanceMatrix rows={[row]} grading={grading} className="min-h-[280px] w-full flex-1" />
					</div>
					<div className="flex gap-3">
						<Button
							as={BasicLink}
							href={`/universal-token-rating/compare?token=${row.asset}`}
							size="md"
							className="flex-1"
						>
							Compare
							<Icon name="repeat" className="size-3.5" />
						</Button>
						<Button
							as={BasicLink}
							href={`/universal-token-rating/token/${row.asset}`}
							variant="primary"
							size="md"
							className="flex-1"
						>
							Details
							<Icon name="arrow-right" className="size-3.5" />
						</Button>
					</div>
				</div>
			</div>
			{!row.claimed ? <ClaimProfileBanner asset={row.asset} /> : null}
		</div>
	)
}

type BreakdownMode = 'grade' | 'score' | 'percentile'

function breakdownValue(column: BreakdownColumn, mode: BreakdownMode, gradingScale?: Array<UtrGradeScaleEntry> | null) {
	if (mode === 'grade')
		return <GradeBadge score={column.score} scale={10} grade={column.grade} gradingScale={gradingScale} />
	if (mode === 'score')
		return (
			<span className="tabular-nums">
				{column.score == null
					? 'N/A'
					: formatNumber(column.score, {
							minimumFractionDigits: 1,
							maximumFractionDigits: 1,
							useGrouping: false
						})}
				<span className="text-tertiary"> /10</span>
			</span>
		)
	return (
		<span className="tabular-nums">
			{column.percentile == null
				? 'N/A'
				: formatPercent(column.percentile, {
						input: 'percent',
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
						smallValueDisplay: 'rounded',
						useGrouping: false
					})}
		</span>
	)
}

function MobileBreakdownTable({
	title,
	columns,
	mode,
	gradingScale
}: {
	title: string
	columns: Array<BreakdownColumn>
	mode: BreakdownMode
	gradingScale?: Array<UtrGradeScaleEntry> | null
}) {
	return (
		<div className="rounded-lg border border-subtle bg-surface">
			<p className="border-b border-subtle px-3 py-2.5 label-md">{title}</p>
			{columns.map((column) => (
				<div
					key={column.key}
					className="flex items-center justify-between gap-3 border-b border-subtle px-3 py-2 last:border-b-0"
				>
					<span className="body-sm text-secondary">{column.label}</span>
					{breakdownValue(column, mode, gradingScale)}
				</div>
			))}
		</div>
	)
}

function MobileExpandedRow({ row, grading }: { row: UtrLeaderboardRow; grading?: UtrGradingConfig | null }) {
	const [mode, setMode] = useState<BreakdownMode>('grade')
	const columns = rowBreakdownColumns(row)
	return (
		<div className="flex flex-col gap-3 bg-surface p-3">
			<SegmentedControl
				label="Breakdown value"
				variant="solid-responsive"
				size="md"
				value={mode}
				onValueChange={(value) => setMode(value as BreakdownMode)}
				options={[
					{ value: 'grade', label: 'Grade' },
					{ value: 'score', label: 'Score' },
					{ value: 'percentile', label: 'Percentile' }
				]}
			/>
			<MobileBreakdownTable
				title="Disclosures: Breakdown by Category"
				columns={columns.disclosure}
				mode={mode}
				gradingScale={grading?.disclosure.scale}
			/>
			<MobileBreakdownTable
				title="Performance: Breakdown by Category"
				columns={columns.performance}
				mode={mode}
				gradingScale={grading?.performance.scale}
			/>
			<div className="rounded-lg border border-subtle bg-surface">
				<PerformanceMatrix rows={[row]} grading={grading} className="min-h-[260px] w-full" />
			</div>
			<div className="flex gap-3">
				<Button as={BasicLink} href={`/universal-token-rating/compare?token=${row.asset}`} size="md" className="flex-1">
					Compare
					<Icon name="repeat" className="size-3.5" />
				</Button>
				<Button
					as={BasicLink}
					href={`/universal-token-rating/token/${row.asset}`}
					variant="primary"
					size="md"
					className="flex-1"
				>
					Details
					<Icon name="arrow-right" className="size-3.5" />
				</Button>
			</div>
			{!row.claimed ? <ClaimProfileBanner asset={row.asset} /> : null}
		</div>
	)
}

const SORTABLE_COLUMNS = [
	{ key: 'overall', label: 'Overall Score & MoM Change' },
	{ key: 'disclosure', label: 'Disclosure Score' },
	{ key: 'performance', label: 'Performance Score' },
	{ key: 'fdv', label: 'FDV' }
] as const

export type UtrSortKey = (typeof SORTABLE_COLUMNS)[number]['key'] | 'rank'

export type UtrSort = { key: UtrSortKey; desc: boolean }

export const UTR_SORT_OPTIONS: Array<{ key: UtrSortKey; name: string }> = [
	{ key: 'rank', name: 'Rank' },
	{ key: 'overall', name: 'Overall Score' },
	{ key: 'disclosure', name: 'Disclosure Score' },
	{ key: 'performance', name: 'Performance Score' },
	{ key: 'fdv', name: 'FDV' }
]

function sortValue(row: UtrLeaderboardRow, key: UtrSortKey): number {
	switch (key) {
		case 'rank':
			return row.scores.rank ?? Number.MAX_SAFE_INTEGER
		case 'overall':
			return row.scores.overall ?? -1
		case 'disclosure':
			return row.scores.disclosure ?? -1
		case 'performance':
			return row.scores.performance ?? -1
		case 'fdv':
			return row.fdvUsd ?? -1
	}
}

export const LEADERBOARD_COLUMN_COUNT = 8

const RANK_WIDTH = 48
const STICKY_CELL_BACKGROUND = 'var(--bg-surface)'

function stickyStyle(index: 0 | 1): CSSProperties {
	if (index === 0)
		return {
			position: 'sticky',
			left: 0,
			zIndex: 2,
			background: STICKY_CELL_BACKGROUND,
			width: RANK_WIDTH,
			minWidth: RANK_WIDTH
		}
	return {
		position: 'sticky',
		left: RANK_WIDTH,
		zIndex: 2,
		background: STICKY_CELL_BACKGROUND,
		minWidth: 150,
		boxShadow: '-1px 0 0 var(--border-subtle) inset'
	}
}

const rowId = (asset: string) => `utr-row-${asset}`

/** Call after the focus request for `asset` has rendered, so its row is on the current page. */
export function scrollToLeaderboardRow(asset: string) {
	document.getElementById(rowId(asset))!.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function Leaderboard({
	rows,
	grading,
	sort,
	setSort,
	fdvRanges,
	sectors,
	listingStatuses,
	focusRequest
}: {
	rows: Array<UtrLeaderboardRow>
	grading?: UtrGradingConfig | null
	sort: UtrSort
	setSort: (updater: (prev: UtrSort) => UtrSort) => void
	fdvRanges: Array<string>
	sectors: Array<string>
	listingStatuses: Array<string>
	focusRequest?: UtrFocusRequest | null
}) {
	const [expandedAssets, setExpandedAssets] = useState<Set<string>>(() => new Set())
	// The first render keeps page one even with a focus request; only a changed request pages to its asset.
	const [paging, setPaging] = useState<UtrLeaderboardPaging>(() => ({
		page: 0,
		selections: { fdvRanges, sectors, listingStatuses, sort },
		focusRequest
	}))

	const toggleExpanded = (asset: string) =>
		setExpandedAssets((current) => {
			const next = new Set(current)
			if (next.has(asset)) next.delete(asset)
			else next.add(asset)
			return next
		})

	const sortedRows = useMemo(() => {
		const next = [...rows]
		next.sort((a, b) => {
			const delta = sortValue(a, sort.key) - sortValue(b, sort.key)
			return sort.desc ? -delta : delta
		})
		return next
	}, [rows, sort])

	const syncedPaging = syncUtrLeaderboardPaging(
		paging,
		sortedRows,
		{ fdvRanges, sectors, listingStatuses, sort },
		focusRequest
	)
	if (syncedPaging !== paging) setPaging(syncedPaging)
	const currentPage = syncedPaging.page
	const setPage = (page: number) => setPaging((current) => ({ ...current, page }))
	const pageCount = Math.max(1, Math.ceil(sortedRows.length / UTR_LEADERBOARD_PAGE_SIZE))
	const pagedRows = sortedRows.slice(
		currentPage * UTR_LEADERBOARD_PAGE_SIZE,
		(currentPage + 1) * UTR_LEADERBOARD_PAGE_SIZE
	)

	const toggleSort = (key: UtrSortKey) =>
		setSort((prev) => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== 'rank' }))

	return (
		<div className="overflow-x-auto">
			<table className="w-full body-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
				<thead>
					<tr>
						<th
							className="border-b border-subtle px-3 py-2.5 text-left"
							style={stickyStyle(0)}
							aria-sort={sort.key === 'rank' ? (sort.desc ? 'descending' : 'ascending') : undefined}
						>
							<button
								type="button"
								className="flex cursor-pointer items-center gap-1 label-sm text-secondary"
								onClick={() => toggleSort('rank')}
							>
								#
								<SortIcon dir={sort.key === 'rank' ? (sort.desc ? 'desc' : 'asc') : false} />
							</button>
						</th>
						<th className="border-b border-subtle px-3 py-2.5 text-left label-sm text-secondary" style={stickyStyle(1)}>
							Protocol
						</th>
						<th className="border-b border-subtle px-3 py-2.5 text-left label-sm whitespace-nowrap text-secondary">
							Grade
						</th>
						{SORTABLE_COLUMNS.map((column) => (
							<th
								key={column.key}
								className="border-b border-subtle px-3 py-2.5 text-left whitespace-nowrap"
								aria-sort={sort.key === column.key ? (sort.desc ? 'descending' : 'ascending') : undefined}
							>
								<button
									type="button"
									className="flex cursor-pointer items-center gap-1 label-sm whitespace-nowrap text-secondary"
									onClick={() => toggleSort(column.key)}
								>
									{column.label}
									<SortIcon dir={sort.key === column.key ? (sort.desc ? 'desc' : 'asc') : false} />
								</button>
							</th>
						))}
						<th aria-label="Row details" className="border-b border-subtle" />
					</tr>
				</thead>
				<tbody>
					{pagedRows.map((row) => {
						const expanded = expandedAssets.has(row.asset)
						const momText = formatPercentChangeText(row.scores.overallMomChangePct)
						return (
							<Fragment key={row.asset}>
								<tr
									id={rowId(row.asset)}
									className="cursor-pointer hover:bg-hover-row"
									onClick={(event) => {
										if ((event.target as HTMLElement).closest('a, button')) return
										toggleExpanded(row.asset)
									}}
								>
									<td className="border-b border-subtle px-3 py-2.5 tabular-nums" style={stickyStyle(0)}>
										{row.scores.rank}
									</td>
									<td className="border-b border-subtle px-3 py-2.5" style={stickyStyle(1)}>
										<BasicLink
											href={`/universal-token-rating/token/${row.asset}`}
											className="flex items-center gap-2 hover:underline"
										>
											<TokenLogo src={row.coingeckoId ? geckoTokenIconUrl(row.coingeckoId) : null} size={22} />
											<span className="flex flex-col">
												<span className="flex items-center gap-1 text-primary">
													{row.symbol}
													{row.claimed ? (
														<Icon name="check-circle" height={12} width={12} className="text-link" />
													) : null}
												</span>
												<span className="body-xs text-tertiary">{row.name}</span>
											</span>
										</BasicLink>
									</td>
									<td className="border-b border-subtle px-3 py-2.5">
										<GradeBadge score={row.scores.overall} grade={row.grade} gradingScale={grading?.overall.scale} />
									</td>
									<td className="border-b border-subtle px-3 py-2.5 whitespace-nowrap">
										<span className="flex items-center gap-3">
											<ScoreBar score={row.scores.overall} grade={row.grade} gradingScale={grading?.overall.scale} />
											<span
												className={`tabular-nums ${
													(row.scores.overallMomChangePct ?? 0) >= 0 ? 'text-data-up' : 'text-data-down'
												}`}
											>
												{momText ?? '—'}
											</span>
										</span>
									</td>
									<td className="border-b border-subtle px-3 py-2.5 whitespace-nowrap">
										<ScoreBar
											score={row.scores.disclosure}
											scale={10}
											grade={row.disclosureGrade}
											gradingScale={grading?.disclosure.scale}
										/>
									</td>
									<td className="border-b border-subtle px-3 py-2.5 whitespace-nowrap">
										<ScoreBar
											score={row.scores.performance}
											scale={10}
											grade={row.performanceGrade}
											gradingScale={grading?.performance.scale}
										/>
									</td>
									<td className="border-b border-subtle px-3 py-2.5 whitespace-nowrap tabular-nums">
										{row.fdvUsd == null ? 'N/A' : `$${formatNumber(row.fdvUsd)}`}
									</td>
									<td className="border-b border-subtle px-3 py-2.5">
										{/* A row's expand chevron needs no Tooltip: aria-expanded says what it does. */}
										<Button
											size="sm"
											square
											aria-label="Row details"
											aria-expanded={expanded}
											onClick={() => toggleExpanded(row.asset)}
										>
											<Icon name={expanded ? 'chevron-up' : 'chevron-down'} className="size-4" />
										</Button>
									</td>
								</tr>
								{expanded ? (
									<tr>
										<td colSpan={LEADERBOARD_COLUMN_COUNT} className="border-b border-subtle bg-surface p-0">
											<div className="sticky left-0 max-w-[calc(100vw-16px)] lg:max-w-none">
												<div className="max-lg:hidden">
													<ExpandedRow row={row} grading={grading} />
												</div>
												<div className="lg:hidden">
													<MobileExpandedRow row={row} grading={grading} />
												</div>
											</div>
										</td>
									</tr>
								) : null}
							</Fragment>
						)
					})}
				</tbody>
			</table>
			{pageCount > 1 ? (
				<div className="flex items-center justify-between gap-2 border-t border-subtle px-4 py-2.5">
					<span className="flex items-center gap-1.5">
						<Tooltip
							content="Previous page"
							render={
								<Button
									type="button"
									size="sm"
									square
									disabled={currentPage === 0}
									accessibleWhenDisabled
									onClick={() => setPage(currentPage - 1)}
									aria-label="Previous page"
								/>
							}
						>
							<Icon name="arrow-left" className="size-4" />
						</Tooltip>
						<Tooltip
							content="Next page"
							render={
								<Button
									type="button"
									size="sm"
									square
									disabled={currentPage + 1 >= pageCount}
									accessibleWhenDisabled
									onClick={() => setPage(currentPage + 1)}
									aria-label="Next page"
								/>
							}
						>
							<Icon name="arrow-right" className="size-4" />
						</Tooltip>
						<span className="body-sm text-secondary">
							Page <strong className="text-primary">{currentPage + 1}</strong> of {pageCount}
						</span>
					</span>
					<span className="body-sm text-secondary">{sortedRows.length} tokens</span>
				</div>
			) : null}
		</div>
	)
}
