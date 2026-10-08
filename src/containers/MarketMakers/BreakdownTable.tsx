import { useMemo, useState } from 'react'
import { formatPercent } from '~/utils/numberFormat'
import { AccentBadge } from './badges'
import type { BreakdownSections } from './breakdown'
import { heatmapClass, percentileOpacity, rankOpacity } from './colors'
import { formatMetricValue, type MetricFormatKind } from './format'
import { SortArrow } from './StickyTable'

type Dict = Record<string, unknown>

function asDict(value: unknown): Dict {
	return value && typeof value === 'object' ? (value as Dict) : {}
}

function asNum(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export type BreakdownRowConfig = {
	label: string
	key: string
	kind: MetricFormatKind
}

type SortKey = 'metric' | 'value' | 'percentile' | 'rank'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }

const THRESHOLDS = [50, 100, 200] as const

function depthRows(): Array<BreakdownRowConfig> {
	const rows: Array<BreakdownRowConfig> = []
	for (const t of THRESHOLDS) {
		rows.push(
			{ label: `Bid Depth ${t} bps (USD)`, key: `bidDepth${t}`, kind: 'usd' },
			{ label: `Ask Depth ${t} bps (USD)`, key: `askDepth${t}`, kind: 'usd' },
			{ label: `Bid & Ask Depth ${t} bps (USD)`, key: `bidAskDepth${t}`, kind: 'usd' },
			{ label: `Bid Depth ${t} bps (% of Market)`, key: `bidDepth${t}MarketPercentage`, kind: 'percent' },
			{ label: `Ask Depth ${t} bps (% of Market)`, key: `askDepth${t}MarketPercentage`, kind: 'percent' },
			{
				label: `Bid & Ask Depth ${t} bps (% of Market)`,
				key: `bidAskDepth${t}MarketPercentage`,
				kind: 'percent'
			},
			{ label: `Uptime %, Bid & Ask Depth ${t} bps`, key: `bidAskDepth${t}Uptime`, kind: 'percent' },
			{
				label: `Loan Utilization, Bid & Ask Depth ${t} bps`,
				key: `bidAskDepth${t}LoanUtilization`,
				kind: 'percent'
			}
		)
	}
	return rows
}

export const DEPTH_ROWS: Array<BreakdownRowConfig> = depthRows()

export const VOLUME_ROWS: Array<BreakdownRowConfig> = [
	{ label: 'Maker Fill Volume (USD)', key: 'volumeMaker', kind: 'usd' },
	{ label: 'Taker Fill Volume (USD)', key: 'volumeTaker', kind: 'usd' },
	{ label: 'Maker & Taker Fill Volume (USD)', key: 'volumeTotal', kind: 'usd' },
	{ label: 'Maker Fill Volume (% of Market)', key: 'volumeMakerMarketPercentage', kind: 'percent' },
	{ label: 'Taker Fill Volume (% of Market)', key: 'volumeTakerMarketPercentage', kind: 'percent' },
	{ label: 'Maker & Taker Fill Volume (% of Market)', key: 'volumeTotalMarketPercentage', kind: 'percent' },
	{ label: 'Loan Utilization (Maker Fill Volume)', key: 'volumeMakerLoanUtilization', kind: 'percent' },
	{ label: 'Loan Utilization (Taker Fill Volume)', key: 'volumeTakerLoanUtilization', kind: 'percent' },
	{ label: 'Loan Utilization (Maker & Taker Fill Volume)', key: 'volumeTotalLoanUtilization', kind: 'percent' }
]

export const SPREAD_ROWS: Array<BreakdownRowConfig> = [
	{ label: 'Volume Weighted Bid-Ask Spread (%)', key: 'bidAskSpread', kind: 'percent' },
	{ label: 'Uptime %, Bid-Ask Spread (%)', key: 'spreadUptime', kind: 'percent' }
]

export const KPI_ROWS: Array<BreakdownRowConfig> = [
	{ label: '0.50% Bid & Ask Depth Adherence', key: 'bidAskDepth50', kind: 'percent' },
	{ label: '1.00% Bid & Ask Depth Adherence', key: 'bidAskDepth100', kind: 'percent' },
	{ label: '2.00% Bid & Ask Depth Adherence', key: 'bidAskDepth200', kind: 'percent' },
	{ label: 'Bid-Ask Spread Adherence', key: 'bidAskSpread', kind: 'percent' }
]

const BORDER = 'border-subtle'

function HeadCell({
	children,
	sortKey,
	sort,
	onSort
}: {
	children: string
	sortKey?: SortKey
	sort?: Sort | null
	onSort?: (key: SortKey) => void
}) {
	const dir = sortKey && sort?.key === sortKey ? sort.dir : false
	return (
		<th
			className={`border-b ${BORDER} px-3 py-2 text-left label-sm text-tertiary`}
			aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
		>
			{sortKey && onSort ? (
				<button
					type="button"
					onClick={() => onSort(sortKey)}
					className="flex cursor-pointer items-center gap-1 select-none"
				>
					{children}
					<SortArrow dir={dir} />
				</button>
			) : (
				children
			)}
		</th>
	)
}

