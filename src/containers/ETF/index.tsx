import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { IconsRow } from '~/components/IconsRow'
import { toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { Select } from '~/components/Select/Select'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { tokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { buildETFChartSpec, ETF_ASSET_NAMES } from './chartData'
import type { ETFOverviewProps, IETFSnapshotRow } from './types'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const ASSETS = [
	{ key: 'bitcoin', name: 'Bitcoin', iconUrl: tokenIconUrl('bitcoin') },
	{ key: 'ethereum', name: 'Ethereum', iconUrl: tokenIconUrl('ethereum') },
	{ key: 'solana', name: 'Solana', iconUrl: tokenIconUrl('solana') }
] as const

type GroupBy = LowercaseDwmcGrouping

const DEFAULT_SORTING_STATE = [{ id: 'aum', desc: true }]

export const ETFOverview = ({ snapshot, flows, totalsByAsset, lastUpdated }: ETFOverviewProps) => {
	const [groupBy, setGroupBy] = React.useState<GroupBy>('weekly')
	const {
		activeSeries: tickers,
		selectedCharts,
		setSelectedSeries: setTickers
	} = useSeriesSelection({ availableSeries: ETF_ASSET_NAMES })
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const finalCharts = React.useMemo(() => {
		return buildETFChartSpec({ flows, groupBy, assets: [...ETF_ASSET_NAMES] })
	}, [flows, groupBy])

	return (
		<>
			<SummaryCardGrid>
				<SummaryStatsCard>
					<div>
						<h1 className="heading-sm">Daily Stats</h1>
						<span className="body-sm text-tertiary">{lastUpdated}</span>
					</div>

					<div className="flex flex-col gap-4">
						{ASSETS.map(({ key, name, iconUrl }) => {
							const assetFlows = totalsByAsset[key]?.flows ?? 0
							const aum = totalsByAsset[key]?.aum ?? 0
							return (
								<div key={key} className="flex flex-col gap-1">
									<div className="flex items-center gap-2">
										<img src={iconUrl} alt={name} width={24} height={24} className="rounded-full" />
										<span className="heading-xs">{name}</span>
									</div>
									<p className="flex flex-wrap justify-start gap-4 pl-8">
										<span className="text-secondary">Flows</span>
										<span
											className={`ml-auto font-jetbrains text-base font-medium ${assetFlows > 0 ? 'text-data-up' : assetFlows < 0 ? 'text-data-down' : ''}`}
										>
											{formatUsd(assetFlows, {
												compact: true,
												minimumCompactValue: 1_000_000,
												compactSuffix: 'lowercase'
											})}
										</span>
									</p>
									<p className="flex flex-wrap justify-start gap-4 pl-8">
										<span className="text-secondary">AUM</span>
										<span className="ml-auto font-jetbrains text-base font-medium">
											{formatUsd(aum, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
										</span>
									</p>
								</div>
							)
						})}
					</div>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar className="justify-end">
						<h2 className="mr-auto heading-xs">Flows (Source: Farside)</h2>
						<ChartGroupingSelector value={groupBy} setValue={setGroupBy} options={DWMC_GROUPING_OPTIONS_LOWERCASE} />
						<Select
							allValues={ETF_ASSET_NAMES}
							selectedValues={tickers}
							setSelectedValues={setTickers}
							label="Asset"
							labelType="smol"
							variant="filter-responsive"
							size="md"
						/>
						<ChartExportButtons
							chartInstance={chartInstance}
							filename="etf-flows"
							title="ETF Flows"
							csvSource={{ type: 'dataset', prepare: () => finalCharts.dataset }}
						/>
					</ChartPanelToolbar>
					<React.Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={finalCharts.dataset}
							charts={finalCharts.charts}
							selectedCharts={selectedCharts}
							groupBy={groupBy}
							onReady={handleChartReady}
						/>
					</React.Suspense>
				</ChartPanel>
			</SummaryCardGrid>
			<TableWithSearch
				data={snapshot}
				columns={columns}
				columnToSearch={'ticker'}
				placeholder={'Search ETF...'}
				header="Exchange Traded Funds"
				csvFileName="etf-overview"
				sortingState={DEFAULT_SORTING_STATE}
			/>
		</>
	)
}

const columnHelper = createColumnHelper<IETFSnapshotRow>()

const columns = [
	columnHelper.accessor('ticker', {
		header: 'Ticker',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<BasicLink href={row.original.url} className="truncate text-sm font-medium text-link hover:underline">
						{getValue()}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[100px]'
		}
	}),
	columnHelper.accessor('issuer', {
		header: 'Issuer',
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('chain', {
		header: 'Coin',
		enableSorting: true,
		cell: ({ getValue }) => <IconsRow items={toChainIconItems(getValue())} />,
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('flows', {
		header: 'Flows',
		cell: ({ getValue }) => {
			const value = getValue()
			const formattedValue =
				value != null
					? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: null

			return (
				<span
					className={value != null && value > 0 ? 'text-data-up' : value != null && value < 0 ? 'text-data-down' : ''}
				>
					{formattedValue}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('aum', {
		header: 'AUM',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('volume', {
		header: 'Volume',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	})
]
