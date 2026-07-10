import { createColumnHelper } from '@tanstack/react-table'
import dayjs from 'dayjs'
import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import type { ICandlestickChartProps } from '~/components/ECharts/types'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { MetricRow, MetricSection, SubMetricRow } from '~/components/MetricPrimitives'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TagGroup } from '~/components/TagGroup'
import { Tooltip } from '~/components/Tooltip'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formattedNum } from '~/utils'
import type { IDATCompanyPageProps } from './types'

const DEFAULT_SORTING_STATE = [{ id: 'report_date', desc: true }]

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))
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
			return 'Twitter'
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
									<MetricRow label="Assets Today's Value (USD)" value={formattedNum(props.totalUsdValue, true)} />
								) : null}
								{props.totalCost != null ? (
									<MetricRow
										label="Assets Cost Basis"
										value={props.totalCost != null ? formattedNum(props.totalCost, true) : '-'}
									/>
								) : null}
							</>
						) : null}
						{props.assetsBreakdown.map((asset, index) => (
							<MetricSection
								key={`${props.ticker}-${asset.name}`}
								label={`Total ${asset.name}`}
								value={`${formattedNum(asset.amount, false)} ${asset.ticker}`}
								defaultOpen={props.assetsBreakdown.length === 1 && index === 0}
							>
								<SubMetricRow
									label="Today's Value (USD)"
									value={asset.usdValue != null ? formattedNum(asset.usdValue, true) : null}
								/>
								<SubMetricRow label="Cost Basis" value={asset.cost != null ? formattedNum(asset.cost, true) : '-'} />
								<SubMetricRow
									label="Average Purchase Price"
									value={asset.avgPrice != null ? formattedNum(asset.avgPrice, true) : '-'}
								/>
							</MetricSection>
						))}
						<MetricRow
							label="First Announcement"
							value={
								props.firstAnnouncementDate != null ? dayjs(props.firstAnnouncementDate).format('MMM D, YYYY') : null
							}
						/>
						<MetricRow
							label="Latest Announcement"
							value={
								props.lastAnnouncementDate != null ? dayjs(props.lastAnnouncementDate).format('MMM D, YYYY') : null
							}
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
													24h change:{' '}
													<span className={props.priceChange24h > 0 ? 'text-data-up' : 'text-data-down'}>
														{`${props.priceChange24h > 0 ? '+' : ''}${props.priceChange24h.toFixed(2)}%`}
													</span>
												</>
											}
											className="underline decoration-dotted"
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
								value={formattedNum(props.realized_mNAV, false)}
							/>
						) : null}
						{props.realistic_mNAV != null ? (
							<MetricRow
								label="Realistic mNAV"
								tooltip="Market Net asset value adjusted for expected dilution from in-the-money options and convertibles that are likely to be exercised"
								value={formattedNum(props.realistic_mNAV, false)}
							/>
						) : null}
						{props.max_mNAV != null ? (
							<MetricRow
								label="Max mNAV"
								tooltip={`Market Net Asset Value under the fully diluted scenario, assuming every warrant, option, and convertible is exercised (the most conservative/worst-case view)`}
								value={formattedNum(props.max_mNAV, false)}
							/>
						) : null}
					</div>
					<Button as={BasicLink} href="/report-error" size="md" className="mt-auto mr-auto">
						Report incorrect data
					</Button>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar className="justify-end">
						<h2 className="mr-auto heading-xs">Cumulative Holdings Over Time</h2>
						{props.assets.length > 1 ? (
							<TagGroup
								size="md"
								selectedValue={selectedAsset}
								setValue={setSelectedAsset}
								values={props.assets}
								variant="responsive"
							/>
						) : null}
						<ChartExportButtons
							chartInstance={chartInstance}
							filename={`${props.name}-holdings`}
							title={holdingsExportTitle}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyFallback />}>
						{chartData != null ? (
							<MultiSeriesChart2
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
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart2
								dataset={props.mNAVChart.dataset}
								charts={props.mNAVChart.charts}
								valueSymbol=""
								hideDefaultLegend={false}
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
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart2
								dataset={props.fdChart.dataset}
								charts={props.fdChart.charts}
								valueSymbol=""
								hideDefaultLegend={false}
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
					<Panel padding="none" className="col-span-full min-h-[480px]">
						<h2 className="mr-auto p-2 heading-xs">Share Price</h2>
						<Suspense fallback={<div className="h-[480px]" />}>
							<CandlestickChart data={props.ohlcvChartData} />
						</Suspense>
						<p className="p-2 body-sm text-secondary">Source: Yahoo Finance</p>
					</Panel>
				) : null}
				{props.totalAssetValueChart != null ? (
					<ChartPanel className="col-span-full">
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart2
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
			<TableWithSearch
				data={props.transactions}
				columns={columns}
				placeholder="Search assets"
				columnToSearch="assetName"
				csvFileName={`${props.name}-transactions`}
				sortingState={DEFAULT_SORTING_STATE}
			/>
		</>
	)
}

