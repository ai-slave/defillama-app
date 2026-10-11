import { createColumnHelper } from '@tanstack/react-table'
import { lazy, Suspense, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { selectChartDatasetColumns } from '~/components/ECharts/MultiSeriesChart/selection'
import { createInflowsTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { useLocalSelection } from '~/components/Select/localSelection'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { ChartPanelExportShellLoading, ChartPanelToolbar } from '~/ui/ChartPanel'
import { MetricRow } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatCompactNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { IDATOverviewDataByAssetProps } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const DEFAULT_SORTING_STATE = [{ id: 'totalAssetAmount', desc: true }]

export function DATByAsset({
	allAssets,
	metadata,
	dailyFlowsChart,
	institutions,
	mNAVRealizedChart,
	mNAVRealisticChart,
	mNAVMaxChart,
	institutionsNames
}: IDATOverviewDataByAssetProps) {
	const inflowsTooltipFormatter = useMemo(
		() => createInflowsTooltipFormatter({ groupBy: 'daily', valueSymbol: metadata.ticker }),
		[metadata.ticker]
	)
	const columns = useMemo(() => byAssetColumns({ symbol: metadata.ticker }), [metadata.ticker])

	return (
		<>
			<RowLinksWithDropdown heading="Assets" links={allAssets} activeLink={metadata.name} />
			<SummaryCardGrid>
				<SummaryStatsCard>
					<Tooltip
						render={<h1 />}
						content={`Institutions that own ${metadata.name} as part of their corporate treasury`}
						className="heading-sm"
					>
						{metadata.name} Treasury Holdings
					</Tooltip>
					<div className="flex flex-col">
						<MetricRow label="Total Institution" value={metadata.companies} />
						<MetricRow
							label="Total Holdings"
							value={`${formatCompactNumber(metadata.totalAmount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} ${metadata.ticker}`}
						/>
						<MetricRow
							label="Total USD Value"
							value={formatUsd(metadata.totalUsdValue, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						{metadata.circSupplyPerc != null ? (
							<MetricRow
								label={`% of ${metadata.ticker} Circulating Supply`}
								value={formatPercent(metadata.circSupplyPerc, { input: 'percent', maximumFractionDigits: 3 })}
							/>
						) : null}
					</div>
					<Button as={BasicLink} href="/report-error" size="md" className="mt-auto mr-auto">
						Report incorrect data
					</Button>
				</SummaryStatsCard>
				<Panel className="col-span-2">
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							dataset={dailyFlowsChart.dataset}
							charts={dailyFlowsChart.charts}
							valueSymbol={metadata.ticker}
							chartOptions={
								(dailyFlowsChart.charts?.length ?? 0) > 1
									? { tooltip: { formatter: inflowsTooltipFormatter } }
									: undefined
							}
							hideDataZoom={dailyFlowsChart.dataset.source.length < 2}
							title="Inflows"
							exportButtons={{
								png: true,
								csv: true,
								filename: `${metadata.name}-inflows`,
								pngTitle: `${metadata.name} Inflows`
							}}
						/>
					</Suspense>
				</Panel>
			</SummaryCardGrid>
			<div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
				<MNAVChart
					metadata={metadata}
					title="mNAV Realized"
					data={mNAVRealizedChart}
					institutionsNames={institutionsNames}
				/>
				<MNAVChart
					metadata={metadata}
					title="mNAV Realistic"
					data={mNAVRealisticChart}
					institutionsNames={institutionsNames}
				/>
				<MNAVChart metadata={metadata} title="mNAV Max" data={mNAVMaxChart} institutionsNames={institutionsNames} />
			</div>
			<SearchTableProvider options={{ data: institutions, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}>
				<Card padding="none">
					<TableToolbar>
						<TableSearchInput columnId="name" placeholder="Search institutions" />
						<TableCsvExport filename={`${metadata.name}-treasury-holdings`} />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</>
	)
}

// ── Table columns ───────────────────────────────────────────────────────

function byAssetColumns({ symbol }: { symbol: string }) {
	const columnHelper = createColumnHelper<SearchTableFeatures, IDATOverviewDataByAssetProps['institutions'][number]>()
	return columnHelper.columns([
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
							className="truncate label-md text-link hover:underline"
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
		columnHelper.accessor((row) => row.holdings.amount ?? undefined, {
			id: 'totalAssetAmount',
			header: 'Holdings',
			cell: ({ getValue }) => {
				const totalAssetAmount = getValue()
				if (totalAssetAmount == null) return null
				return (
					<>{`${formatCompactNumber(totalAssetAmount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} ${symbol}`}</>
				)
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.holdings.usdValue ?? undefined, {
			id: 'totalUsdValue',
			header: "Today's Holdings Value",
			cell: ({ getValue }) => {
				const usdValue = getValue()
				if (usdValue == null) return null
				return <>{formatUsd(usdValue, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
			},
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
					<Definition
						content={
							<>
								24h change: <Change value={priceChange24h} />
							</>
						}
						className="justify-end"
					>
						{formatUsd(price, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
					</Definition>
				)
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.holdings.supplyPercentage ?? undefined, {
			id: 'supplyPercentage',
			header: `% of ${symbol} Circulating Supply`,
			cell: ({ getValue }) => {
				const supplyPercentage = getValue()
				if (supplyPercentage == null) return null
				return (
					<>
						{formatPercent(supplyPercentage, {
							input: 'percent',
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					</>
				)
			},
			meta: {
				headerClassName: 'w-[min(228px,40vw)]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.realized_mNAV ?? undefined, {
			id: 'realized_mNAV',
			header: 'Realized mNAV',
			cell: ({ getValue }) => {
				const realized_mNAV = getValue()
				if (realized_mNAV == null) return null
				return <>{formatCompactNumber(realized_mNAV, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
			},
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
			cell: ({ getValue }) => {
				const realistic_mNAV = getValue()
				if (realistic_mNAV == null) return null
				return (
					<>{formatCompactNumber(realistic_mNAV, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
				)
			},
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
			cell: ({ getValue }) => {
				const max_mNAV = getValue()
				if (max_mNAV == null) return null
				return <>{formatCompactNumber(max_mNAV, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText:
					'Market Net Asset Value under the fully diluted scenario, assuming every warrant, option, and convertible is exercised (the most conservative/worst-case view)'
			}
		}),
		columnHelper.accessor((row) => row.holdings.avgPrice ?? undefined, {
			id: 'avgPrice',
			header: 'Avg Purchase Price',
			cell: ({ getValue }) => {
				const avgPrice = getValue()
				if (avgPrice == null) return null
				return <>{formatUsd(avgPrice, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
			},
			meta: {
				headerClassName: 'w-[168px]',
				align: 'end',
				headerHelperText: `Average cost per ${symbol} of the institution's holdings`
			}
		}),
		columnHelper.accessor((row) => row.holdings.lastAnnouncementDate, {
			id: 'lastAnnouncementDate',
			header: 'Last Updated',
			cell: ({ getValue }) => {
				const lastUpdated = getValue()
				if (lastUpdated == null) return null
				return <>{formatDate(lastUpdated)}</>
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText:
					'Some companies do not update their holdings frequently, so the last announcement date may not be the most recent'
			}
		})
	])
}

// ── mNAV chart sub-component ────────────────────────────────────────────

function MNAVChart({
	title,
	data,
	institutionsNames,
	metadata
}: {
	title: string
	data: IDATOverviewDataByAssetProps['mNAVRealizedChart']
	institutionsNames: Array<string>
	metadata: IDATOverviewDataByAssetProps['metadata']
}) {
	const {
		activeSeries: selectedInstitution,
		selectedCharts,
		setSelectedSeries: setSelectedInstitution
	} = useLocalSelection({ availableSeries: institutionsNames, scope: `${metadata.name}:${title}` })

	const { chartInstance, handleChartReady } = useGetChartInstance()

	return (
		<Panel className="col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar>
				<h2 className="mr-auto heading-xs">{title}</h2>
				{institutionsNames.length > 1 ? (
					<SelectWithCombobox
						allValues={institutionsNames}
						selectedValues={selectedInstitution}
						setSelectedValues={setSelectedInstitution}
						label="Institutions"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={`${metadata.name}-${title}`}
					title={`${metadata.name} ${title}`}
					csvSource={{
						type: 'dataset',
						prepare: () =>
							selectChartDatasetColumns(
								data.dataset,
								data.charts.filter((chart) => selectedCharts.has(chart.name))
							)
					}}
				/>
			</ChartPanelToolbar>
			<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
				<MultiSeriesChart
					charts={data.charts}
					selectedCharts={selectedCharts}
					dataset={data.dataset}
					valueSymbol=""
					hideDataZoom={data.dataset.source.length < 2}
					onReady={handleChartReady}
				/>
			</Suspense>
		</Panel>
	)
}
