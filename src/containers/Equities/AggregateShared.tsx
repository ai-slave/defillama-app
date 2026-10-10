import Link from 'next/link'
import { lazy, Suspense, type ReactNode } from 'react'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { usePaginatedTableDisplayRowNumber } from '~/components/Table/PaginatedTable'
import { OTHERS_COLOR, SECTOR_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Change } from '~/ui/Change'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBody,
	ChartPanelBodyFallback,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { InlineStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { formatCompactNumber, formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
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
					<ChartPanelTitle headingAs="h2" subtitle={subtitle}>
						{title}
					</ChartPanelTitle>
				}
			>
				<div className="flex flex-wrap items-center gap-2">
					{controls}
					{nodes.length > 0 ? <ChartRestoreButton chartInstance={chartInstance} /> : null}
				</div>
			</ChartPanelToolbar>
			<ChartPanelBody className="min-h-[420px]">
				<Suspense fallback={<ChartPanelBodyFallback className="min-h-[420px]">Loading chart…</ChartPanelBodyFallback>}>
					<TreemapChart
						treeData={nodes}
						variant="rwa"
						colorMode="categorical"
						valueLabel={valueLabel}
						containerClassName={`${CHART_FILL} min-h-[420px]`}
						onReady={handleChartReady}
						showRootLabel={false}
					/>
				</Suspense>
			</ChartPanelBody>
		</ChartPanel>
	)
}

export function sectorColor(sectorSlug: string): string {
	return SECTOR_COLORS[sectorSlug] ?? OTHERS_COLOR
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
									// A heat-matrix cell tints its fill by sign; Change draws the text.
									const tone =
										value == null
											? 'bg-surface-elevated-1 text-tertiary'
											: value > 0
												? 'bg-data-up-tint'
												: value < 0
													? 'bg-data-down-tint'
													: 'bg-surface-elevated-1 text-secondary'
									return (
										<td key={period.key} className={`rounded-md px-2 py-2 text-center label-sm ${tone}`}>
											{value == null ? '—' : <Change value={value} />}
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
