import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedAdditiveChart } from '~/components/ECharts/MultiSeriesChart/selection'
import { useLocalSelection } from '~/components/Select/localSelection'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { usePageClockSec } from '~/hooks/usePageClock'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { RowExpandButton } from '~/ui/DisclosureChevron'
import { Panel } from '~/ui/Panel'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { formatUsd } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { categoryIntro } from './categoryLead'
import { getCategoryRoute } from './categoryRoutes'
import {
	applyProtocolsCategoriesTvlSettings,
	buildProtocolsCategoriesTvlCharts,
	getEnabledProtocolsCategoriesTvls
} from './tvl'
import type { IProtocolsCategoriesChartData, IProtocolsCategoriesPageData, IProtocolsCategoriesTableRow } from './types'

const DEFAULT_SORTING_STATE = [{ id: 'tvl', desc: true }]
const columnHelper = createColumnHelper<SearchTableFeatures, IProtocolsCategoriesTableRow>()
const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const categoriesColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Category',
		enableSorting: false,
		meta: {
			headerClassName: 'min-w-[min(240px,40vw)]'
		},
		cell: ({ getValue, row }) => {
			const categoryName = getValue()

			return (
				<span className={`relative flex items-center gap-2 ${row.depth > 0 ? 'pl-8' : 'pl-4'}`}>
					{row.subRows?.length != null && row.subRows.length > 0 ? (
						<RowExpandButton
							expanded={row.getIsExpanded()}
							onClick={row.getToggleExpandedHandler()}
							label={row.getIsExpanded() ? 'Hide tags' : 'View tags'}
							className="absolute -left-2"
						/>
					) : null}
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TextLink href={getCategoryRoute(slug(categoryName))} truncate>
						{categoryName}
					</TextLink>
				</span>
			)
		}
	}),
	columnHelper.accessor((row) => row.protocols ?? undefined, {
		id: 'protocols',
		header: 'Protocols',
		meta: {
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.tvl ?? undefined, {
		id: 'tvl',
		header: 'Combined TVL',
		meta: {
			align: 'end'
		},
		cell: ({ getValue }) => {
			const value = getValue()
			return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		}
	}),
	columnHelper.accessor((row) => row.change_1d ?? undefined, {
		id: 'change_1d',
		header: '1d TVL Change',
		meta: {
			align: 'end'
		},
		cell: ({ getValue }) => <Change value={getValue()} />
	}),
	columnHelper.accessor((row) => row.change_7d ?? undefined, {
		id: 'change_7d',
		header: '7d TVL Change',
		meta: {
			align: 'end'
		},
		cell: ({ getValue }) => <Change value={getValue()} />
	}),
	columnHelper.accessor((row) => row.change_1m ?? undefined, {
		id: 'change_1m',
		header: '30d TVL Change',
		meta: {
			align: 'end'
		},
		cell: ({ getValue }) => <Change value={getValue()} />
	}),
	columnHelper.accessor((row) => row.revenue ?? undefined, {
		id: 'revenue',
		header: 'Combined 24h Revenue',
		meta: {
			align: 'end'
		},
		cell: ({ getValue }) => {
			const value = getValue()
			return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		}
	}),
	columnHelper.accessor('description', {
		header: 'Description',
		enableSorting: false,
		meta: {
			headerClassName: 'min-w-[min(1600px,40vw)]'
		}
	})
])

