import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { LoadingDots } from '~/ui/Loaders'
import { Panel } from '~/ui/Panel'
import { PanelStatus } from '~/ui/Status'
import { formattedNum, slug } from '~/utils'
import { getEnabledForkOracleExtraTvlChartApiKeys } from '~/utils/tvlOverlap'
import { buildForksOverviewDisplayData, mergeForkOverviewChartData } from './overviewData'
import { useForksOverviewExtraSeries } from './queries.client'
import type { ForkOverviewPageData } from './types'

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart'))

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const columnHelper = createColumnHelper<ReturnType<typeof buildForksOverviewDisplayData>['tableData'][number]>()

const forksColumn = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const name = getValue()
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${name}`} />
					<span className="flex items-center gap-1 overflow-hidden">
						<BasicLink
							href={`/forks/${slug(name)}`}
							className="min-w-0 truncate text-sm font-medium text-link hover:underline"
						>
							{name}
						</BasicLink>
						{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
					</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor('forkedProtocols', {
		header: 'Forked Protocols',
		meta: {
			headerClassName: 'w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('tvl', {
		header: 'Forks TVL',
		cell: (info) => (info.getValue() != null ? formattedNum(info.getValue(), true) : null),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('ftot', {
		header: 'Forks TVL / Original TVL',
		cell: (info) => (info.getValue() != null ? `${formattedNum(info.getValue())}%` : null),
		meta: {
			headerClassName: 'w-[min(210px,40vw)]',
			align: 'end'
		}
	})
]

const DEFAULT_SORTING_STATE = [{ id: 'tvl', desc: true }]

export const ForksOverview = ({
	forks,
	forkLinks,
	forkColors,
	tableData: baseTableData,
	chartData
}: ForkOverviewPageData) => {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const enabledExtraApiKeys = React.useMemo(
		() => getEnabledForkOracleExtraTvlChartApiKeys(extraTvlsEnabled),
		[extraTvlsEnabled]
	)
	const { isFetchingExtraSeries, extraBreakdownByTimestamp } = useForksOverviewExtraSeries({
		enabledExtraApiKeys
	})

	const shouldApplyExtraSeries = enabledExtraApiKeys.length > 0 && !isFetchingExtraSeries

	const mergedChartData = React.useMemo(() => {
		return mergeForkOverviewChartData({ chartData, extraBreakdownByTimestamp, shouldApplyExtraSeries })
	}, [chartData, extraBreakdownByTimestamp, shouldApplyExtraSeries])

	const { tableData, tokenTvls, dominanceDataset, dominanceCharts, chartColors } = React.useMemo(() => {
		return buildForksOverviewDisplayData({ forks, forkColors, baseTableData, chartData: mergedChartData })
	}, [baseTableData, forkColors, forks, mergedChartData])

	const isLoading = enabledExtraApiKeys.length > 0 && isFetchingExtraSeries
	return (
		<>
			<RowLinksWithDropdown links={forkLinks} activeLink="All" />
			{isLoading ? (
				<PanelStatus variant="loading" textClassName="flex items-center gap-1">
					Loading
					<LoadingDots />
				</PanelStatus>
			) : (
				<>
					<div className="flex flex-col gap-2 xl:flex-row">
						<ChartPanel className="isolate flex-1">
							<React.Suspense fallback={<ChartPanelExportShellFallback />}>
								<PieChart
									chartData={tokenTvls}
									stackColors={chartColors}
									exportButtons={{ png: true, csv: true, filename: 'forks-tvl-pie', pngTitle: 'Forks TVL Breakdown' }}
									title="Forks TVL Breakdown"
								/>
							</React.Suspense>
						</ChartPanel>
						<ChartPanel className="flex-1">
							<React.Suspense fallback={<ChartPanelExportShellFallback />}>
								<MultiSeriesChart
									dataset={dominanceDataset}
									charts={dominanceCharts}
									stacked={true}
									expandTo100Percent={true}
									hideDefaultLegend
									valueSymbol="%"
									exportButtons={{
										png: true,
										csv: true,
										filename: 'forks-dominance-chart',
										pngTitle: 'Forks TVL Dominance (%)'
									}}
									title="Forks TVL Dominance (%)"
								/>
							</React.Suspense>
						</ChartPanel>
					</div>
					<React.Suspense fallback={<Panel padding="none" style={{ minHeight: `${tableData.length * 50 + 200}px` }} />}>
						<TableWithSearch
							data={tableData}
							columns={forksColumn}
							placeholder="Search protocols..."
							columnToSearch="name"
							header="Protocol Rankings"
							headingAs="h1"
							csvFileName="forks-overview"
							sortingState={DEFAULT_SORTING_STATE}
						/>
					</React.Suspense>
				</>
			)}
		</>
	)
}
