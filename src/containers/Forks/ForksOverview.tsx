import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { LoadingDots } from '~/components/Loaders'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { Panel } from '~/ui/Panel'
import { formattedNum, slug } from '~/utils'
import { getEnabledForkOracleExtraTvlChartApiKeys } from '~/utils/tvlOverlap'
import { buildForksOverviewDisplayData, mergeForkOverviewChartData } from './overviewData'
import { useForksOverviewExtraSeries } from './queries.client'
import type { ForkOverviewPageData } from './types'

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart'))

const MultiSeriesChart2 = React.lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

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
					<BasicLink
						href={`/forks/${slug(name)}`}
						className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap text-(--link-text) hover:underline"
					>
						{name}
					</BasicLink>
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
				<Panel padding="md" className="flex-1 items-center justify-center">
					<p role="status" aria-live="polite" className="flex items-center gap-1 body-sm text-tertiary">
						Loading
						<LoadingDots />
					</p>
				</Panel>
			) : (
				<>
					<div className="flex flex-col gap-2 xl:flex-row">
						<Panel className="isolate flex-1">
							<React.Suspense fallback={<div className="min-h-[406px]" />}>
								<PieChart
									chartData={tokenTvls}
									stackColors={chartColors}
									exportButtons={{ png: true, csv: true, filename: 'forks-tvl-pie', pngTitle: 'Forks TVL Breakdown' }}
									title="Forks TVL Breakdown"
								/>
							</React.Suspense>
						</Panel>
						<Panel className="flex-1">
							<React.Suspense fallback={<div className="min-h-[406px]" />}>
								<MultiSeriesChart2
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
						</Panel>
					</div>
					<React.Suspense fallback={<Panel style={{ minHeight: `${tableData.length * 50 + 200}px` }} />}>
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
