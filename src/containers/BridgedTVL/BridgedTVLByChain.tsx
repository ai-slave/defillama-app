import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import {
	buildRuntimePieChartCsvDataset,
	buildRuntimePieChartPresentation,
	prepareRuntimePieChartData
} from '~/components/ECharts/PieChart/data'
import { FormattedName } from '~/components/FormattedName'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { useLocalSelection } from '~/components/Select/localSelection'
import { LinkPreviewCard } from '~/components/SEO'
import { displayTableFeatures } from '~/components/Table/features/display'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_SERIES_LIMIT, chartColor } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { MetricRow } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { Select } from '~/ui/Select'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { ChainAsset, ChainAssetCategoryKey } from './api.types'
import { hasVisibleChainAssetTotal } from './presentation'

interface BridgedChainRow {
	name: string
	value: number
}

interface BridgedTVLByChainProps {
	chainData: ChainAsset | null
	chains: Array<{ label: string; to: string }>
	chain: string
	chainName?: string
	deprecated?: boolean
}

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart'))
const EMPTY_CHAIN_ASSET_BREAKDOWN: Record<string, number> = {}

const columnHelper = createColumnHelper<typeof displayTableFeatures, BridgedChainRow>()

const bridgedChainColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Token',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.value, {
		id: 'value',
		header: 'Total Bridged',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[120px]'
		}
	})
])

export function BridgedTVLByChain({
	chainData,
	chains,
	chain,
	chainName = 'All Chains',
	deprecated
}: BridgedTVLByChainProps) {
	const router = useRouter()
	const chartTypeOptions = React.useMemo(
		() =>
			CHART_TYPES.filter(({ key }) => key === 'total' || hasVisibleChainAssetTotal(chainData?.[key]?.total)).map(
				({ key, name }) => ({ key, name })
			),
		[chainData]
	)
	const chartTypeQuery = readSingleQueryValue(router.query.chartType)
	const chartType = chartTypeOptions.find(({ key }) => key === chartTypeQuery)?.key ?? 'total'
	const exportChartExport = useGetChartInstance()

	const { pieSeries, tableData } = React.useMemo(() => {
		const category = chainData?.[chartType]
		const breakdown = category?.breakdown
		const pieSeries = prepareRuntimePieChartData({
			data: breakdown ?? EMPTY_CHAIN_ASSET_BREAKDOWN,
			limit: CHART_SERIES_LIMIT
		})

		const tableData: Array<BridgedChainRow> = []
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
	const pieColors = React.useMemo(() => {
		const colorByToken: Record<string, string> = {}
		if (!chainData) return colorByToken
		let count = 0
		for (const { key: categoryName } of CHART_TYPES) {
			const category = chainData[categoryName]
			if (!category) continue
			for (const name in category.breakdown) {
				if (!Object.hasOwn(colorByToken, name)) colorByToken[name] = chartColor(count++)
			}
		}
		return colorByToken
	}, [chainData])
	const {
		activeSeries: selectedPieTokens,
		selectedCharts: selectedPieTokenSet,
		setSelectedSeries: setSelectedPieTokens
	} = useLocalSelection({ allowEmptySelection: true, availableSeries: pieSelectableSeries, scope: chain })
	const piePresentation = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: pieSeries,
				selectedSeries: selectedPieTokenSet,
				colorByPeer: pieColors
			}),
		[pieColors, pieSeries, selectedPieTokenSet]
	)

	const deferredPiePresentation = React.useDeferredValue(piePresentation)
	const chartTypeName = chartTypeOptions.find(({ key }) => key === chartType)?.name ?? 'Total'
	const exportTitle = chartType === 'total' ? `${chainName} Bridged TVL` : `${chainName} ${chartTypeName} Bridged TVL`
	const totalBridged = chainData ? chainData.total.total + (chainData.ownTokens?.total ?? 0) : null

	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'value', desc: true }])
	const instance = useTable({
		features: displayTableFeatures,
		data: tableData,
		columns: bridgedChainColumns,
		state: {
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater))
	})

	return (
		<>
			<LinkPreviewCard cardName={chainName} token={chain} />
			<RowLinksWithDropdown heading="Chains" links={chains} activeLink={chainName} />
			<SummaryCardGrid>
				<SummaryStatsCard gap="sm">
					<h1 className="mb-3 flex items-center gap-2 heading-sm">
						<TokenLogo name={chain} kind="chain" size={24} alt={`Logo of ${chain}`} />
						<FormattedName text={`${chainName} Bridged TVL`} fontWeight={700} />
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

						{BRIDGED_OPTIONAL_METRICS.map(({ key, label }) =>
							hasVisibleChainAssetTotal(chainData?.[key]?.total) ? (
								<MetricRow
									key={key}
									label={label}
									value={formatUsd(chainData?.[key]?.total ?? null, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								/>
							) : null
						)}
					</div>
				</SummaryStatsCard>
				<Panel className="col-span-2">
					<ChartPanelToolbar>
						<div className="mr-auto">
							<Select
								heading="Chart type"
								allValues={chartTypeOptions}
								selectedValues={chartType}
								setSelectedValues={(value: string) => {
									const nextChartType = chartTypeOptions.find((option) => option.key === value)?.key
									if (!nextChartType) throw new Error(`Unknown bridged TVL chart type: ${value}`)
									void pushShallowQuery(router, {
										chartType: nextChartType === 'total' ? undefined : nextChartType
									})
								}}
								label={chartTypeName}
								labelType="none"
								variant="filter"
								size="md"
							/>
						</div>
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
							chart={exportChartExport}
							filename={`${slug(chainName)}-bridged-tvl-${chartType}`}
							title={exportTitle}
							iconUrl={chainIconUrl(chain)}
							csvSource={{
								type: 'dataset',
								prepare: () =>
									buildRuntimePieChartCsvDataset({
										series: pieSeries,
										selectedSeries: selectedPieTokenSet
									})
							}}
						/>
					</ChartPanelToolbar>
					<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<PieChart
							exportButtons={exportChartExport}
							chartData={deferredPiePresentation.chartData}
							stackColors={deferredPiePresentation.stackColors}
							valueSymbol=""
							centerY="44%"
						/>
					</React.Suspense>
				</Panel>
			</SummaryCardGrid>
			<VirtualTable table={instance} />
		</>
	)
}

const CHART_TYPES = [
	{ key: 'total', name: 'Total' },
	{ key: 'canonical', name: 'Canonical' },
	{ key: 'native', name: 'Native' },
	{ key: 'thirdParty', name: 'Third Party' },
	{ key: 'ownTokens', name: 'Own Tokens' },
	{ key: 'stablecoins', name: 'Stablecoins' },
	{ key: 'rwa', name: 'RWAs' },
	{ key: 'lst', name: 'Liquid Staking' }
] as const satisfies ReadonlyArray<{ key: ChainAssetCategoryKey; name: string }>

const BRIDGED_OPTIONAL_METRICS = [
	{ key: 'ownTokens', label: 'Own Tokens' },
	{ key: 'stablecoins', label: 'Stablecoins' },
	{ key: 'rwa', label: 'RWAs' },
	{ key: 'lst', label: 'Liquid Staking' }
] as const
