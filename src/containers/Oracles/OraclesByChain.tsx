import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedPercentageChart } from '~/components/ECharts/MultiSeriesChart/selection'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useAllSeriesSelection, useSeriesSelection } from '~/hooks/useSeriesSelection'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { FailedDataPopover } from '~/ui/FailedDataPopover'
import { LoadingDots } from '~/ui/Loaders'
import { Panel } from '~/ui/Panel'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import { getEnabledExtraTvlApiKeys, getEnabledForkOracleExtraTvlChartApiKeys } from '~/utils/tvlOverlap'
import { buildOraclesByChainDominanceData, buildOraclesByChainTableAndPieData } from './byChainData'
import { useOraclesByChainExtraBreakdowns } from './queries.client'
import type { OraclesByChainPageData } from './types'

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart'))
const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const DEFAULT_SORTING_STATE = [{ id: 'tvl', desc: true }]

export function OraclesByChain({
	chartData,
	tableData,
	oracles,
	chainLinks,
	oraclesColors,
	chain
}: OraclesByChainPageData) {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')

	const enabledExtraApiKeys = React.useMemo(() => getEnabledExtraTvlApiKeys(extraTvlsEnabled), [extraTvlsEnabled])
	const enabledExtraChartApiKeys = React.useMemo(
		() => getEnabledForkOracleExtraTvlChartApiKeys(extraTvlsEnabled),
		[extraTvlsEnabled]
	)
	const hasEnabledExtras = enabledExtraApiKeys.length > 0

	const { extraBreakdownsByApiKey, isFetchingExtraBreakdowns, failedApiKeys } = useOraclesByChainExtraBreakdowns({
		enabledExtraApiKeys: enabledExtraChartApiKeys,
		chain
	})

	const shouldApplyExtraTvlFormatting = enabledExtraChartApiKeys.length > 0 && !isFetchingExtraBreakdowns

	const tableAndPieData = React.useMemo(() => {
		return buildOraclesByChainTableAndPieData({ tableData, extraTvlsEnabled, hasEnabledExtras })
	}, [extraTvlsEnabled, hasEnabledExtras, tableData])
	const oracleSeries = oracles

	const dominanceData = React.useMemo(() => {
		return buildOraclesByChainDominanceData({
			chartData,
			oracles: oracleSeries,
			oraclesColors,
			extraBreakdownsByApiKey,
			extraTvlsEnabled,
			shouldApplyExtraTvlFormatting
		})
	}, [chartData, extraBreakdownsByApiKey, extraTvlsEnabled, oracleSeries, shouldApplyExtraTvlFormatting, oraclesColors])

	const activeLink = chain ?? 'All'
	const { activeSeries, selectedCharts, setSelectedSeries } = useSeriesSelection({
		availableSeries: oracleSeries,
		selectionKey: activeLink
	})
	const selectedDominance = React.useMemo(
		() =>
			buildSelectedPercentageChart({
				dataset: dominanceData.dominanceDataset,
				charts: dominanceData.dominanceCharts,
				selectedCharts,
				missingValuePolicy: 'sum-available'
			}),
		[dominanceData, selectedCharts]
	)
	const pieSelectableSeries = React.useMemo(
		() => tableAndPieData.pieSeries.peers.map((peer) => peer.name),
		[tableAndPieData.pieSeries.peers]
	)
	const {
		activeSeries: activePieSeries,
		selectedCharts: selectedPieSeries,
		setSelectedSeries: setSelectedPieSeries,
		includeUpstreamOthers: includePieUpstreamOthers
	} = useAllSeriesSelection({
		availableSeries: pieSelectableSeries,
		selectionKey: activeLink
	})
	const visiblePieData = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: tableAndPieData.pieSeries,
				selectedSeries: selectedPieSeries,
				includeUpstreamOthers: includePieUpstreamOthers
			}).chartData,
		[includePieUpstreamOthers, selectedPieSeries, tableAndPieData.pieSeries]
	)
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const { chartInstance: pieChartInstance, handleChartReady: handlePieChartReady } = useGetChartInstance()

	return (
		<>
			<RowLinksWithDropdown links={chainLinks} activeLink={activeLink} />

			<div className="flex flex-col gap-2 xl:flex-row">
				<ChartPanel className="isolate flex-1">
					<ChartPanelToolbar className="justify-end">
						{pieSelectableSeries.length > 1 ? (
							<SelectWithCombobox
								allValues={pieSelectableSeries}
								selectedValues={activePieSeries}
								setSelectedValues={setSelectedPieSeries}
								label="Oracle"
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : null}
						<ChartExportButtons
							chartInstance={pieChartInstance}
							filename="oracles-tvs-pie"
							title="Oracles TVS"
							csvSource={{
								type: 'dataset',
								prepare: () => buildRuntimePieChartCsvDataset(tableAndPieData.pieSeries)
							}}
						/>
					</ChartPanelToolbar>
					<React.Suspense fallback={<ChartPanelBodyFallback />}>
						<PieChart chartData={visiblePieData} stackColors={oraclesColors} onReady={handlePieChartReady} />
					</React.Suspense>
				</ChartPanel>
				<ChartPanel className="flex-1">
					<ChartPanelToolbar className="justify-end">
						<h2 className="mr-auto heading-xs">Oracle Dominance</h2>
						{oracleSeries.length > 1 ? (
							<SelectWithCombobox
								allValues={oracleSeries}
								selectedValues={activeSeries}
								setSelectedValues={setSelectedSeries}
								label="Oracle"
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : null}
						<ChartExportButtons
							chartInstance={chartInstance}
							filename="oracles-dominance"
							title="Oracle Dominance"
							csvSource={selectedDominance.csvSource}
						/>
					</ChartPanelToolbar>
					{isFetchingExtraBreakdowns ? (
						<ChartPanelBodyFallback
							role="status"
							aria-live="polite"
							className="my-auto flex items-center justify-center gap-1 text-center body-sm text-tertiary"
						>
							Loading
							<LoadingDots />
						</ChartPanelBodyFallback>
					) : (
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={selectedDominance.dataset}
								charts={selectedDominance.charts}
								csvSource={selectedDominance.csvSource}
								stacked
								expandTo100Percent
								hideDefaultLegend
								valueSymbol="%"
								onReady={handleChartReady}
							/>
						</React.Suspense>
					)}
					{!isFetchingExtraBreakdowns ? (
						<FailedDataPopover
							items={failedApiKeys}
							ariaLabel="Show failed Oracle TVL sections"
							title="Failed to load selected TVL data for:"
						/>
					) : null}
				</ChartPanel>
			</div>

			<React.Suspense
				fallback={<Panel padding="none" style={{ minHeight: `${tableAndPieData.tableData.length * 50 + 200}px` }} />}
			>
				<TableWithSearch
					data={tableAndPieData.tableData}
					columns={columns}
					columnToSearch="name"
					placeholder="Search oracles..."
					header="Oracle Rankings"
					headingAs="h1"
					csvFileName="oracle-rankings"
					initialSorting={DEFAULT_SORTING_STATE}
				/>
			</React.Suspense>
		</>
	)
}

type IOracleTableRow = OraclesByChainPageData['tableData'][number]
const columnHelper = createColumnHelper<SearchTableFeatures, IOracleTableRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue }) => {
			const name = getValue()
			return (
				<span className="relative flex items-center gap-2">
					<BasicLink href={`/oracles/${slug(name)}`} className="truncate text-sm font-medium text-link">
						{name}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor('chains', {
		header: 'Chains',
		enableSorting: false,
		cell: ({ row }) => {
			const chains = row.original.chains
			return (
				<div className="flex items-center justify-end gap-1 overflow-hidden">
					<IconsRow items={toChainIconItems(chains, (chain) => chainHref('/oracles/chain', chain))} />
				</div>
			)
		},
		meta: {
			headerClassName: 'w-[min(200px,40vw)]',
			align: 'end',
			headerHelperText: 'Chains secured by the oracle'
		}
	}),
	columnHelper.accessor((row) => row.protocolsSecured ?? undefined, {
		id: 'protocolsSecured',
		header: 'Protocols',
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.tvl ?? undefined, {
		id: 'tvl',
		header: 'TVS',
		enableSorting: true,
		sortUndefined: 'last',
		cell: (info) => {
			const tvl = info.row.original.tvl
			return tvl === null
				? null
				: formatUsd(tvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		},
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Total Value Secured by the Oracle'
		}
	})
])
