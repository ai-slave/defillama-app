import { type ColumnFiltersState, createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { readSelectionFromQuery } from '~/components/Select/query'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { filteredTableFeatures } from '~/components/Table/features/filtering'
import { prepareTableCsv, useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TagGroup } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import { parseNumberQueryParam } from '~/utils/routerQuery'
import { buildFilteredHacksSummary, filterHacksRows } from './data'
import { HacksFilters } from './Filters'
import type { IHacksPageData } from './types'

const tableFeaturesConfig = filteredTableFeatures

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

function HacksTable({ data }: { data: IHacksPageData['data'] }) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ desc: true, id: 'date' }])
	const router = useRouter()
	const searchInputRef = React.useRef<HTMLInputElement | null>(null)
	const initialSearchAppliedRef = React.useRef(false)

	const instance = useTable({
		features: tableFeaturesConfig,
		data,
		columns: hacksColumns,
		state: {
			columnFilters,
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	React.useEffect(() => {
		if (!router.isReady || initialSearchAppliedRef.current) return
		const raw = router.query.search
		const value = Array.isArray(raw) ? raw[0] : raw
		if (typeof value === 'string' && value.trim()) {
			initialSearchAppliedRef.current = true
			setProjectName(value.trim())
			if (searchInputRef.current) searchInputRef.current.value = value.trim()
		}
	}, [router.isReady, router.query.search, setProjectName])

	return (
		<Panel padding="none">
			<TableToolbar>
				<label className={searchFieldWrapperStyles}>
					<span className="sr-only">Search projects...</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<Input
						ref={searchInputRef}
						name="search"
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder="Search projects..."
						className={searchFieldInputPlacementStyles}
					/>
				</label>

				<CSVDownloadButton prepareCsv={() => prepareTableCsv({ instance, filename: 'hacks' })} smol free size="md" />
			</TableToolbar>
			<VirtualTable table={instance} />
		</Panel>
	)
}

const chartTypeList = ['Monthly Sum', 'Total Hacked by Technique']

const getTimeSinceSeconds = (timeQuery: string | undefined, nowSec: number): number | null => {
	if (typeof timeQuery !== 'string') return null

	switch (timeQuery) {
		case '7d':
			return nowSec - 7 * 24 * 60 * 60
		case '30d':
			return nowSec - 30 * 24 * 60 * 60
		case '90d':
			return nowSec - 90 * 24 * 60 * 60
		case '1y':
			return nowSec - 365 * 24 * 60 * 60
		default:
			return null
	}
}

export function HacksContainer({
	data,
	monthlyHacksChartData,
	totalHacked,
	totalHackedDefi,
	totalRugs,
	pieChartData,
	chainOptions,
	techniqueOptions,
	classificationOptions
}: IHacksPageData) {
	const [chartType, setChartType] = React.useState('Monthly Sum')
	const nowSec = useNowSeconds()
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()
	const router = useRouter()
	const { time: timeQ, minLost, maxLost } = router.query
	const minLostVal = parseNumberQueryParam(minLost)
	const maxLostVal = parseNumberQueryParam(maxLost)

	const filters = React.useMemo(() => {
		// null when every option is selected, so the picker filters nothing.
		const pick = (includeKey: string, excludeKey: ExcludeQueryKey, options: Array<string>) => {
			const selected = readSelectionFromQuery(router.query, includeKey, excludeKey, options)
			return selected.length === options.length ? null : new Set(selected)
		}
		return {
			chains: pick('chain', 'excludeChain', chainOptions),
			techniques: pick('tech', 'excludeTech', techniqueOptions),
			classifications: pick('class', 'excludeClass', classificationOptions),
			since: getTimeSinceSeconds(typeof timeQ === 'string' ? timeQ : undefined, nowSec),
			minLost: minLostVal,
			maxLost: maxLostVal
		}
	}, [router.query, chainOptions, techniqueOptions, classificationOptions, timeQ, nowSec, minLostVal, maxLostVal])

	const hasActiveFilters =
		filters.chains !== null ||
		filters.techniques !== null ||
		filters.classifications !== null ||
		filters.since !== null ||
		filters.minLost !== null ||
		filters.maxLost !== null

	const filteredData = React.useMemo(() => filterHacksRows(data, filters), [data, filters])

	const derivedStats = React.useMemo(() => {
		if (!hasActiveFilters) return null
		return buildFilteredHacksSummary(filteredData)
	}, [filteredData, hasActiveFilters])

	const displayTotalHacked = derivedStats?.totalHacked ?? totalHacked
	const displayTotalHackedDefi = derivedStats?.totalHackedDefi ?? totalHackedDefi
	const displayTotalRugs = derivedStats?.totalRugs ?? totalRugs
	const displayMonthlyHacksChartData = derivedStats?.monthlyHacksChartData ?? monthlyHacksChartData
	const displayPieChartData = derivedStats?.pieChartData ?? pieChartData
	const deferredMonthlyHacksChartData = React.useDeferredValue(displayMonthlyHacksChartData)
	const deferredPieChartData = React.useDeferredValue(displayPieChartData)
	const prepareCompleteTechniqueDataset = React.useCallback(() => {
		const totals = new Map<string, number>()
		for (const row of filteredData) {
			if (!row.technique) continue
			totals.set(row.technique, (totals.get(row.technique) ?? 0) + (row.amountUsd ?? 0))
		}
		const source = Array.from(totals, ([name, value]) => [name, value] as [string, number])
		source.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		return { dimensions: ['Name', 'Value'], source }
	}, [filteredData])

	return (
		<>
			<HacksFilters
				chainOptions={chainOptions}
				techniqueOptions={techniqueOptions}
				classificationOptions={classificationOptions}
				hasActiveFilters={hasActiveFilters}
			/>
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					<StatItem label="Total Value Hacked (USD)" labelAs="h1" value={displayTotalHacked} />
					<StatItem label="Total Value Hacked in DeFi (USD)" value={displayTotalHackedDefi} />
					<StatItem label="Total Value Hacked in Bridges (USD)" value={displayTotalRugs} />
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar>
						<TagGroup
							variant="default"
							size="md"
							className="mr-auto"
							setValue={setChartType}
							selectedValue={chartType}
							values={chartTypeList}
						/>
						<ChartExportButtons
							chartInstance={exportChartInstance}
							filename="total-value-hacked"
							title="Total Value Hacked"
							csvSource={
								chartType === 'Monthly Sum'
									? {
											type: 'dataset',
											prepare: () => ({ ...deferredMonthlyHacksChartData.dataset, groupBy: 'monthly' })
										}
									: {
											type: 'dataset',
											prepare: prepareCompleteTechniqueDataset
										}
							}
						/>
					</ChartPanelToolbar>
					{chartType === 'Monthly Sum' ? (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={deferredMonthlyHacksChartData.dataset}
								charts={deferredMonthlyHacksChartData.charts}
								groupBy="monthly"
								onReady={handleChartReady}
							/>
						</React.Suspense>
					) : (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<PieChart chartData={deferredPieChartData} onReady={handleChartReady} />
						</React.Suspense>
					)}
				</ChartPanel>
			</SummaryCardGrid>
			<HacksTable data={filteredData} />
		</>
	)
}

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, IHacksPageData['data'][0]>()

const hacksColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(200px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.date ?? undefined, {
		id: 'date',
		cell: ({ getValue }) => {
			const value = getValue()
			return value === undefined ? <span className="text-tertiary">N/A</span> : formatDate(value, { input: 'seconds' })
		},
		meta: {
			headerClassName: 'w-[120px]'
		},
		header: 'Date'
	}),
	columnHelper.accessor((row) => row.amountUsd ?? undefined, {
		id: 'amountUsd',
		header: 'Amount lost',
		cell: (info) => {
			const value = info.getValue()
			return value === undefined ? (
				<span className="text-tertiary">N/A</span>
			) : (
				formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
			)
		},
		meta: {
			headerClassName: 'w-[140px]'
		}
	}),
	columnHelper.accessor('chains', {
		header: 'Chains',
		enableSorting: false,
		cell: ({ getValue }) => <IconsRow items={toChainIconItems(getValue(), (chain) => chainHref('/chain', chain))} />,
		meta: {
			headerClassName: 'w-[60px]'
		}
	}),
	columnHelper.accessor('classification', {
		header: 'Classification',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[140px]',
			headerHelperText:
				'Classified based on whether the hack targeted a weakness in Infrastructure, Smart Contract Language, Protocol Logic or the interaction between multiple protocols (Ecosystem)'
		},
		cell: ({ getValue }) => {
			const value = getValue()
			return (
				<Tooltip content={value} className="inline text-ellipsis">
					{value}
				</Tooltip>
			)
		}
	}),
	columnHelper.accessor('technique', {
		header: 'Technique',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(200px,40vw)]'
		},
		cell: ({ getValue }) => {
			const value = getValue()
			return (
				<Tooltip content={value} className="inline text-ellipsis">
					{value}
				</Tooltip>
			)
		}
	}),
	columnHelper.accessor('language', {
		header: 'Language',
		meta: {
			headerClassName: 'w-[148px]'
		}
	})
])
