import { createColumnHelper } from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { createInflowsTooltipFormatter } from '~/components/ECharts/formatters'
import { BasicLink } from '~/components/Link'
import { MetricRow } from '~/components/MetricPrimitives'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { Tooltip } from '~/components/Tooltip'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formattedNum } from '~/utils'
import type { IDATOverviewDataByAssetProps } from './types'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

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
	const stableInstitutionsKey = useMemo(() => JSON.stringify([...institutionsNames].sort()), [institutionsNames])

	return (
		<>
			<RowLinksWithDropdown links={allAssets} activeLink={metadata.name} />
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
							value={`${formattedNum(metadata.totalAmount, false)} ${metadata.ticker}`}
						/>
						<MetricRow label="Total USD Value" value={formattedNum(metadata.totalUsdValue, true)} />
						{metadata.circSupplyPerc != null ? (
							<MetricRow
								label={`% of ${metadata.ticker} Circulating Supply`}
								value={`${metadata.circSupplyPerc.toLocaleString(undefined, { maximumFractionDigits: 3 })}%`}
							/>
						) : null}
					</div>
					<Button as={BasicLink} href="/report-error" size="md" className="mt-auto mr-auto">
						Report incorrect data
					</Button>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart2
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
				</ChartPanel>
			</SummaryCardGrid>
			<div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
				<MNAVChart
					key={`realized-${stableInstitutionsKey}`}
					metadata={metadata}
					title="mNAV Realized"
					data={mNAVRealizedChart}
					institutionsNames={institutionsNames}
				/>
				<MNAVChart
					key={`realistic-${stableInstitutionsKey}`}
					metadata={metadata}
					title="mNAV Realistic"
					data={mNAVRealisticChart}
					institutionsNames={institutionsNames}
				/>
				<MNAVChart
					key={`max-${stableInstitutionsKey}`}
					metadata={metadata}
					title="mNAV Max"
					data={mNAVMaxChart}
					institutionsNames={institutionsNames}
				/>
			</div>
			<TableWithSearch
				data={institutions}
				columns={columns}
				placeholder="Search institutions"
				columnToSearch="name"
				sortingState={DEFAULT_SORTING_STATE}
				csvFileName={`${metadata.name}-treasury-holdings`}
			/>
		</>
	)
}

// ── Table columns ───────────────────────────────────────────────────────

function byAssetColumns({ symbol }: { symbol: string }) {
	const columnHelper = createColumnHelper<IDATOverviewDataByAssetProps['institutions'][number]>()
	return [
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
							className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap text-link"
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
		columnHelper.accessor((row) => row.holdings.amount, {
			id: 'totalAssetAmount',
			header: 'Holdings',
			cell: ({ getValue }) => {
				const totalAssetAmount = getValue()
				if (totalAssetAmount == null) return null
				return <>{`${formattedNum(totalAssetAmount, false)} ${symbol}`}</>
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.holdings.usdValue, {
			id: 'totalUsdValue',
			header: "Today's Holdings Value",
			cell: ({ getValue }) => {
				const usdValue = getValue()
				if (usdValue == null) return null
				return <>{formattedNum(usdValue, true)}</>
			},
			meta: {
				headerClassName: 'w-[min(196px,40vw)]',
				align: 'end'
			}
		}),
		columnHelper.accessor('price', {
			header: 'Stock Price',
			cell: ({ getValue, row }) => {
				const price = getValue()
				if (price == null) return null
				const priceChange24h = row.original.priceChange24h
				if (priceChange24h == null) return <>{formattedNum(price, true)}</>
				return (
					<Tooltip
						content={
							<>
								24h change:{' '}
								<span
									className={priceChange24h > 0 ? 'text-data-up' : priceChange24h < 0 ? 'text-data-down' : ''}
								>{`${priceChange24h > 0 ? '+' : ''}${priceChange24h.toFixed(2)}%`}</span>
							</>
						}
						className="justify-end underline decoration-dotted"
					>
						{formattedNum(price, true)}
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.holdings.supplyPercentage, {
			id: 'supplyPercentage',
			header: `% of ${symbol} Circulating Supply`,
			cell: ({ getValue }) => {
				const supplyPercentage = getValue()
				if (supplyPercentage == null) return null
				return <>{formattedNum(supplyPercentage, false)}%</>
			},
			meta: {
				headerClassName: 'w-[min(228px,40vw)]',
				align: 'end'
			}
		}),
		columnHelper.accessor('realized_mNAV', {
			header: 'Realized mNAV',
			cell: ({ getValue }) => {
				const realized_mNAV = getValue()
				if (realized_mNAV == null) return null
				return <>{formattedNum(realized_mNAV, false)}</>
			},
			meta: {
				headerClassName: 'w-[140px]',
				align: 'end',
				headerHelperText:
					'Market Net Asset Value based only on the current outstanding common shares, with no dilution considered.'
			}
		}),
		columnHelper.accessor('realistic_mNAV', {
			header: 'Realistic mNAV',
			cell: ({ getValue }) => {
				const realistic_mNAV = getValue()
				if (realistic_mNAV == null) return null
				return <>{formattedNum(realistic_mNAV, false)}</>
			},
			meta: {
				headerClassName: 'w-[140px]',
				align: 'end',
				headerHelperText:
					'Market Net Asset Value adjusted for expected dilution from in-the-money options and convertibles that are likely to be exercised'
			}
		}),
		columnHelper.accessor('max_mNAV', {
			header: 'Max mNAV',
			cell: ({ getValue }) => {
				const max_mNAV = getValue()
				if (max_mNAV == null) return null
				return <>{formattedNum(max_mNAV, false)}</>
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText:
					'Market Net Asset Value under the fully diluted scenario, assuming every warrant, option, and convertible is exercised (the most conservative/worst-case view)'
			}
		}),
		columnHelper.accessor((row) => row.holdings.avgPrice, {
			id: 'avgPrice',
			header: 'Avg Purchase Price',
			cell: ({ getValue }) => {
				const avgPrice = getValue()
				if (avgPrice == null) return null
				return <>{formattedNum(avgPrice, true)}</>
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
				return <>{new Date(lastUpdated).toLocaleDateString()}</>
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText:
					'Some companies do not update their holdings frequently, so the last announcement date may not be the most recent'
			}
		})
	]
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
	institutionsNames: string[]
	metadata: IDATOverviewDataByAssetProps['metadata']
}) {
	const [selectedInstitution, setSelectedInstitution] = useState<string[]>(institutionsNames)

	const selectedCharts = useMemo(() => {
		return new Set(selectedInstitution)
	}, [selectedInstitution])

	const { chartInstance, handleChartReady } = useGetChartInstance()

	return (
		<ChartPanel className="col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				<SelectWithCombobox
					allValues={institutionsNames}
					selectedValues={selectedInstitution}
					setSelectedValues={setSelectedInstitution}
					label="Institutions"
					labelType="smol"
					variant="filter"
					size="md"
				/>
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={`${metadata.name}-${title}`}
					title={`${metadata.name} ${title}`}
				/>
			</ChartPanelToolbar>
			<Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart2
					charts={data.charts}
					selectedCharts={selectedCharts}
					dataset={data.dataset}
					valueSymbol=""
					hideDataZoom={data.dataset.source.length < 2}
					onReady={handleChartReady}
				/>
			</Suspense>
		</ChartPanel>
	)
}