type TransactionRow = IDATCompanyPageProps['transactions'][number]
const columnHelper = createColumnHelper<TransactionRow>()

const columns = [
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
			return row.type === 'sale' ? -Number(row.amount) : Number(row.amount)
		},
		{
			id: 'amount',
			header: 'Amount',
			cell: ({ getValue, row }) => {
				const value = getValue()
				return (
					<span className={value < 0 ? 'text-data-down' : 'text-data-up'}>
						{`${value < 0 ? '-' : '+'}${formattedNum(Math.abs(value), false)} ${row.original.assetTicker}`}
					</span>
				)
			},
			meta: {
				headerClassName: 'w-[160px]',
				align: 'end'
			}
		}
	),
	columnHelper.accessor('avg_price', {
		header: 'Avg Purchase Price',
		cell: (info) => (info.getValue() != null ? formattedNum(info.getValue(), true) : null),
		meta: {
			headerClassName: 'w-[168px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('usd_value', {
		header: 'USD Value',
		cell: (info) => (info.getValue() != null ? formattedNum(info.getValue(), true) : null),
		meta: {
			headerClassName: 'w-[130px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('report_date', {
		header: 'Report Date',
		cell: (info) => (info.getValue() != null ? dayjs(info.getValue()).format('MMM D, YYYY') : null),
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
					className="flex items-center justify-center gap-4 rounded-md bg-(--legacy-btn2-bg) p-1.5 hover:bg-(--legacy-btn2-hover-bg)"
					href={url}
					target="_blank"
					rel="noopener noreferrer"
				>
					<Icon name="arrow-up-right" height={14} width={14} />
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
				<Tooltip className="inline overflow-hidden text-ellipsis whitespace-nowrap" content={v}>
					{v}
				</Tooltip>
			)
		},
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(1000px,40vw)]'
		}
	})
]

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
				dayjs(timestampNum).format('MMM D, YYYY') +
				'<li style="list-style:none">' +
				`${label}:` +
				'&nbsp;&nbsp;' +
				'<span style="font-weight:600;">' +
				formattedNum(Math.abs(deltaValue), false) +
				'&nbsp;' +
				(seriesName ?? '') +
				'</span>' +
				'</li>'

			if (avgPrice != null) {
				val +=
					'<li style="list-style:none">' +
					`Cost basis per unit:` +
					'&nbsp;&nbsp;' +
					'<span style="font-weight:600;">' +
					formattedNum(Number(avgPrice), true) +
					'</span>' +
					'</li>'
			}

			if (usdValue != null) {
				val +=
					'<li style="list-style:none">' +
					`${valueLabel}:` +
					'&nbsp;&nbsp;' +
					'<span style="font-weight:600;">' +
					formattedNum(Number(usdValue), true) +
					'</span>' +
					'</li>'
			}

			val +=
				'<li style="list-style:none">' +
				`Holdings till date:` +
				'&nbsp;&nbsp;' +
				'<span style="font-weight:600;">' +
				formattedNum(typeof holdings === 'number' ? holdings : Number(holdings ?? 0), false) +
				'&nbsp;' +
				(seriesName ?? '') +
				'</span>' +
				'</li>'
			return val
		}
	}
}
