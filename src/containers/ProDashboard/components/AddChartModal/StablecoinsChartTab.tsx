import { lazy, Suspense, useMemo } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { useLocalSelection, useSelectionIntent } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualizedSelect, type VirtualizedSelectOption } from '~/components/Select/VirtualizedSelect'
import { CHART_COLORS } from '~/constants/colors'
import {
	type StablecoinAssetInfo,
	useStablecoinAssetChartData,
	useStablecoinAssetsList
} from '~/containers/ProDashboard/components/datasets/StablecoinAssetDataset/useStablecoinAssetChartData'
import {
	STABLECOIN_DOLLAR_CHART_OPTIONS,
	STABLECOIN_INFLOWS_CHART_OPTIONS,
	STABLECOIN_PERCENT_CHART_OPTIONS,
	STABLECOIN_SINGLE_UNITLESS_CHART_OPTIONS
} from '~/containers/ProDashboard/components/datasets/stablecoinChartUtils'
import {
	type StablecoinChainInfo,
	useStablecoinChainsList,
	useStablecoinsChartData
} from '~/containers/ProDashboard/components/datasets/StablecoinsDataset/useStablecoinsChartData'
import type { StablecoinAssetChartType, StablecoinChartType } from '~/containers/ProDashboard/types'
import { stablecoinBrandColors } from '~/containers/Stablecoins/brandColors'
import { getStablecoinRuntimeSeries } from '~/containers/Stablecoins/chartSeries'
import { useStablecoinChartSelection } from '~/containers/Stablecoins/useStablecoinChartSelection'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { slug } from '~/utils'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

interface StablecoinsChartTabProps {
	/** What Add still needs, shown under the chain or stablecoin once Add was pressed. */
	error: string | null
	selectedStablecoinChain: string
	selectedStablecoinChartType: StablecoinChartType
	stablecoinMode: 'chain' | 'asset'
	selectedStablecoinAsset: string | null
	selectedStablecoinAssetId: string | null
	selectedStablecoinAssetChartType: StablecoinAssetChartType
	onSelectedStablecoinChainChange: (chain: string) => void
	onSelectedStablecoinChartTypeChange: (chartType: StablecoinChartType) => void
	onStablecoinModeChange: (mode: 'chain' | 'asset') => void
	onSelectedStablecoinAssetChange: (asset: string | null) => void
	onSelectedStablecoinAssetIdChange: (id: string | null) => void
	onSelectedStablecoinAssetChartTypeChange: (chartType: StablecoinAssetChartType) => void
}

const STABLECOIN_MODE_OPTIONS: Array<SegmentedControlOption<'chain' | 'asset'>> = [
	{ value: 'chain', label: 'By chain' },
	{ value: 'asset', label: 'By asset' }
]

const STABLECOIN_CHAIN_CHART_TYPES: Array<{ value: StablecoinChartType; label: string }> = [
	{ value: 'totalMcap', label: 'Total Market Cap' },
	{ value: 'tokenMcaps', label: 'Token Market Caps' },
	{ value: 'pie', label: 'Pie' },
	{ value: 'dominance', label: 'Dominance' },
	{ value: 'usdInflows', label: 'USD Inflows' },
	{ value: 'tokenInflows', label: 'Token Inflows' }
]

const STABLECOIN_ASSET_CHART_TYPES: Array<{ value: StablecoinAssetChartType; label: string }> = [
	{ value: 'totalCirc', label: 'Total Circulating' },
	{ value: 'chainMcaps', label: 'By chain' },
	{ value: 'chainPie', label: 'Pie' },
	{ value: 'chainDominance', label: 'Chain Dominance' }
]

const EMPTY_HALLMARKS: Array<[number, string]> = []
const EMPTY_CHAIN_LIST: Array<StablecoinChainInfo> = []
const EMPTY_ASSET_LIST: Array<StablecoinAssetInfo> = []
const EMPTY_SERIES: Array<string> = []
const TOTAL_CIRCULATING_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{ type: 'line', name: 'Circulating', encode: { x: 'timestamp', y: 'Circulating' }, color: CHART_COLORS[0] }
]
const AREA_EXPORT_BUTTONS = { csv: true, png: true, filename: 'chart' }
const BAR_EXPORT_BUTTONS = { csv: true, png: false, filename: 'bar-chart-data' }

