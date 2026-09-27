import { createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildTimeSeriesChart } from '~/components/ECharts/MultiSeriesChart/timeSeriesBuilder'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Hovercard } from '~/ui/Hovercard'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { formatCompactNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { IDATOverviewFlowSeries, IDATOverviewPageProps } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const DEFAULT_SORTING_STATE = [{ id: 'totalUsdValue', desc: true }]

const normalizeChartGroup = (value: string | null | undefined): LowercaseDwmcGrouping | null => {
	const normalizedValue = value?.toLowerCase() ?? null
	if (DWMC_GROUPING_OPTIONS_LOWERCASE.some((option) => option.value === normalizedValue)) {
		return normalizedValue as LowercaseDwmcGrouping
	}
	return null
}

export function DATOverview({ allAssets, institutions, dailyFlowsByAsset }: IDATOverviewPageProps) {
	const router = useRouter()
	const groupBy = normalizeChartGroup(readSingleQueryValue(router.query.groupBy)) ?? 'weekly'

	const { chartData } = useMemo(() => {
		if (groupBy === 'cumulative') {
			const series: Array<{ name: string; color: string; points: IDATOverviewFlowSeries['points'] }> = []
			for (const name in dailyFlowsByAsset) {
				const item = dailyFlowsByAsset[name]
				series.push({ name: item.name, color: item.color, points: item.points })
			}
			return {
				chartData: { ...buildTimeSeriesChart({ kind: 'cumulativeLines', series }), groupBy }
			}
		}

		const series: Array<IDATOverviewFlowSeries> = []
		for (const name in dailyFlowsByAsset) {
			series.push(dailyFlowsByAsset[name])
		}
		return {
			// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
			chartData: { ...buildTimeSeriesChart({ kind: 'periodBars', groupBy, series }), groupBy }
		}
	}, [dailyFlowsByAsset, groupBy])
	const deferredChartData = useDeferredValue(chartData)
	const assetSeries = useMemo(() => chartData.charts.map((chart) => chart.name), [chartData.charts])
	const { activeSeries, selectedCharts, setSelectedSeries } = useSeriesSelection({ availableSeries: assetSeries })

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const onChangeGroupBy = (nextGroupBy: LowercaseDwmcGrouping) => {
		void pushShallowQuery(router, { groupBy: nextGroupBy === 'weekly' ? undefined : nextGroupBy })
	}

	return (
		<>
			<RowLinksWithDropdown links={allAssets} activeLink="All" />
			<ChartPanel className="col-span-2">
				<ChartPanelToolbar>
					<h1 className="mr-auto heading-xs">DAT Inflows by Asset</h1>
					<ChartGroupingSelector
						value={groupBy}
						onValueChange={onChangeGroupBy}
						options={DWMC_GROUPING_OPTIONS_LOWERCASE}
					/>
					{assetSeries.length > 1 ? (
						<SelectWithCombobox
							allValues={assetSeries}
							selectedValues={activeSeries}
							setSelectedValues={setSelectedSeries}
							label="Asset"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename="digital-asset-treasuries-inflows-by-asset"
						title="DAT Inflows by Asset"
						csvSource={{
							type: 'dataset',
							prepare: () => ({ ...deferredChartData.dataset, groupBy: deferredChartData.groupBy })
						}}
					/>
				</ChartPanelToolbar>
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={deferredChartData.dataset}
						charts={deferredChartData.charts}
						selectedCharts={selectedCharts}
						groupBy={deferredChartData.groupBy}
						valueSymbol="$"
						showTotalInTooltip
						onReady={handleChartReady}
					/>
				</Suspense>
			</ChartPanel>
			<SearchTableProvider
				options={{ data: institutions, columns: overviewColumns, initialState: { sorting: DEFAULT_SORTING_STATE } }}
			>
				<Card padding="none">
					<TableToolbar>
						<TableSearchInput columnId="name" placeholder="Search institutions" />
						<TableCsvExport filename="digital-asset-treasuries" />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</>
	)
}

// ── Table columns ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<SearchTableFeatures, IDATOverviewPageProps['institutions'][0]>()

const overviewColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Institution',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const name = getValue()

			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<BasicLink
						href={`/digital-asset-treasury/${encodeURIComponent(row.original.ticker)}`}
						title={name}
						className="truncate text-sm font-medium text-link"
					>
						{name}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(228px,40vw)]',
			align: 'start'
		}
	}),
	columnHelper.accessor(
		(row) =>
			row.holdings
				.map(
					(asset) =>
						`${asset.name} (${formatPercent(Number(asset.dominance) || 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })})`
				)
				.join(', '),
		{
			id: 'holdings',
			header: 'Assets',
			enableSorting: false,
			cell: (info) => {
				const assetBreakdown = info.row.original.holdings

				return (
					<Hovercard
						content={<AssetTooltipContent assetBreakdown={assetBreakdown} />}
						contentClassName="w-72 max-w-(--popover-available-width) p-3"
						render={<button type="button" />}
						className="h-5 w-full bg-surface-elevated-2 align-middle"
					>
						{assetBreakdown.map((asset) => (
							<div
								key={asset.asset}
								style={{ width: `${asset.dominance}%`, background: asset.color }}
								className="h-5"
							/>
						))}
					</Hovercard>
				)
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}
	),
	columnHelper.accessor((row) => row.totalCost ?? undefined, {
		id: 'totalCost',
		header: 'Cost Basis',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.totalUsdValue ?? undefined, {
		id: 'totalUsdValue',
		header: "Today's Holdings Value",
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(196px,40vw)]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: 'Stock Price',
		cell: ({ getValue, row }) => {
			const price = getValue()
			if (price == null) return null
			const priceChange24h = row.original.priceChange24h
			if (priceChange24h == null)
				return <>{formatUsd(price, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
			return (
				<Tooltip
					content={
						<>
							24h change:{' '}
							<span
								className={priceChange24h > 0 ? 'text-data-up' : priceChange24h < 0 ? 'text-data-down' : ''}
							>{`${priceChange24h > 0 ? '+' : ''}${formatPercent(priceChange24h, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`}</span>
						</>
					}
					className="justify-end underline decoration-dotted"
				>
					{formatUsd(price, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</Tooltip>
			)
		},
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.realized_mNAV ?? undefined, {
		id: 'realized_mNAV',
		header: 'Realized mNAV',
		cell: (info) =>
			info.getValue() != null
				? formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText:
				'Market Net Asset Value based only on the current outstanding common shares, with no dilution considered.'
		}
	}),
	columnHelper.accessor((row) => row.realistic_mNAV ?? undefined, {
		id: 'realistic_mNAV',
		header: 'Realistic mNAV',
		cell: (info) =>
			info.getValue() != null
				? formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText:
				'Market Net Asset Value adjusted for expected dilution from in-the-money options and convertibles that are likely to be exercised'
		}
	}),
	columnHelper.accessor((row) => row.max_mNAV ?? undefined, {
		id: 'max_mNAV',
		header: 'Max mNAV',
		cell: (info) =>
			info.getValue() != null
				? formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText:
				'Market Net Asset Value under the fully diluted scenario, assuming every warrant, option, and convertible is exercised (the most conservative/worst-case view)'
		}
	})
])

// ── Tooltip helpers ─────────────────────────────────────────────────────

interface BreakdownData {
	asset: string
	name: string
	amount?: number | null
	ticker?: string
	cost?: number | null
	usdValue?: number | null
	avgPrice?: number | null
	dominance: number
	color: string
}

function Breakdown({ data }: { data: BreakdownData }) {
	const name = `${data.name} (${formatPercent(data.dominance, { input: 'percent' })})`

	return (
		<span className="flex flex-col gap-1 border-l-3 pl-1 text-xs" style={{ borderColor: data.color }}>
			<span className="break-words">{name}</span>
			{data.amount != null ? (
				<span>{`Amount: ${formatCompactNumber(data.amount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} ${data.ticker}`}</span>
			) : null}
			{data.usdValue != null ? (
				<span>{`Today's Value: ${formatUsd(data.usdValue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
			) : null}
			{data.cost != null ? (
				<span>{`Cost Basis: ${formatUsd(data.cost, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
			) : null}
			{data.avgPrice != null ? (
				<span>{`Average Purchase Price: ${formatUsd(data.avgPrice, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
			) : null}
		</span>
	)
}

function AssetTooltipContent({ assetBreakdown }: { assetBreakdown: Array<BreakdownData> }) {
	return (
		<span className="flex flex-col gap-4">
			{assetBreakdown.map((breakdown) => (
				<Breakdown data={breakdown} key={breakdown.asset} />
			))}
		</span>
	)
}
