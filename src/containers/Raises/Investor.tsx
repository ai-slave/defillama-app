import { type ColumnFiltersState, type ColumnOrderState, type SortingState, useTable } from '@tanstack/react-table'
import * as React from 'react'
import { Announcement } from '~/components/Announcement'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import { VirtualTable } from '~/components/Table/Table'
import { useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import { RaisesFilters } from '~/containers/Raises/Filters'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInputStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { useRaisesData } from './hooks'
import type { Raise } from './model'
import { prepareRaisesCsv, raisesColumnOrders, raisesColumns } from './Table'

const tableFeaturesConfig = orderedFilteredTableFeatures

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

function RaisesByInvestorTable({ raises }: { raises: Array<Raise> }) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ desc: true, id: 'date' }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])

	const instance = useTable({
		features: tableFeaturesConfig,
		data: raises,
		columns: raisesColumns,
		state: {
			columnFilters,
			columnOrder,
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnOrderChange: (updater) => React.startTransition(() => setColumnOrder(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	useSortColumnOrders({ instance, columnOrders: raisesColumnOrders })

	return (
		<Panel padding="none">
			<TableToolbar className="items-center justify-end">
				<label className={searchFieldWrapperStyles}>
					<span className="sr-only">Search projects...</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						name="search"
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder="Search projects..."
						className={searchFieldInputStyles}
					/>
				</label>
				<CSVDownloadButton prepareCsv={() => prepareRaisesCsv(instance)} smol size="md" />
			</TableToolbar>
			<VirtualTable table={instance} />
		</Panel>
	)
}

interface InvestorContainerProps {
	raises: Array<Raise>
	investors: Array<string>
	rounds: Array<string>
	sectors: Array<string>
	chains: Array<string>
	investorName: string
}

export function InvestorContainer({
	raises,
	investors,
	rounds,
	sectors,
	chains,
	investorName
}: InvestorContainerProps) {
	const {
		filteredRaisesList,
		selectedInvestors,
		selectedRounds,
		selectedChains,
		selectedSectors,
		raisesByCategory,
		fundingRoundsByMonthChart,
		investmentByRounds
	} = useRaisesData({
		raises,
		investors,
		rounds,
		sectors,
		chains
	})
	const deferredFundingRoundsByMonthChart = React.useDeferredValue(fundingRoundsByMonthChart)
	const deferredInvestmentByRounds = React.useDeferredValue(investmentByRounds)
	const deferredRaisesByCategory = React.useDeferredValue(raisesByCategory)

	return (
		<>
			<Announcement notCancellable>
				<span>Are we missing any funding round?</span>{' '}
				<a
					href="https://airtable.com/shrON6sFMgyFGulaq"
					className="font-medium text-brand underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					Add it here!
				</a>
			</Announcement>

			<RaisesFilters
				header="Raises"
				headingAs="h2"
				rounds={rounds}
				selectedRounds={selectedRounds}
				sectors={sectors}
				selectedSectors={selectedSectors}
				investors={investors}
				selectedInvestors={selectedInvestors}
				chains={chains}
				selectedChains={selectedChains}
				pathname={`/raises/${slug(investorName)}`}
			/>

			<SummaryCardGrid>
				<SummaryStatsCard>
					<h1 className="heading-sm">{investorName}</h1>

					<details className="group text-base">
						<summary>
							<Icon
								name="chevron-right"
								height={20}
								width={20}
								className="-mb-5 -ml-5 transition-transform duration-100 group-open:rotate-90"
							/>

							<span className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-secondary">Total Investments</span>
								<span className="font-jetbrains">{filteredRaisesList.length}</span>
							</span>
						</summary>

						{raisesByCategory.map(({ name, value }) => (
							<p className="my-1 flex flex-wrap items-center justify-between gap-2" key={name}>
								<span className="text-secondary">{name}</span>
								<span className="font-jetbrains">{value}</span>
							</p>
						))}
					</details>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<React.Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							dataset={deferredFundingRoundsByMonthChart.dataset}
							charts={deferredFundingRoundsByMonthChart.charts}
							groupBy="monthly"
							valueSymbol=""
							exportButtons={{
								png: true,
								csv: true,
								filename: `${investorName}-funding-rounds`,
								pngTitle: `${investorName} Funding Rounds`
							}}
						/>
					</React.Suspense>
				</ChartPanel>
			</SummaryCardGrid>

			<div className="grid grid-cols-2 gap-1">
				<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
					<React.Suspense fallback={<ChartPanelExportShellFallback />}>
						<PieChart
							chartData={deferredInvestmentByRounds}
							title="Investment by Rounds"
							valueSymbol=""
							exportButtons={{
								png: true,
								csv: true,
								filename: `${investorName}-investment-by-rounds`,
								pngTitle: `${investorName} Investment by Rounds`
							}}
						/>
					</React.Suspense>
				</ChartPanel>
				<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
					<React.Suspense fallback={<ChartPanelExportShellFallback />}>
						<PieChart
							chartData={deferredRaisesByCategory}
							title="Investments by Category"
							valueSymbol=""
							exportButtons={{
								png: true,
								csv: true,
								filename: `${investorName}-investments-by-category`,
								pngTitle: `${investorName} Investments by Category`
							}}
						/>
					</React.Suspense>
				</ChartPanel>
			</div>
			<RaisesByInvestorTable raises={filteredRaisesList} />
		</>
	)
}
