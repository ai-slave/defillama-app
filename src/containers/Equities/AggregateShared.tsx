import Link from 'next/link'
import { lazy, Suspense, type ReactNode } from 'react'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { usePaginatedTableDisplayRowNumber } from '~/components/Table/PaginatedTable'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { InlineStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { formatCompactNumber, formatNumber, formatPercent, formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { RETURN_PERIODS, type AggregateReturnMatrixRow } from './aggregateData'

const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart'))

export function formatMetric(
	value: number | null | undefined,
	kind: 'usd' | 'percent' | 'number' | 'multiple'
): string {
	if (value == null) return '—'
	if (kind === 'usd') return formatUsd(value, { compact: true }) ?? '—'
	if (kind === 'percent') return formatPercent(value, { input: 'percent', maximumFractionDigits: 1 }) ?? '—'
	if (kind === 'multiple') return `${formatNumber(value, { maximumFractionDigits: 1 }) ?? '—'}×`
	return formatCompactNumber(value, { maximumFractionDigits: 1 }) ?? '—'
}

/** A paginated table's display rank, shown inside its name cell so the CSV keeps one column per value. */
export function RowNumber({ rowId }: { rowId: string }) {
	return (
		<span className="inline-block min-w-6 shrink-0 text-tertiary" aria-hidden="true">
			{usePaginatedTableDisplayRowNumber(rowId)}
		</span>
	)
}

export function ChangeValue({ value }: { value: number | null | undefined }) {
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

/** The dense KPI card of the Equities aggregate pages. A numeric value is mono-lg in cards narrower than 13rem and
    mono-xl when the card has room, so compact currency values stay whole instead of ending in an ellipsis; a text
    value (`valueKind="text"`) is heading-sm and may truncate. */
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

export function treemapChildColors(parentColor: string, count: number): Array<string> {
	if (count <= 1) return [parentColor]

	const red = parseInt(parentColor.slice(1, 3), 16)
	const green = parseInt(parentColor.slice(3, 5), 16)
	const blue = parseInt(parentColor.slice(5, 7), 16)

	return Array.from({ length: count }, (_, index) => {
		const ratio = 0.12 + (index / (count - 1)) * 0.34
		return `rgb(${Math.round(red + (255 - red) * ratio)}, ${Math.round(green + (255 - green) * ratio)}, ${Math.round(blue + (255 - blue) * ratio)})`
	})
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
