import { createColumnHelper } from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { ICandlestickChartProps } from '~/components/ECharts/CandlestickChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBody,
	ChartPanelBodyFallback,
	ChartPanelBodyLoading,
	ChartPanelExportShellLoading,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { TagGroup } from '~/ui/SegmentedControl'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import type { IDATCompanyPageProps } from './types'

const DEFAULT_SORTING_STATE = [{ id: 'report_date', desc: true }]

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const CandlestickChart: React.LazyExoticComponent<React.ComponentType<ICandlestickChartProps>> = lazy(
	() => import('~/components/ECharts/CandlestickChart')
)

function getType(type: string): string {
	switch (type) {
		case 'purchase':
			return 'Purchase'
		case 'sale':
			return 'Sale'
		case 'mined':
			return 'Mined'
		case 'staking_reward':
			return 'Staking Reward'
		default:
			return type
	}
}

function getSourceType(sourceType: string): string {
	switch (sourceType) {
		case 'filing':
			return 'Filing'
		case 'twitter':
			return 'X/Twitter'
		case 'press-release':
			return 'Press Release'
		case 'site':
			return 'Site'
		case 'other':
			return 'Other'
		default:
			return sourceType
	}
}

export function DATCompany(props: IDATCompanyPageProps) {
	const [selectedAsset, setSelectedAsset] = useState<string | null>(() => props.assets[0] ?? null)
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const chartData = useMemo(() => {
		return props.chartByAsset.find((asset) => asset.ticker === selectedAsset)
	}, [selectedAsset, props.chartByAsset])
	const holdingsExportTitle = selectedAsset ? `${props.name} ${selectedAsset} Holdings` : `${props.name} Holdings`

	return (
		<>
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					<h1 className="heading-sm">{props.name}</h1>
					<div className="flex flex-col">
						{props.assetsBreakdown.length > 1 ? (
							<>
								<MetricRow label="Assets in Holdings" value={props.assets.join(', ')} />
								{props.totalUsdValue != null ? (
									<MetricRow
										label="Assets Today's Value (USD)"
										value={formatUsd(props.totalUsdValue, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
									/>
								) : null}
								{props.totalCost != null ? (
									<MetricRow
										label="Assets Cost Basis"
										value={
											props.totalCost != null
												? formatUsd(props.totalCost, {
														compact: true,
														minimumCompactValue: 1_000_000,
														compactSuffix: 'lowercase'
													})
												: '-'
										}
									/>
								) : null}
							</>
						) : null}
						{props.assetsBreakdown.map((asset, index) => (
							<MetricSection
								key={`${props.ticker}-${asset.name}`}
								label={`Total ${asset.name}`}
								value={`${formatCompactNumber(asset.amount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} ${asset.ticker}`}
								defaultOpen={props.assetsBreakdown.length === 1 && index === 0}
							>
								<SubMetricRow
									label="Today's Value (USD)"
									value={
										asset.usdValue != null
											? formatUsd(asset.usdValue, {
													compact: true,
													minimumCompactValue: 1_000_000,
													compactSuffix: 'lowercase'
												})
											: null
									}
								/>
								<SubMetricRow
									label="Cost Basis"
									value={
										asset.cost != null
											? formatUsd(asset.cost, {
													compact: true,
													minimumCompactValue: 1_000_000,
													compactSuffix: 'lowercase'
												})
											: '-'
									}
								/>
								<SubMetricRow
									label="Average Purchase Price"
									value={
										asset.avgPrice != null
											? formatUsd(asset.avgPrice, {
													compact: true,
													minimumCompactValue: 1_000_000,
													compactSuffix: 'lowercase'
												})
											: '-'
									}
								/>
							</MetricSection>
						))}
						<MetricRow
							label="First Announcement"
							value={props.firstAnnouncementDate != null ? formatDate(props.firstAnnouncementDate) : null}
						/>
						<MetricRow
							label="Latest Announcement"
							value={props.lastAnnouncementDate != null ? formatDate(props.lastAnnouncementDate) : null}
						/>
						<MetricRow label="Total Transactions" value={props.transactions.length} />
						{props.price != null ? (
							<MetricRow
								label={`$${props.ticker} price`}
								value={
									props.priceChange24h != null ? (
										<Tooltip
											content={
												<>
													24h change: <Change value={props.priceChange24h} />
												</>
											}
											className="cursor-help underline decoration-dotted"
											tabIndex={0}
										>
											${props.price}
										</Tooltip>
									) : (
										<>${props.price}</>
									)
								}
							/>
						) : null}
						{props.realized_mNAV != null ? (
							<MetricRow
								label="Realized mNAV"
								tooltip="Market Net Asset Value based only on the current outstanding common shares, with no dilution considered"
								value={formatCompactNumber(props.realized_mNAV, {
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
						{props.realistic_mNAV != null ? (
							<MetricRow
								label="Realistic mNAV"
								tooltip="Market Net asset value adjusted for expected dilution from in-the-money options and convertibles that are likely to be exercised"
								value={formatCompactNumber(props.realistic_mNAV, {
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
						{props.max_mNAV != null ? (
							<MetricRow
								label="Max mNAV"
								tooltip="Market Net Asset Value under the fully diluted scenario, assuming every warrant, option, and convertible is exercised (the most conservative/worst-case view)"
								value={formatCompactNumber(props.max_mNAV, {
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
					</div>
					<Button as={BasicLink} href="/report-error" size="md" className="mt-auto mr-auto">
						Report incorrect data
					</Button>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar>
						<h2 className="mr-auto heading-xs">Cumulative Holdings Over Time</h2>
						{props.assets.length > 1 ? (
							<TagGroup
								size="md"
								selectedValue={selectedAsset}
								setValue={setSelectedAsset}
								values={props.assets}
								variant="default"
							/>
						) : null}
						<ChartExportButtons
							chartInstance={chartInstance}
							filename={`${props.name}-holdings`}
							title={holdingsExportTitle}
							csvSource={chartData ? { type: 'dataset', prepare: () => chartData.holdingsChart.dataset } : null}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						{chartData != null ? (
							<MultiSeriesChart
								containerClassName={CHART_FILL}
								dataset={chartData.holdingsChart.dataset}
								charts={chartData.holdingsChart.charts}
								valueSymbol={chartData.ticker}
								hideDataZoom={chartData.holdingsChart.dataset.source.length < 2}
								chartOptions={chartOptions}
								onReady={handleChartReady}
							/>
						) : (
							<ChartPanelBodyFallback />
						)}
					</Suspense>
				</ChartPanel>
			</SummaryCardGrid>
			<div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
				{props.mNAVChart != null ? (
					<ChartPanel className="col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={props.mNAVChart.dataset}
								charts={props.mNAVChart.charts}
								containerClassName={CHART_FILL}
								valueSymbol=""
								showLegend
								title="mNAV"
								exportButtons={{
									png: true,
									csv: true,
									filename: `${props.name}-mnav`,
									pngTitle: `${props.name} mNAV`
								}}
							/>
						</Suspense>
					</ChartPanel>
				) : null}
				{props.fdChart != null ? (
					<ChartPanel className="col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={props.fdChart.dataset}
								charts={props.fdChart.charts}
								containerClassName={CHART_FILL}
								valueSymbol=""
								showLegend
								title="Fully Diluted Shares"
								exportButtons={{
									png: true,
									csv: true,
									filename: `${props.name}-fully-diluted-shares`,
									pngTitle: `${props.name} Fully Diluted Shares`
								}}
							/>
						</Suspense>
					</ChartPanel>
				) : null}
				{props.ohlcvChartData != null ? (
					<ChartPanel className="col-span-full">
						<ChartPanelToolbar leading={<ChartPanelTitle headingAs="h2">Share Price</ChartPanelTitle>} />
						{/* The candlestick sets its own height: 480px plus any indicator panels. */}
						<ChartPanelBody className="min-h-[480px]">
							<Suspense fallback={<ChartPanelBodyLoading className="min-h-[480px]" />}>
								<CandlestickChart data={props.ohlcvChartData} />
							</Suspense>
						</ChartPanelBody>
						<p className="p-2 pt-0 body-sm text-tertiary">Source: Yahoo Finance</p>
					</ChartPanel>
				) : null}
				{props.totalAssetValueChart != null ? (
					<ChartPanel className="col-span-full">
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={props.totalAssetValueChart.dataset}
								charts={props.totalAssetValueChart.charts}
								valueSymbol="$"
								title="Total Asset Value"
								exportButtons={{
									png: true,
									csv: true,
									filename: `${props.name}-total-asset-value`,
									pngTitle: `${props.name} Total Asset Value`
								}}
							/>
						</Suspense>
					</ChartPanel>
				) : null}
			</div>
			<SearchTableProvider
				options={{
					data: props.transactions,
					columns: datTransactionColumns,
					initialState: { sorting: DEFAULT_SORTING_STATE }
				}}
			>
				<Card padding="none">
					<TableToolbar>
						<TableSearchInput columnId="assetName" placeholder="Search assets" />
						<TableCsvExport filename={`${props.name}-transactions`} />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</>
	)
}

type TransactionRow = IDATCompanyPageProps['transactions'][number]
const columnHelper = createColumnHelper<SearchTableFeatures, TransactionRow>()

export const datTransactionColumns = columnHelper.columns([
	columnHelper.accessor('assetName', {
		header: 'Asset',
		enableSorting: false,
		cell: (info) => info.getValue(),
		meta: {
			headerClassName: 'w-[160px]'
		}
	}),
	columnHelper.accessor(
		(row) => {
			return row.type === 'sale' ? -row.amount : row.amount
		},
		{
			id: 'amount',
			header: 'Amount',
			cell: ({ getValue, row }) => {
				const value = getValue()
				return (
					<span>
						<Change value={value} unit="count" /> {row.original.assetTicker}
					</span>
				)
			},
			meta: {
				headerClassName: 'w-[160px]',
				align: 'end'
			}
		}
	),
	columnHelper.accessor((row) => row.avg_price ?? undefined, {
		id: 'avg_price',
		header: 'Avg Purchase Price',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[168px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.usd_value ?? undefined, {
		id: 'usd_value',
		header: 'USD Value',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[130px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('report_date', {
		header: 'Report Date',
		cell: (info) => (info.getValue() != null ? formatDate(info.getValue()) : null),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('type', {
		header: 'Type',
		cell: (info) => getType(info.getValue()),
		enableSorting: false,
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('source_type', {
		header: 'Source Type',
		cell: (info) => getSourceType(info.getValue()),
		enableSorting: false,
		meta: {
			headerClassName: 'w-[130px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('source_url', {
		header: 'Source URL',
		cell: ({ getValue }) => {
			const url = getValue()
			if (!url) return null
			return (
				<a
					className="flex items-center justify-center gap-4 rounded-md bg-brand-tint p-1.5 hover:bg-brand-tint-strong active:bg-brand-tint-pressed"
					href={url}
					target="_blank"
					rel="noopener noreferrer"
				>
					<Icon name="arrow-up-right" className="size-3.5" />
					<span className="sr-only">open in new tab</span>
				</a>
			)
		},
		enableSorting: false,
		meta: {
			headerClassName: 'w-[120px]'
		}
	}),
	columnHelper.accessor('source_note', {
		header: 'Source Note',
		cell: ({ getValue }) => {
			const v = getValue()
			return (
				<Tooltip content={v} render={<span />}>
					{v}
				</Tooltip>
			)
		},
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(1000px,40vw)]'
		}
	})
])

/** Narrow an unknown echarts tooltip param to a record, or return undefined. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value != null ? (value as Record<string, unknown>) : undefined
}

const chartOptions = {
	tooltip: {
		formatter: (params: unknown) => {
			const paramsArray = Array.isArray(params) ? params : [params]
			const firstParam = asRecord(paramsArray[0])
			if (!firstParam) return ''
			const data = asRecord(firstParam.data) ?? {}
			const valueArray = Array.isArray(firstParam.value) ? firstParam.value : undefined
			const timestamp = data.timestamp ?? valueArray?.[0] ?? firstParam.axisValue
			const seriesName = typeof firstParam.seriesName === 'string' ? firstParam.seriesName : undefined
			const holdings = (seriesName != null ? data[seriesName] : undefined) ?? valueArray?.[1]
			const deltaRaw = data.delta ?? valueArray?.[2]
			const avgPrice = data.avgPrice ?? valueArray?.[3]
			const usdValue = data.usdValue ?? valueArray?.[4]
			const deltaValue = typeof deltaRaw === 'number' ? deltaRaw : Number(deltaRaw ?? 0)
			const label = deltaValue < 0 ? 'Sold' : 'Purchased'
			const valueLabel = deltaValue < 0 ? 'Sale value' : 'Purchase value'
			const timestampNum =
				typeof timestamp === 'number' ? timestamp : typeof timestamp === 'string' ? Number(timestamp) : undefined
			let val =
				`${formatDate(timestampNum, { input: 'milliseconds' })}<li style="list-style:none">${label}:&nbsp;&nbsp;` +
				`<span style="font-weight:600;">${formatCompactNumber(Math.abs(deltaValue), {
					minimumCompactValue: 1_000_000,
					compactSuffix: 'lowercase'
				})}&nbsp;${escapeHtml(seriesName ?? '')}</span>` +
				`</li>`

			if (avgPrice != null) {
				val +=
					`<li style="list-style:none">` +
					`Cost basis per unit:` +
					`&nbsp;&nbsp;` +
					`<span style="font-weight:600;">${formatUsd(Number(avgPrice), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}</span>` +
					`</li>`
			}

			if (usdValue != null) {
				val +=
					`<li style="list-style:none">${valueLabel}:&nbsp;&nbsp;` +
					`<span style="font-weight:600;">${formatUsd(Number(usdValue), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}</span>` +
					`</li>`
			}

			val +=
				`<li style="list-style:none">` +
				`Holdings till date:` +
				`&nbsp;&nbsp;` +
				`<span style="font-weight:600;">${formatCompactNumber(
					typeof holdings === 'number' ? holdings : Number(holdings ?? 0),
					{
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}
				)}&nbsp;${escapeHtml(seriesName ?? '')}</span>` +
				`</li>`
			return val
		}
	}
}
