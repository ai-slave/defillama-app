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
import {
	buildRuntimePieChartCsvDataset,
	buildRuntimePieChartPresentation,
	prepareRuntimePieChartData
} from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { FormattedName } from '~/components/FormattedName'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { LinkPreviewCard } from '~/components/SEO'
import { VirtualTable } from '~/components/Table/Table'
import { TokenLogo } from '~/components/TokenLogo'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { MetricRow } from '~/ui/MetricPrimitives'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import type { ChainAsset } from './api.types'
import { hasVisibleChainAssetTotal } from './presentation'

interface BridgedChainRow {
	name: string
	value: number
}

type ChainAssetKey = keyof ChainAsset
const CHAIN_ASSET_KEYS: readonly ChainAssetKey[] = ['total', 'canonical', 'thirdParty', 'native', 'ownTokens']

interface BridgedTVLByChainProps {
	chainData: ChainAsset | null
	chains: Array<{ label: string; to: string }>
	chain: string
	chainName?: string
	deprecated?: boolean
}

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const EMPTY_CHAIN_ASSET_BREAKDOWN: Record<string, number> = {}

const columnHelper = createColumnHelper<BridgedChainRow>()

const bridgedChainColumns = [
	columnHelper.accessor('name', {
		header: 'Token',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor('value', {
		id: 'value',
		header: 'Total Bridged',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[120px]'
		}
	})
]

export function BridgedTVLByChain({
	chainData,
	chains,
	chain,
	chainName = 'All Chains',
	deprecated
}: BridgedTVLByChainProps) {
	const [chartType, setChartType] = React.useState<ChainAssetKey>('total')
	const { chartInstance: exportChartInstance, handleChartReady: onChartReady } = useGetChartInstance()

	const { pieSeries, tableData } = React.useMemo(() => {
		const category = chainData?.[chartType]
		const breakdown = category?.breakdown
		const pieSeries = prepareRuntimePieChartData({ data: breakdown ?? EMPTY_CHAIN_ASSET_BREAKDOWN, limit: 10 })

		const tableData: BridgedChainRow[] = []
		if (breakdown) {
			for (const name in breakdown) {
				const value = breakdown[name]
				if (value === undefined) continue
				tableData.push({ name: name.toLowerCase() === name ? name.toUpperCase() : name, value })
			}
		}

		return { pieSeries, tableData }
	}, [chainData, chartType])
	const pieSelectableSeries = React.useMemo(() => pieSeries.peers.map((peer) => peer.name), [pieSeries.peers])
	const pieColorIndex = React.useMemo(() => {
		const indexByToken = new Map<string, number>()
		if (!chainData) return indexByToken
		for (const categoryName of CHAIN_ASSET_KEYS) {
			const category = chainData[categoryName]
			if (!category) continue
			for (const name in category.breakdown) {
				if (!indexByToken.has(name)) indexByToken.set(name, indexByToken.size)
			}
		}
		return indexByToken
	}, [chainData])
	const {
		activeSeries: selectedPieTokens,
		selectedCharts: selectedPieTokenSet,
		setSelectedSeries: setSelectedPieTokens,
		includeUpstreamOthers
	} = useAllSeriesSelection({ availableSeries: pieSelectableSeries, selectionKey: chain })
	const piePresentation = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: pieSeries,
				selectedSeries: selectedPieTokenSet,
				colorIndexByPeer: pieColorIndex,
				includeUpstreamOthers
			}),
		[includeUpstreamOthers, pieColorIndex, pieSeries, selectedPieTokenSet]
	)

	const deferredPiePresentation = React.useDeferredValue(piePresentation)
	const chartTypeName =
		chartType === 'ownTokens' ? 'Own Tokens' : (chartTypes.find((item) => item.type === chartType)?.name ?? 'Total')
	const exportTitle = chartType === 'total' ? `${chainName} Bridged TVL` : `${chainName} ${chartTypeName} Bridged TVL`
	const totalBridged = chainData ? chainData.total.total + (chainData.ownTokens?.total ?? 0) : null

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
						value={formatUsd(totalBridged, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>

					<div className="flex flex-col">
						<MetricRow
							label="Canonical"
							value={formatUsd(chainData?.canonical?.total, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<MetricRow
							label="Native"
							value={formatUsd(chainData?.native?.total, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<MetricRow
							label="Third Party"
							value={formatUsd(chainData?.thirdParty?.total, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>

						{hasVisibleChainAssetTotal(chainData?.ownTokens?.total) ? (
							<MetricRow
								label="Own Tokens"
								value={formatUsd(chainData?.ownTokens?.total ?? null, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
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
									.filter(({ type }) => {
										const total = chainData?.[type]?.total
										return hasVisibleChainAssetTotal(total)
									})
									.map(({ type, name }) => ({ value: type, label: name })),
								...(hasVisibleChainAssetTotal(chainData?.ownTokens?.total)
									? [{ value: 'ownTokens' as const, label: 'Own Tokens' }]
									: [])
							]}
							label="Chart type"
							variant="default"
							size="md"
							className="mr-auto"
						/>
						{pieSelectableSeries.length > 1 ? (
							<SelectWithCombobox
								allValues={pieSelectableSeries}
								selectedValues={selectedPieTokens}
								setSelectedValues={setSelectedPieTokens}
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
							csvSource={{ type: 'prepare-dataset', prepare: () => buildRuntimePieChartCsvDataset(pieSeries) }}
						/>
					</ChartPanelToolbar>
					<React.Suspense fallback={<ChartPanelBodyFallback />}>
						<PieChart
							chartData={deferredPiePresentation.chartData}
							stackColors={deferredPiePresentation.stackColors}
							valueSymbol=""
							centerY="44%"
							onReady={onChartReady}
						/>
					</React.Suspense>
				</ChartPanel>
			</SummaryCardGrid>
			<VirtualTable instance={instance} />
		</>
	)
}

const chartTypes: Array<{ type: ChainAssetKey; name: string }> = [
	{ type: 'total', name: 'Total' },
	{ type: 'canonical', name: 'Canonical' },
	{ type: 'native', name: 'Native' },
	{ type: 'thirdParty', name: 'Third Party' }
]