export function ProtocolsCategoriesPage(props: IProtocolsCategoriesPageData) {
	const { categories, tableData, chartSource, categoryColors, extraTvlCharts } = props
	const {
		activeSeries: selectedCategories,
		selectedCharts,
		setSelectedSeries: setSelectedCategories
	} = useLocalSelection({ scope: 'categories-tvl', availableSeries: categories })
	const chartExport = useGetChartInstance()
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const enabledTvls = React.useMemo(() => getEnabledProtocolsCategoriesTvls(extraTvlsEnabled), [extraTvlsEnabled])
	const enabledTvlsKey = enabledTvls.join(',')
	const shouldFetchChartData = chartSource.length === 0
	const chartDataQuery = useQuery({
		queryKey: ['page-data', 'categories', 'charts', enabledTvlsKey],
		queryFn: () => {
			const searchParams = new URLSearchParams()
			if (enabledTvlsKey) {
				searchParams.set('extraTvlTypes', enabledTvlsKey)
			}
			const queryString = searchParams.toString()
			return fetchJson<IProtocolsCategoriesChartData>(
				`/api/public/page-data/categories/charts${queryString ? `?${queryString}` : ''}`
			)
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: shouldFetchChartData
	})
	const categoriesChartSource = chartDataQuery.data?.chartSource ?? chartSource
	const categoriesExtraTvlCharts = chartDataQuery.data?.extraTvlCharts ?? extraTvlCharts

	const finalCharts = React.useMemo(() => {
		return buildProtocolsCategoriesTvlCharts({
			categories,
			categoryColors,
			chartSource: categoriesChartSource,
			extraTvlCharts: categoriesExtraTvlCharts,
			enabledTvls
		})
	}, [categories, categoryColors, categoriesChartSource, enabledTvls, categoriesExtraTvlCharts])
	const deferredFinalCharts = React.useDeferredValue(finalCharts)
	const selectedPresentation = React.useMemo(
		() =>
			buildSelectedAdditiveChart({
				dataset: deferredFinalCharts.dataset,
				charts: deferredFinalCharts.charts,
				seriesOrder: categories,
				selectedCharts
			}),
		[categories, deferredFinalCharts, selectedCharts]
	)

	const finalCategoriesList = React.useMemo(() => {
		return applyProtocolsCategoriesTvlSettings({ tableData, enabledTvls })
	}, [enabledTvls, tableData])
	const intro = categoryIntro(usePageClockSec(), tableData)

	return (
		<>
			<Panel>
				<ChartPanelToolbar>
					<div className="mr-auto flex min-w-0 flex-col gap-1">
						<h1 className="heading-xs">Protocol categories by TVL and revenue</h1>
						<p className="body-sm text-secondary">{intro}</p>
					</div>
					{categories.length > 1 ? (
						<SelectWithCombobox
							allValues={categories}
							selectedValues={selectedCategories}
							setSelectedValues={setSelectedCategories}
							label="Categories"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chart={chartExport}
						filename="categories-tvl"
						title="Protocol TVL"
						csvSource={selectedPresentation.csvSource}
					/>
				</ChartPanelToolbar>
				{queryReadFailed(chartDataQuery) ? (
					<SurfaceBodyStatus variant="error" retry={chartDataQuery}>
						Couldn&apos;t load chart data.
					</SurfaceBodyStatus>
				) : shouldFetchChartData && chartDataQuery.isLoading ? (
					<SurfaceBodyLoadingStatus label="Loading chart" />
				) : (
					<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<MultiSeriesChart
							exportButtons={chartExport}
							dataset={selectedPresentation.dataset}
							charts={selectedPresentation.charts}
							csvSource={selectedPresentation.csvSource}
							valueSymbol="$"
							solidChartAreaStyle
							showTotalInTooltip
							requireCompleteTooltipTotal
						/>
					</React.Suspense>
				)}
			</Panel>

			<React.Suspense fallback={<Panel style={{ minHeight: `${categories.length * 50 + 200}px` }} />}>
				<SearchTableProvider
					options={{
						data: finalCategoriesList,
						columns: categoriesColumns,
						initialState: { sorting: DEFAULT_SORTING_STATE },
						getSubRows: (row) => row.subRows
					}}
				>
					<Card padding="none">
						<TableToolbar>
							<TableSearchInput columnId="name" placeholder="Search category…" />
							<TableCsvExport filename="protocol-categories" />
						</TableToolbar>
						<VirtualSearchTableView />
					</Card>
				</SearchTableProvider>
			</React.Suspense>
		</>
	)
}
