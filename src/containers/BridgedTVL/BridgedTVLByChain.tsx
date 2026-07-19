import {
	createColumnHelper,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import { createChartRecord } from '~/components/ECharts/dynamicRow'
import { createInflowsTooltipFormatter } from '~/components/ECharts/formatters'
import type { IPieChartProps } from '~/components/ECharts/types'
import { preparePieChartData } from '~/components/ECharts/utils'
import { FormattedName } from '~/components/FormattedName'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { LinkPreviewCard } from '~/components/SEO'
import { VirtualTable } from '~/components/Table/Table'
import { TokenLogo } from '~/components/TokenLogo'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { MetricRow } from '~/ui/MetricPrimitives'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formattedNum, slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import type { RawChainAsset } from './api.types'
import { buildBridgedInflowsChartData } from './inflowChart'

interface BridgedChainRow {
	name: string
	value: string
}

type ChainAssetKey = keyof RawChainAsset

interface BridgedTVLByChainProps {
	chainData: RawChainAsset | null
	chains: Array<{ label: string; to: string }>
	chain: string
	inflows: Array<Record<string, number>>
	tokenInflowNames: string[]
	chainName?: string
	deprecated?: boolean
}

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const MultiSeriesChart2 = React.lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const INFLOWS_TOOLTIP_FORMATTER_USD = createInflowsTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })

const columnHelper = createColumnHelper<BridgedChainRow>()

const bridgedChainColumns = [
	columnHelper.accessor('name', {
		header: 'Token',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => (row.value ? +row.value : undefined), {
		id: 'value',
		header: 'Total Bridged',
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[120px]'
		}
	})
]

export function BridgedTVLByChain({
	chainData,
	chains,
	chain,
	inflows,
	tokenInflowNames,
	chainName = 'All Chains',
	deprecated
}: BridgedTVLByChainProps) {
	const [chartType, setChartType] = React.useState<ChainAssetKey | 'inflows'>('total')
	const { chartInstance: exportChartInstance, handleChartReady: onChartReady } = useGetChartInstance()
	const [selectedTokens, setSelectedTokens] = React.useState<string[]>(tokenInflowNames ?? [])
	const selectedChartsSet = React.useMemo(() => new Set(selectedTokens), [selectedTokens])

	const { pieChartData, tableData } = React.useMemo(() => {
		const category = chartType !== 'inflows' ? chainData?.[chartType] : undefined
		const rawBreakdown = category?.breakdown ?? {}
		const breakdown = createChartRecord<number>()
		for (const key in rawBreakdown) {
			breakdown[key] = Number(rawBreakdown[key])
		}
		const pieChartData = preparePieChartData({ data: breakdown, limit: 10 })

		const tableData: BridgedChainRow[] = Object.entries(rawBreakdown).map(([name, value]) => ({
			name: name?.toLowerCase() === name ? name?.toUpperCase() : name,
			value
		}))

		return { pieChartData, tableData }
	}, [chainData, chartType])

	const inflowsData = React.useMemo(() => {
		if (!tokenInflowNames?.length) return null
		return buildBridgedInflowsChartData(inflows, tokenInflowNames)
	}, [inflows, tokenInflowNames])
	const deferredPieChartData = React.useDeferredValue(pieChartData)
	const deferredInflowsData = React.useDeferredValue(inflowsData)
	const chartTypeName =
		chartType === 'inflows'
			? 'Inflows'
			: chartType === 'ownTokens'
				? 'Own Tokens'
				: (chartTypes.find((item) => item.type === chartType)?.name ?? 'Total')
	const exportTitle =
		chartType === 'total'
			? `${chainName} Bridged TVL`
			: chartType === 'inflows'
				? `${chainName} Bridged Inflows`
				: `${chainName} ${chartTypeName} Bridged TVL`

	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'value', desc: true }])
	const instance = useReactTable({
		data: tableData,
		columns: bridgedChainColumns,
		state: {
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	return (
		<>
			<LinkPreviewCard cardName={chainName} token={chain} />
			<RowLinksWithDropdown links={chains} activeLink={chainName} />
			<SummaryCardGrid>
				<SummaryStatsCard gap="sm">
					<h1 className="mb-3 flex items-center gap-2 heading-sm">
						<TokenLogo name={chain} kind="chain" size={24} alt={`Logo of ${chain}`} />
						<FormattedName text={chainName + ' Bridged TVL'} fontWeight={700} />
						{deprecated ? <DeprecatedEntityText /> : null}
					</h1>

					<StatItem
						label="Total"
						className="mb-3"
						value={formattedNum(
							+(chainData?.total?.total ?? 0) + (chainData?.ownTokens?.total ? +chainData.ownTokens.total : 0),
							true
						)}
					/>

					<div className="flex flex-col">
						<MetricRow label="Canonical" value={formattedNum(chainData?.canonical?.total, true)} />
						<MetricRow label="Native" value={formattedNum(chainData?.native?.total, true)} />
						<MetricRow label="Third Party" value={formattedNum(chainData?.thirdParty?.total, true)} />

						{chainData?.ownTokens?.total ? (
							<MetricRow label="Own Tokens" value={formattedNum(chainData?.ownTokens.total, true)} />
						) : null}
					</div>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar className="justify-end">
						<SegmentedControl
							value={chartType}
							onValueChange={(value) => setChartType(value as typeof chartType)}
							options={[
								...chartTypes
									.filter(({ type }) => Boolean(chainData?.[type]?.total) && chainData?.[type]?.total !== '0')
									.map(({ type, name }) => ({ value: type, label: name })),
								...(inflows.length > 0 && tokenInflowNames.length > 0
									? [{ value: 'inflows' as const, label: 'Inflows' }]
									: []),
								...(chainData?.ownTokens?.total ? [{ value: 'ownTokens' as const, label: 'Own Tokens' }] : [])
							]}
							label="Chart type"
							variant="default"
							size="md"
							className="mr-auto"
						/>
						{chartType === 'inflows' && tokenInflowNames?.length > 0 ? (
							<SelectWithCombobox
								allValues={tokenInflowNames}
								selectedValues={selectedTokens}
								setSelectedValues={setSelectedTokens}
								label="Token"
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : null}
						<ChartExportButtons
							chartInstance={exportChartInstance}
							filename={`${slug(chainName)}-bridged-tvl-${chartType}`}
							title={exportTitle}
							iconUrl={chainIconUrl(chain)}
						/>
					</ChartPanelToolbar>
					{chartType !== 'inflows' ? (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<PieChart chartData={deferredPieChartData} valueSymbol="" centerY="44%" onReady={onChartReady} />
						</React.Suspense>
					) : deferredInflowsData ? (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart2
								dataset={deferredInflowsData.dataset}
								charts={deferredInflowsData.charts}
								hideDefaultLegend={true}
								valueSymbol="$"
								showTotalInTooltip
								selectedCharts={selectedChartsSet}
								chartOptions={
									selectedTokens.length > 1 ? { tooltip: { formatter: INFLOWS_TOOLTIP_FORMATTER_USD } } : undefined
								}
								onReady={onChartReady}
							/>
						</React.Suspense>
					) : null}
				</ChartPanel>
			</SummaryCardGrid>
			{chartType !== 'inflows' ? <VirtualTable instance={instance} /> : null}
		</>
	)
}

const chartTypes: Array<{ type: ChainAssetKey; name: string }> = [
	{ type: 'total', name: 'Total' },
	{ type: 'canonical', name: 'Canonical' },
	{ type: 'native', name: 'Native' },
	{ type: 'thirdParty', name: 'Third Party' }
]
