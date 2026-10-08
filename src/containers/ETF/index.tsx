import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { selectChartDatasetColumns } from '~/components/ECharts/MultiSeriesChart/selection'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { IconsRow } from '~/components/IconsRow'
import { toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { useLocalSelection } from '~/components/Select/localSelection'
import { Select } from '~/components/Select/Select'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { tokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { buildETFChartSpec, ETF_ASSET_NAMES } from './chartData'
import type { ETFOverviewProps, IETFSnapshotRow } from './types'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const ASSETS = ETF_ASSET_NAMES.map((name) => ({ key: name.toLowerCase(), name, iconUrl: tokenIconUrl(name) }))

const DEFAULT_SORTING_STATE = [{ id: 'aum', desc: true }]

export function ETFOverview({ snapshot, flows, totalsByAsset, lastUpdated }: ETFOverviewProps) {
	const [groupBy, setGroupBy] = React.useState<LowercaseDwmcGrouping>('weekly')
	const {
		activeSeries: tickers,
		selectedCharts,
		setSelectedSeries: setTickers
	} = useLocalSelection({ scope: 'etf-assets', availableSeries: ETF_ASSET_NAMES })
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
											className={`ml-auto mono-md ${assetFlows > 0 ? 'text-data-up' : assetFlows < 0 ? 'text-data-down' : ''}`}
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
										<span className="ml-auto mono-md">
											{formatUsd(aum, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
										</span>
									</p>
								</div>
							)
						})}
					</div>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar>
						<h2 className="mr-auto heading-xs">Flows (Source: Farside)</h2>
						<ChartGroupingSelector value={groupBy} setValue={setGroupBy} options={DWMC_GROUPING_OPTIONS_LOWERCASE} />
						<Select
							allValues={ETF_ASSET_NAMES}
							selectedValues={tickers}
							setSelectedValues={setTickers}
							label="Asset"
							labelType="smol"
							variant="filter"
							size="md"
						/>
						<ChartExportButtons
							chartInstance={chartInstance}
							filename="etf-flows"
							title="ETF Flows"
							csvSource={{
								type: 'dataset',
								prepare: () => ({
									...selectChartDatasetColumns(
										finalCharts.dataset,
										finalCharts.charts.filter((chart) => selectedCharts.has(chart.name))
									),
									groupBy
								})
							}}
						/>
					</ChartPanelToolbar>
					<React.Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={finalCharts.dataset}
							charts={finalCharts.charts}
							selectedCharts={selectedCharts}
							groupBy={groupBy}
							containerClassName="flex-1 min-h-[360px]"
							onReady={handleChartReady}
						/>
					</React.Suspense>
				</ChartPanel>
			</SummaryCardGrid>
			<SearchTableProvider options={{ data: snapshot, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}>
				<Card padding="none">
					<TableToolbar>
						<h2 className="mr-auto label-md">Exchange Traded Funds</h2>
						<TableSearchInput
							columnId="ticker"
							placeholder="Search ETF..."
							className={searchFieldInlineWrapperStyles}
						/>
						<TableCsvExport filename="etf-overview" />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</>
	)
}

const columnHelper = createColumnHelper<SearchTableFeatures, IETFSnapshotRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('ticker', {
		header: 'Ticker',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<BasicLink href={row.original.url} className="truncate label-md text-link hover:underline">
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
	columnHelper.accessor((row) => row.flows ?? undefined, {
		id: 'flows',
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
	columnHelper.accessor((row) => row.aum ?? undefined, {
		id: 'aum',
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
	columnHelper.accessor((row) => row.volume ?? undefined, {
		id: 'volume',
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
])
