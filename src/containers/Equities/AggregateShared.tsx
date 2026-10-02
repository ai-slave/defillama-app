import Link from 'next/link'
import { lazy, Suspense, type ReactNode } from 'react'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { SortIcon } from '~/components/Table/SortIcon'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { InlineStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { formatCompactNumber, formatNumber, formatPercent, formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { RETURN_PERIODS, type AggregateReturnMatrixRow, type SortDirection } from './aggregateData'

const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart'))

export function formatMetric(value: number | null, kind: 'usd' | 'percent' | 'number' | 'multiple'): string {
	if (value == null || !Number.isFinite(value)) return '—'
	if (kind === 'usd') return formatUsd(value, { compact: true }) ?? '—'
	if (kind === 'percent') return formatPercent(value, { input: 'percent', maximumFractionDigits: 1 }) ?? '—'
	if (kind === 'multiple') return `${formatNumber(value, { maximumFractionDigits: 1 }) ?? '—'}×`
	return formatCompactNumber(value, { maximumFractionDigits: 1 }) ?? '—'
}

export function ChangeValue({ value }: { value: number | null }) {
	const color =
		value == null ? 'text-tertiary' : value > 0 ? 'text-data-up' : value < 0 ? 'text-data-down' : 'text-secondary'
	return <span className={color}>{formatPercentChange(value) ?? '—'}</span>
}

export function EquitiesPageHeader({
	crumb,
	title,
	description,
	meta
}: {
	crumb: string
	title: string
	description: ReactNode
	meta?: ReactNode
}) {
	return (
		<header className="flex flex-col gap-2 py-2">
			<p className="body-sm text-tertiary">
				<Link href="/equities" className="text-link hover:underline">
					Equities
				</Link>{' '}
				/ {crumb}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<h1 className="heading-lg">{title}</h1>
				{meta}
			</div>
			<p className="max-w-4xl body-md text-secondary">{description}</p>
		</header>
	)
}

export function MetricCard({
	label,
	value,
	detail,
	change,
	valueKind = 'metric'
}: {
	label: string
	value: ReactNode
	detail?: ReactNode
	change?: ReactNode
	valueKind?: 'metric' | 'text'
}) {
	return (
		<Card padding="md" className="@container flex min-w-0 flex-col gap-1">
			<p className="body-sm text-secondary">{label}</p>
			<p className={`truncate ${valueKind === 'metric' ? 'mono-lg @min-[13rem]:mono-xl' : 'heading-sm'}`}>{value}</p>
			{change ? <p className="label-sm">{change}</p> : null}
			{detail ? <p className="body-sm text-tertiary">{detail}</p> : null}
		</Card>
	)
}

export function StaleDataNotice({ stale, updatedAt }: { stale: boolean; updatedAt?: string | null }) {
	if (!stale) return null
	return (
		<InlineStatus variant="warning">
			Showing the latest available equity data
			{updatedAt ? ` from ${formatDate(updatedAt) ?? updatedAt}` : ''} while the source refreshes.
		</InlineStatus>
	)
}

export function AggregateTreemap({
	title,
	subtitle,
	nodes,
	valueLabel,
	controls
}: {
	title: string
	subtitle: string
	nodes: Array<TreemapNode>
	valueLabel: string
	controls?: ReactNode
}) {
	const { chartInstance, handleChartReady } = useGetChartInstance()

	return (
		<ChartPanel>
			<ChartPanelToolbar
				leading={
					<div>
						<h2 className="heading-xs">{title}</h2>
						<p className="body-sm text-tertiary">{subtitle}</p>
					</div>
				}
			>
				<div className="flex flex-wrap items-center gap-2">
					{controls}
					{nodes.length > 0 ? <ChartRestoreButton chartInstance={chartInstance} /> : null}
				</div>
			</ChartPanelToolbar>
			<ChartPanelBody>
				<Suspense fallback={<ChartPanelBodyFallback>Loading chart…</ChartPanelBodyFallback>}>
					<TreemapChart
						treeData={nodes}
						variant="rwa"
						colorMode="categorical"
						valueLabel={valueLabel}
						height="420px"
						onReady={handleChartReady}
						showRootLabel={false}
					/>
				</Suspense>
			</ChartPanelBody>
		</ChartPanel>
	)
}

export interface AggregateTableSort<K extends string> {
	key: K
	direction: SortDirection
}

export function AggregateTableScroller({ children }: { children: ReactNode }) {
	return (
		<div className="relative w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
			{children}
		</div>
	)
}

export function SortableTableHeader<K extends string>({
	column,
	sort,
	onSort,
	children,
	align = 'right',
	defaultDirection = 'desc',
	className = ''
}: {
	column: K
	sort: AggregateTableSort<K>
	onSort: (sort: AggregateTableSort<K>) => void
	children: ReactNode
	align?: 'left' | 'right'
	defaultDirection?: SortDirection
	className?: string
}) {
	const isActive = sort.key === column
	const direction = isActive ? sort.direction : false
	const nextDirection = isActive ? (sort.direction === 'asc' ? 'desc' : 'asc') : defaultDirection

	return (
		<th
			className={`px-2 py-3 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`.trim()}
			aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
		>
			<button
				type="button"
				className={`inline-grid max-w-full grid-cols-[minmax(0,1fr)_10px] items-center gap-1.5 leading-tight font-medium text-secondary hover:text-primary ${align === 'right' ? 'text-right' : 'text-left'}`}
				onClick={() => onSort({ key: column, direction: nextDirection })}
			>
				<span>{children}</span>
				<SortIcon dir={direction} />
			</button>
		</th>
	)
}

export function sectorColor(sectorSlug: string): string {
	const index = [
		'technology',
		'financial-services',
		'consumer-cyclical',
		'healthcare',
		'communication-services',
		'industrials',
		'consumer-defensive',
		'energy',
		'basic-materials',
		'utilities',
		'real-estate',
		'unknown'
	].indexOf(sectorSlug)
	return CHART_COLORS[index < 0 ? 0 : index % CHART_COLORS.length]
}

export function categoryColor(index: number): string {
	return CHART_COLORS[Math.abs(index) % CHART_COLORS.length]
}

export function ReturnMatrix({
	title,
	subtitle,
	rows
}: {
	title: string
	subtitle: string
	rows: Array<AggregateReturnMatrixRow>
}) {
	return (
		<Panel padding="none">
			<PanelHeader>
				<div className="mr-auto">
					<PanelTitle>{title}</PanelTitle>
					<p className="body-sm text-tertiary">{subtitle}</p>
				</div>
			</PanelHeader>
			<div className="overflow-x-auto p-2">
				<table className="w-full min-w-[720px] border-separate border-spacing-1.5">
					<thead>
						<tr>
							<th className="px-2 text-left table-header text-secondary">Name</th>
							{RETURN_PERIODS.map((period) => (
								<th key={period.key} className="px-2 text-center table-header text-secondary">
									{period.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={`${row.sectorSlug}:${row.industrySlug}`}>
								<th className="max-w-52 truncate px-2 py-2 text-left body-sm">
									<span
										className="mr-2 inline-block size-2 rounded-sm"
										style={{ backgroundColor: sectorColor(row.sectorSlug) }}
									/>
									{row.industry}
								</th>
								{RETURN_PERIODS.map((period) => {
									const value = row.values[period.key]
									const tone =
										value == null
											? 'bg-surface-elevated-1 text-tertiary'
											: value > 0
												? 'bg-data-up/10 text-data-up'
												: value < 0
													? 'bg-data-down/10 text-data-down'
													: 'bg-surface-elevated-1 text-secondary'
									return (
										<td key={period.key} className={`rounded-md px-2 py-2 text-center label-sm ${tone}`}>
											{formatPercentChange(value) ?? '—'}
										</td>
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Panel>
	)
}
