import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedAdditiveChart } from '~/components/ECharts/MultiSeriesChart/selection'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import { Button } from '~/ui/Button'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { PercentChange } from '~/ui/PercentChange'
import { LoadingIndicator } from '~/ui/Status'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import { formatUsd } from '~/utils/numberFormat'
import { getCategoryRoute } from './categoryRoutes'
import {
	applyProtocolsCategoriesTvlSettings,
	buildProtocolsCategoriesTvlCharts,
	getEnabledProtocolsCategoriesTvls
} from './tvl'
import type { IProtocolsCategoriesChartData, IProtocolsCategoriesPageData, IProtocolsCategoriesTableRow } from './types'

const DEFAULT_SORTING_STATE = [{ id: 'tvl', desc: true }]
const columnHelper = createColumnHelper<IProtocolsCategoriesTableRow>()
const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const categoriesColumns = [
	columnHelper.accessor('name', {
		header: 'Category',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		},
		cell: ({ getValue, row }) => {
			const categoryName = getValue()

			return (
				<span className={`relative flex items-center gap-2 ${row.depth > 0 ? 'pl-8' : 'pl-4'}`}>
					{row.subRows?.length != null && row.subRows.length > 0 ? (
						<Button
							size="sm"
							variant="ghost"
							square
							type="button"
							className="absolute -left-2"
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">Hide tags</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">View tags</span>
								</>
							)}
						</Button>
					) : null}
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<BasicLink
						href={getCategoryRoute(slug(categoryName))}
						className="truncate text-sm font-medium text-link hover:underline"
					>
						{categoryName}
					</BasicLink>
				</span>
			)
		}
	}),
	columnHelper.accessor((row) => row.protocols ?? undefined, {
		id: 'protocols',
		header: 'Protocols',
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.tvl ?? undefined, {
		id: 'tvl',
		header: 'Combined TVL',
		meta: {
			headerClassName: 'w-[135px]',
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
			headerClassName: 'w-[140px]',
			align: 'end'
		},
		cell: ({ getValue }) => <PercentChange percent={getValue()} />
	}),
	columnHelper.accessor((row) => row.change_7d ?? undefined, {
		id: 'change_7d',
		header: '7d TVL Change',
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end'
		},
		cell: ({ getValue }) => <PercentChange percent={getValue()} />
	}),
	columnHelper.accessor((row) => row.change_1m ?? undefined, {
		id: 'change_1m',
		header: '1m TVL Change',
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end'
		},
		cell: ({ getValue }) => <PercentChange percent={getValue()} />
	}),
	columnHelper.accessor((row) => row.revenue ?? undefined, {
		id: 'revenue',
		header: 'Combined 24h Revenue',
		meta: {
			headerClassName: 'w-[min(200px,40vw)]',
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
			headerClassName: 'w-[min(1600px,40vw)]'
		}
	})
]

export function ProtocolsCategoriesPage(props: IProtocolsCategoriesPageData) {
	const { categories, tableData, chartSource, categoryColors, extraTvlCharts } = props
	const {
		activeSeries: selectedCategories,
		selectedCharts,
		setSelectedSeries: setSelectedCategories
	} = useSeriesSelection({ availableSeries: categories })
	const { chartInstance, handleChartReady } = useGetChartInstance()
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
	const chartErrorMessage = chartDataQuery.error ? getErrorMessage(chartDataQuery.error) : null

	const finalCategoriesList = React.useMemo(() => {
		return applyProtocolsCategoriesTvlSettings({ tableData, enabledTvls })
	}, [enabledTvls, tableData])

	return (
		<>
			<ChartPanel>
				<ChartPanelToolbar className="justify-end">
					<h1 className="mr-auto heading-xs">TVL by Category</h1>
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
						chartInstance={chartInstance}
						filename="categories-tvl"
						title="Protocol TVL"
						csvSource={selectedPresentation.csvSource}
					/>
				</ChartPanelToolbar>
				{shouldFetchChartData && chartDataQuery.isLoading ? (
					<ChartPanelBodyFallback role="status" aria-live="polite" className="text-tertiary">
						<LoadingIndicator />
					</ChartPanelBodyFallback>
				) : chartErrorMessage ? (
					<ChartPanelBodyFallback role="alert" className="p-4 text-center body-sm text-data-down">
						Failed to load chart data: {chartErrorMessage}
					</ChartPanelBodyFallback>
				) : (
					<React.Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={selectedPresentation.dataset}
							charts={selectedPresentation.charts}
							csvSource={selectedPresentation.csvSource}
							valueSymbol="$"
							solidChartAreaStyle
							onReady={handleChartReady}
							showTotalInTooltip
							requireCompleteTooltipTotal
						/>
					</React.Suspense>
				)}
			</ChartPanel>

			<React.Suspense fallback={<Panel padding="none" style={{ minHeight: `${categories.length * 50 + 200}px` }} />}>
				<TableWithSearch
					data={finalCategoriesList}
					getSubRows={(row) => row.subRows}
					columns={categoriesColumns}
					columnToSearch="name"
					placeholder="Search category..."
					csvFileName="protocol-categories"
					sortingState={DEFAULT_SORTING_STATE}
				/>
			</React.Suspense>
		</>
	)
}