export function StablecoinsChartTab({
	error,
	selectedStablecoinChain,
	selectedStablecoinChartType,
	stablecoinMode,
	selectedStablecoinAsset,
	selectedStablecoinAssetId,
	selectedStablecoinAssetChartType,
	onSelectedStablecoinChainChange,
	onSelectedStablecoinChartTypeChange,
	onStablecoinModeChange,
	onSelectedStablecoinAssetChange,
	onSelectedStablecoinAssetIdChange,
	onSelectedStablecoinAssetChartTypeChange
}: StablecoinsChartTabProps) {
	const chainChartType = selectedStablecoinChartType
	const assetChartType = selectedStablecoinAssetChartType
	const [isDark] = useDarkModeManager()
	const brandColors = stablecoinBrandColors(isDark)
	const { data: chainsListData, isLoading: chainsLoading } = useStablecoinChainsList()
	const { data: assetsListData, isLoading: assetsLoading } = useStablecoinAssetsList()
	const chainsList = chainsListData ?? EMPTY_CHAIN_LIST
	const assetsList = assetsListData ?? EMPTY_ASSET_LIST
	const chainOptions: Array<VirtualizedSelectOption> = useMemo(() => {
		const options: Array<VirtualizedSelectOption> = [{ value: 'All', label: 'All chains' }]
		for (const chain of chainsList) {
			options.push({
				value: chain.name,
				label: chain.name,
				logo: chainIconUrl(chain.name),
				description: formatUsd(chain.tvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
			})
		}
		return options
	}, [chainsList])

	const chainParameter = useModalFieldBinding('chain', 'chain')
	const selectableChainOptions = useMemo(
		() => (chainParameter.options.length > 0 ? [...chainParameter.options, ...chainOptions] : chainOptions),
		[chainParameter.options, chainOptions]
	)

	const assetOptions: Array<VirtualizedSelectOption> = useMemo(() => {
		return assetsList.map((asset) => ({
			value: asset.name,
			label: `${asset.name} (${asset.symbol})`,
			...(asset.geckoId ? { logo: tokenIconUrl(asset.geckoId) } : {}),
			description:
				asset.mcap == null
					? 'N/A'
					: formatUsd(asset.mcap, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})
		}))
	}, [assetsList])
	const { intent: chainSelectionIntent, setIntent: setChainSelectionIntent } = useSelectionIntent(
		`${selectedStablecoinChain}:${chainChartType}`
	)
	const chainSelectionOptions = useMemo(
		() => ({
			selectedNames: chainSelectionIntent?.mode === 'include' ? chainSelectionIntent.names : null,
			excludedNames: chainSelectionIntent?.mode === 'exclude' ? chainSelectionIntent.names : null
		}),
		[chainSelectionIntent]
	)

	const {
		chartPayload: chainChartPayload,
		pieSeries: chainPieSeries,
		defaultSeries: chainDefaultSeries,
		totalMcapCurrent,
		prepareCsvDataset: prepareChainCsvDataset,
		isLoading: chainChartDataLoading
	} = useStablecoinsChartData(
		selectedStablecoinChain,
		chainChartType,
		stablecoinMode === 'chain',
		chainSelectionOptions
	)
	const chainRuntimeSeries = useMemo(() => getStablecoinRuntimeSeries(chainChartPayload), [chainChartPayload])
	const {
		activeSeries: activeChainSeries,
		selectableSeries: selectableChainSeries,
		renderedCharts: renderedChainCharts,
		setSelectedSeries: setActiveChainSeries
	} = useStablecoinChartSelection({
		marketCapSeries: null,
		runtimeSeries: chainRuntimeSeries,
		selectionIntent: chainSelectionIntent,
		setSelectionIntent: setChainSelectionIntent
	})
	const chainPieSeriesNames = useMemo(() => chainPieSeries.peers.map((peer) => peer.name), [chainPieSeries.peers])
	const chainPieSelection = useLocalSelection({
		availableSeries: chainPieSeriesNames,
		defaultSeries: chainDefaultSeries,
		allowEmptySelection: true,
		scope: `${selectedStablecoinChain}:pie`
	})
	const chainPiePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: chainPieSeries,
				selectedSeries: chainPieSelection.selectedCharts
			}),
		[chainPieSelection.selectedCharts, chainPieSeries]
	)
	const { intent: assetSelectionIntent, setIntent: setAssetSelectionIntent } = useSelectionIntent(
		`${selectedStablecoinAssetId}:${assetChartType}`
	)
	const assetSelectionOptions = useMemo(
		() => ({
			selectedNames: assetSelectionIntent?.mode === 'include' ? assetSelectionIntent.names : null,
			excludedNames: assetSelectionIntent?.mode === 'exclude' ? assetSelectionIntent.names : null
		}),
		[assetSelectionIntent]
	)

	const {
		presentation: assetPresentation,
		stablecoinName,
		stablecoinSymbol,
		prepareCsvDataset: prepareAssetCsvDataset,
		isLoading: assetChartDataLoading
	} = useStablecoinAssetChartData(
		stablecoinMode === 'asset' ? selectedStablecoinAssetId || '' : '',
		assetChartType,
		null,
		assetSelectionOptions
	)
	const assetDataset = 'dataset' in assetPresentation ? assetPresentation.dataset : null
	const assetPieSeries = assetPresentation.chartType === 'chainPie' ? assetPresentation.pieSeries : null
	const assetPieSeriesNames = useMemo(
		() => assetPieSeries?.peers.map((peer) => peer.name) ?? EMPTY_SERIES,
		[assetPieSeries]
	)
	const assetPieSelection = useLocalSelection({
		allowEmptySelection: true,
		availableSeries: assetPieSeriesNames,
		scope: `${selectedStablecoinAssetId}:chainPie`
	})
	const assetPiePresentation = useMemo(
		() =>
			assetPieSeries
				? buildRuntimePieChartPresentation({
						series: assetPieSeries,
						selectedSeries: assetPieSelection.selectedCharts
					})
				: { chartData: [], stackColors: {} },
		[assetPieSelection.selectedCharts, assetPieSeries]
	)
	const totalCirculating = assetPresentation.totalCirculating
	const assetRuntimeSeries = useMemo(
		() =>
			assetPresentation.chartType === 'chainMcaps' || assetPresentation.chartType === 'chainDominance'
				? getStablecoinRuntimeSeries(assetPresentation)
				: {
						selectableSeries: EMPTY_SERIES,
						defaultSeries: EMPTY_SERIES,
						renderedSelectableSeries: EMPTY_SERIES,
						fixedRemainderSeries: [],
						alwaysVisibleSeries: []
					},
		[assetPresentation]
	)
	const {
		activeSeries: activeAssetSeries,
		selectableSeries: selectableAssetSeries,
		renderedCharts: selectedAssetCharts,
		setSelectedSeries: setActiveAssetSeries
	} = useStablecoinChartSelection({
		marketCapSeries: null,
		runtimeSeries: assetRuntimeSeries,
		selectionIntent: assetSelectionIntent,
		setSelectionIntent: setAssetSelectionIntent
	})

	// The payloads colour series by rank, like the saved cards; a stablecoin's brand colour wins.
	const chainCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			chainChartPayload.charts.map((chart) => ({
				...chart,
				color: brandColors[chart.name] ?? chart.color,
				...(chainChartType === 'tokenMcaps' ? { hideAreaStyle: true } : {})
			})),
		[brandColors, chainChartPayload.charts, chainChartType]
	)
	const assetChainCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			assetPresentation.chartType === 'chainMcaps'
				? assetPresentation.charts.map((chart) => ({ ...chart, hideAreaStyle: true }))
				: [],
		[assetPresentation]
	)
	const assetChainDominanceCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() => (assetPresentation.chartType === 'chainDominance' ? assetPresentation.charts : []),
		[assetPresentation]
	)
	const showsChainSeriesSelection =
		chainChartType === 'tokenMcaps' || chainChartType === 'dominance' || chainChartType === 'tokenInflows'
	const showsAssetSeriesSelection = assetChartType === 'chainMcaps' || assetChartType === 'chainDominance'

	const isLoading =
		chainsLoading || assetsLoading || (stablecoinMode === 'chain' ? chainChartDataLoading : assetChartDataLoading)

	const chartTypeLabel =
		stablecoinMode === 'chain'
			? STABLECOIN_CHAIN_CHART_TYPES.find((t) => t.value === chainChartType)?.label || ''
			: STABLECOIN_ASSET_CHART_TYPES.find((t) => t.value === assetChartType)?.label || ''

	const handleAssetChange = (option: VirtualizedSelectOption) => {
		onSelectedStablecoinAssetChange(option.value)
		onSelectedStablecoinAssetIdChange(slug(option.value))
	}

	const renderChainChart = () => {
		if (isLoading) {
			return <SurfaceBodyLoadingStatus />
		}

		if (chainChartType === 'pie') {
			return (
				<Suspense fallback={<ChartPanelExportShellFallback />}>
					<PieChart
						chartData={chainPiePresentation.chartData}
						stackColors={{ ...chainPiePresentation.stackColors, ...brandColors }}
					/>
				</Suspense>
			)
		}

		const chartOptions =
			chainChartType === 'dominance'
				? STABLECOIN_PERCENT_CHART_OPTIONS
				: chainChartType === 'tokenInflows'
					? STABLECOIN_INFLOWS_CHART_OPTIONS
					: chainChartType === 'usdInflows'
						? STABLECOIN_SINGLE_UNITLESS_CHART_OPTIONS
						: STABLECOIN_DOLLAR_CHART_OPTIONS
		const exportButtons =
			chainChartType === 'usdInflows' || chainChartType === 'tokenInflows' ? BAR_EXPORT_BUTTONS : AREA_EXPORT_BUTTONS

		return (
			<Suspense fallback={<ChartPanelExportShellFallback />}>
				<MultiSeriesChart
					title=""
					dataset={chainChartPayload.dataset}
					charts={chainCharts}
					{...(showsChainSeriesSelection ? { selectedCharts: renderedChainCharts } : {})}
					valueSymbol={chainChartPayload.valueSymbol}
					stacked={chainChartPayload.stacked}
					{...(chainChartPayload.expandTo100Percent ? { expandTo100Percent: true } : {})}
					showTotalInTooltip={chainChartPayload.showTotalInTooltip}
					{...(chainChartType === 'totalMcap' ? { hallmarks: EMPTY_HALLMARKS } : {})}
					chartOptions={chartOptions}
					csvSource={{ type: 'dataset', prepare: prepareChainCsvDataset }}
					exportButtons={exportButtons}
				/>
			</Suspense>
		)
	}

	const renderAssetChart = () => {
		if (isLoading) {
			return <SurfaceBodyLoadingStatus />
		}

		switch (assetChartType) {
			case 'totalCirc':
				if (!assetDataset) return null
				return (
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title=""
							dataset={assetDataset}
							charts={TOTAL_CIRCULATING_CHARTS}
							valueSymbol={stablecoinSymbol}
							hallmarks={EMPTY_HALLMARKS}
							chartOptions={STABLECOIN_DOLLAR_CHART_OPTIONS}
							csvSource={{ type: 'dataset', prepare: prepareAssetCsvDataset }}
							exportButtons={AREA_EXPORT_BUTTONS}
						/>
					</Suspense>
				)
			case 'chainMcaps':
				if (!assetDataset) return null
				return (
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title=""
							dataset={assetDataset}
							charts={assetChainCharts}
							selectedCharts={selectedAssetCharts}
							valueSymbol={stablecoinSymbol}
							chartOptions={STABLECOIN_DOLLAR_CHART_OPTIONS}
							csvSource={{ type: 'dataset', prepare: prepareAssetCsvDataset }}
							exportButtons={AREA_EXPORT_BUTTONS}
						/>
					</Suspense>
				)
			case 'chainPie':
				return (
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<PieChart
							chartData={assetPiePresentation.chartData}
							stackColors={assetPiePresentation.stackColors}
							valueSymbol={stablecoinSymbol}
						/>
					</Suspense>
				)
			case 'chainDominance':
				if (!assetDataset) return null
				return (
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title=""
							valueSymbol="%"
							dataset={assetDataset}
							charts={assetChainDominanceCharts}
							selectedCharts={selectedAssetCharts}
							expandTo100Percent
							chartOptions={STABLECOIN_PERCENT_CHART_OPTIONS}
							csvSource={{ type: 'dataset', prepare: prepareAssetCsvDataset }}
							exportButtons={AREA_EXPORT_BUTTONS}
						/>
					</Suspense>
				)
			default:
				return null
		}
	}

	const hasChainSelection = selectedStablecoinChain
	const hasAssetSelection = selectedStablecoinAsset && selectedStablecoinAssetId
	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-3">
				<SegmentedControl
					variant="field"
					size="md"
					label="Stablecoin chart mode"
					options={STABLECOIN_MODE_OPTIONS}
					value={stablecoinMode}
					onValueChange={onStablecoinModeChange}
				/>

				{stablecoinMode === 'chain' ? (
					<>
						{chainParameter.boundVariable ? (
							<BoundParameterChip label={chainParameter.boundVariable.label} onUnbind={chainParameter.unbind} />
						) : null}
						<VirtualizedSelect
							variant="field"
							label="Chain"
							error={error}
							options={selectableChainOptions}
							selectedValue={selectedStablecoinChain}
							onChange={(option) => {
								const variable = chainParameter.resolveSelection(option.value)
								if (variable) {
									onSelectedStablecoinChainChange(variable.value)
									chainParameter.bind(variable.id)
									return
								}
								onSelectedStablecoinChainChange(option.value)
							}}
							placeholder="Select chain…"
							isLoading={chainsLoading}
						/>

						<VirtualizedSelect
							variant="field"
							label="Chart type"
							options={STABLECOIN_CHAIN_CHART_TYPES}
							selectedValue={chainChartType}
							onChange={(option) => onSelectedStablecoinChartTypeChange(option.value)}
							placeholder="Select chart type…"
						/>
					</>
				) : (
					<>
						<VirtualizedSelect
							variant="field"
							label="Stablecoin"
							error={error}
							options={assetOptions}
							selectedValue={selectedStablecoinAsset || null}
							onChange={handleAssetChange}
							placeholder="Select stablecoin…"
							isLoading={assetsLoading}
						/>

						<VirtualizedSelect
							variant="field"
							label="Chart type"
							options={STABLECOIN_ASSET_CHART_TYPES}
							selectedValue={assetChartType}
							onChange={(option) => onSelectedStablecoinAssetChartTypeChange(option.value)}
							placeholder="Select chart type…"
						/>
					</>
				)}

				<div className="body-sm text-tertiary">
					{stablecoinMode === 'chain' && totalMcapCurrent !== null ? (
						<p>
							Total Market Cap:{' '}
							<span className="font-semibold text-primary">
								{formatUsd(totalMcapCurrent, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							</span>
						</p>
					) : null}
					{stablecoinMode === 'asset' && totalCirculating !== null ? (
						<p>
							Total Circulating:{' '}
							<span className="font-semibold text-primary">
								{formatCompactNumber(totalCirculating, {
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}{' '}
								{stablecoinSymbol}
							</span>
						</p>
					) : null}
				</div>
			</div>

			<div className="overflow-hidden rounded-lg border border-subtle">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-3 py-2">
					<h4 className="label-sm text-secondary">Preview</h4>
					{stablecoinMode === 'chain' && chainChartType === 'pie' && chainPieSeriesNames.length > 1 ? (
						<SelectWithCombobox
							size="sm"
							allValues={chainPieSeriesNames}
							selectedValues={chainPieSelection.activeSeries}
							setSelectedValues={chainPieSelection.setSelectedSeries}
							label="Token"
							labelType="smol"
							variant="filter"
						/>
					) : stablecoinMode === 'chain' && showsChainSeriesSelection && selectableChainSeries.length > 1 ? (
						<SelectWithCombobox
							size="sm"
							allValues={selectableChainSeries}
							selectedValues={activeChainSeries}
							setSelectedValues={setActiveChainSeries}
							label="Token"
							labelType="smol"
							variant="filter"
						/>
					) : stablecoinMode === 'asset' && assetChartType === 'chainPie' && assetPieSeriesNames.length > 1 ? (
						<SelectWithCombobox
							size="sm"
							allValues={assetPieSeriesNames}
							selectedValues={assetPieSelection.activeSeries}
							setSelectedValues={assetPieSelection.setSelectedSeries}
							label="Chain"
							labelType="smol"
							variant="filter"
						/>
					) : stablecoinMode === 'asset' && showsAssetSeriesSelection && selectableAssetSeries.length > 1 ? (
						<SelectWithCombobox
							size="sm"
							allValues={selectableAssetSeries}
							selectedValues={activeAssetSeries}
							setSelectedValues={setActiveAssetSeries}
							label="Chain"
							labelType="smol"
							variant="filter"
						/>
					) : null}
				</div>

				{(stablecoinMode === 'chain' && hasChainSelection) || (stablecoinMode === 'asset' && hasAssetSelection) ? (
					<div className="bg-surface p-3">
						<div className="mb-3">
							<h3 className="mb-1 title-md text-primary">
								{stablecoinMode === 'chain'
									? `${selectedStablecoinChain === 'All' ? 'All chains' : selectedStablecoinChain} - ${chartTypeLabel}`
									: `${stablecoinName || selectedStablecoinAsset}${stablecoinSymbol ? ` (${stablecoinSymbol})` : ''} - ${chartTypeLabel}`}
							</h3>
							<p className="body-sm text-secondary">
								{stablecoinMode === 'chain' ? 'Stablecoins Market Cap' : 'Circulating by chain'}
							</p>
						</div>
						<div className="flex min-h-[400px] flex-col">
							{stablecoinMode === 'chain' ? renderChainChart() : renderAssetChart()}
						</div>
					</div>
				) : (
					<div className="flex h-[320px] items-center justify-center text-center text-tertiary">
						<div>
							<Icon name="dollar-sign" height={32} width={32} className="mx-auto mb-1" />
							<div className="body-sm">
								{stablecoinMode === 'chain'
									? 'Select a chain and chart type to see preview'
									: 'Select a stablecoin and chart type to see preview'}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