function BreakdownRow({ row, data }: { row: BreakdownRowConfig; data: Dict }) {
	const metric = asDict(data[row.key])
	const hasMetric = data[row.key] != null && typeof data[row.key] === 'object'
	const value = asNum(metric.value)
	const percentile = asNum(metric.percentile)
	const rank = asNum(metric.rank)

	const valueText = hasMetric && value != null ? formatMetricValue(value, row.kind) : 'N/A'
	const percentileHeat = percentile == null ? '' : (heatmapClass(percentileOpacity(percentile)) ?? '')
	const rankHeat = rank == null ? '' : (heatmapClass(rankOpacity(rank)) ?? '')

	return (
		<tr className={`border-b ${BORDER} last:border-b-0`}>
			<td className="px-3 py-2 text-left body-sm whitespace-normal text-secondary sm:whitespace-nowrap">{row.label}</td>
			<td className="px-3 py-2 text-left label-sm">{valueText}</td>
			<td className={`px-3 py-2 text-center body-sm ${percentileHeat}`}>
				{percentile == null ? 'N/A' : formatPercent(percentile, { input: 'percent', maximumFractionDigits: 0 })}
			</td>
			<td className={`px-3 py-2 text-center body-sm ${rankHeat}`}>{rank == null ? 'N/A' : rank}</td>
		</tr>
	)
}

// Missing values sort last in both directions so N/A rows never lead the table.
export function sortBreakdownRows(
	rows: Array<BreakdownRowConfig>,
	data: Dict,
	sort: Sort | null
): Array<BreakdownRowConfig> {
	if (!sort) return rows
	if (sort.key === 'metric') {
		return [...rows].sort((a, b) =>
			sort.dir === 'desc' ? b.label.localeCompare(a.label) : a.label.localeCompare(b.label)
		)
	}
	const value = (row: BreakdownRowConfig) => asNum(asDict(data[row.key])[sort.key])
	return [...rows].sort((a, b) => {
		const va = value(a)
		const vb = value(b)
		if (va == null && vb == null) return 0
		if (va == null) return 1
		if (vb == null) return -1
		return sort.dir === 'desc' ? vb - va : va - vb
	})
}

export function BreakdownTable({
	title,
	badge,
	rows,
	data
}: {
	title: string
	badge: string
	rows: Array<BreakdownRowConfig>
	data: Dict
}) {
	const [sort, setSort] = useState<Sort | null>(null)

	const onSort = (key: SortKey) =>
		setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))

	const sortedRows = useMemo(() => sortBreakdownRows(rows, data, sort), [rows, data, sort])

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<h4 className="label-md">{title}, Detailed Breakdown</h4>
				<AccentBadge className="h-6">{badge}</AccentBadge>
			</div>
			{/* On the card colour: the heat bands are a wash over it, and the drawer behind is grey. */}
			<div className={`overflow-x-auto rounded-lg border bg-surface ${BORDER}`}>
				<table className="w-full border-collapse">
					<thead>
						<tr>
							<HeadCell sortKey="metric" sort={sort} onSort={onSort}>
								Metric
							</HeadCell>
							<HeadCell sortKey="value" sort={sort} onSort={onSort}>
								Value
							</HeadCell>
							<HeadCell sortKey="percentile" sort={sort} onSort={onSort}>
								Percentile
							</HeadCell>
							<HeadCell sortKey="rank" sort={sort} onSort={onSort}>
								Rank
							</HeadCell>
						</tr>
					</thead>
					<tbody>
						{sortedRows.map((row) => (
							<BreakdownRow key={row.key} row={row} data={data} />
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}

const BREAKDOWN_SECTIONS: Array<{
	title: string
	rows: Array<BreakdownRowConfig>
	dataKey: keyof BreakdownSections
}> = [
	{ title: 'Depth KPIs', rows: DEPTH_ROWS, dataKey: 'depth' },
	{ title: 'Volume KPIs', rows: VOLUME_ROWS, dataKey: 'volume' },
	{ title: 'Spread KPIs', rows: SPREAD_ROWS, dataKey: 'spread' },
	{ title: 'KPI Adherence', rows: KPI_ROWS, dataKey: 'kpi' }
]

export function BreakdownTables({ sections, badge }: { sections: BreakdownSections; badge: string }) {
	return (
		<section className="flex flex-col gap-5">
			{BREAKDOWN_SECTIONS.map((section) => (
				<BreakdownTable
					key={section.title}
					title={section.title}
					badge={badge}
					rows={section.rows}
					data={sections[section.dataKey]}
				/>
			))}
		</section>
	)
}
