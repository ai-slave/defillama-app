import { lazy, Suspense, useMemo } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
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
import {
	colorManager,
	generateConsistentChartColor,
	STABLECOIN_TOKEN_COLORS
} from '~/containers/ProDashboard/utils/colorManager'
import { getStablecoinRuntimeSeries } from '~/containers/Stablecoins/chartSeries'
import {
	useStablecoinChartSelection,
	useStablecoinSelectionIntent
} from '~/containers/Stablecoins/useStablecoinChartSelection'
import { useAllSeriesSelection, useSeriesSelection } from '~/hooks/useSeriesSelection'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { slug } from '~/utils'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { AriakitSelect } from '../AriakitSelect'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

interface StablecoinsChartTabProps {
	selectedStablecoinChain: string
	selectedStablecoinChartType: string
	stablecoinMode: 'chain' | 'asset'
	selectedStablecoinAsset: string | null
	selectedStablecoinAssetId: string | null
	selectedStablecoinAssetChartType: string
	onSelectedStablecoinChainChange: (chain: string) => void
	onSelectedStablecoinChartTypeChange: (chartType: string) => void
	onStablecoinModeChange: (mode: 'chain' | 'asset') => void
	onSelectedStablecoinAssetChange: (asset: string | null) => void
	onSelectedStablecoinAssetIdChange: (id: string | null) => void
	onSelectedStablecoinAssetChartTypeChange: (chartType: string) => void
}

const STABLECOIN_CHAIN_CHART_TYPES = [
	{ value: 'totalMcap', label: 'Total Market Cap' },
	{ value: 'tokenMcaps', label: 'Token Market Caps' },
	{ value: 'pie', label: 'Pie' },
	{ value: 'dominance', label: 'Dominance' },
	{ value: 'usdInflows', label: 'USD Inflows' },
	{ value: 'tokenInflows', label: 'Token Inflows' }
]

const STABLECOIN_ASSET_CHART_TYPES = [
	{ value: 'totalCirc', label: 'Total Circulating' },
	{ value: 'chainMcaps', label: 'By Chain' },
	{ value: 'chainPie', label: 'Pie' },
	{ value: 'chainDominance', label: 'Chain Dominance' }
]

const EMPTY_HALLMARKS: Array<[number, string]> = []
const EMPTY_CHAIN_LIST: Array<StablecoinChainInfo> = []
const EMPTY_ASSET_LIST: Array<StablecoinAssetInfo> = []
const EMPTY_SERIES: Array<string> = []
const TOTAL_CIRCULATING_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{ type: 'line', name: 'Circulating', encode: { x: 'timestamp', y: 'Circulating' }, color: '#3e79cc' }
]
const AREA_EXPORT_BUTTONS = { csv: true, png: true, filename: 'chart' }
const BAR_EXPORT_BUTTONS = { csv: true, png: false, filename: 'bar-chart-data' }

function normalizeStablecoinChartType(chartType: string): StablecoinChartType {
	switch (chartType) {
		case 'totalMcap':
		case 'tokenMcaps':
		case 'pie':
		case 'dominance':
		case 'usdInflows':
		case 'tokenInflows':
			return chartType
		default:
			return 'totalMcap'
	}
}

function normalizeStablecoinAssetChartType(chartType: string): StablecoinAssetChartType {
	switch (chartType) {
		case 'totalCirc':
		case 'chainMcaps':
		case 'chainPie':
		case 'chainDominance':
			return chartType
		default:
			return 'totalCirc'
	}
}

export function StablecoinsChartTab({
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
	const chainChartType = normalizeStablecoinChartType(selectedStablecoinChartType)
	const assetChartType = normalizeStablecoinAssetChartType(selectedStablecoinAssetChartType)
	const { data: chainsListData, isLoading: chainsLoading } = useStablecoinChainsList()
	const { data: assetsListData, isLoading: assetsLoading } = useStablecoinAssetsList()
	const chainsList = chainsListData ?? EMPTY_CHAIN_LIST
	const assetsList = assetsListData ?? EMPTY_ASSET_LIST
	const chainOptions: Array<VirtualizedSelectOption> = useMemo(() => {
		const options: Array<VirtualizedSelectOption> = [{ value: 'All', label: 'All Chains', icon: '🌐' }]
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
						}),
			extra: slug(asset.name)
		}))
	}, [assetsList])
	const { selectionIntent: chainSelectionIntent, setSelectionIntent: setChainSelectionIntent } =
		useStablecoinSelectionIntent(`${selectedStablecoinChain}:${chainChartType}`)
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
		seriesNames,
		defaultSeries: chainDefaultSeries,
		totalMcapCurrent,
		prepareCompleteCsvDataset: prepareCompleteChainCsvDataset,
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
	const chainPieSelection = useSeriesSelection({
		availableSeries: chainPieSeriesNames,
		defaultSeries: chainDefaultSeries,
		allowEmptySelection: true,
		resetToDefaultWhenStale: true,
		storeDefaultAsIntent: true,
		selectionKey: `${selectedStablecoinChain}:pie`
	})
	const chainPiePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: chainPieSeries,
				selectedSeries: chainPieSelection.selectedCharts,
				includeUpstreamOthers:
					chainPieSelection.isDefaultSelection && chainDefaultSeries.length === chainPieSeriesNames.length
			}),
		[
			chainDefaultSeries.length,
			chainPieSelection.isDefaultSelection,
			chainPieSelection.selectedCharts,
			chainPieSeries,
			chainPieSeriesNames.length
		]
	)
	const { selectionIntent: assetSelectionIntent, setSelectionIntent: setAssetSelectionIntent } =
		useStablecoinSelectionIntent(`${selectedStablecoinAssetId}:${assetChartType}`)
	const assetSelectionOptions = useMemo(
		() => ({
			selectedNames: assetSelectionIntent?.mode === 'include' ? assetSelectionIntent.names : null,
			excludedNames: assetSelectionIntent?.mode === 'exclude' ? assetSelectionIntent.names : null
		}),
		[assetSelectionIntent]
	)

	const {
		presentation: assetPresentation,
		chainsUnique,
		stablecoinName,
		stablecoinSymbol,
		prepareCompleteCsvDataset: prepareCompleteAssetCsvDataset,
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
	const assetPieSelection = useAllSeriesSelection({
		availableSeries: assetPieSeriesNames,
		selectionKey: `${selectedStablecoinAssetId}:chainPie`
	})
	const assetPiePresentation = useMemo(
		() =>
			assetPieSeries
				? buildRuntimePieChartPresentation({
						series: assetPieSeries,
						selectedSeries: assetPieSelection.selectedCharts,
						includeUpstreamOthers: assetPieSelection.includeUpstreamOthers
					})
				: { chartData: [], stackColors: {} },
		[assetPieSelection.includeUpstreamOthers, assetPieSelection.selectedCharts, assetPieSeries]
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

	const assetChainColors = useMemo(() => {
		const colors: Record<string, string> = {}
		for (const chain of chainsUnique) {
			colors[chain] = colorManager.getItemColor(chain, 'chain')
		}
		return colors
	}, [chainsUnique])

	const stackColors = useMemo(() => {
		const colors: Record<string, string> = { ...STABLECOIN_TOKEN_COLORS }
		for (const name of seriesNames) {
			if (!colors[name]) {
				colors[name] = generateConsistentChartColor(name, '#8884d8', 'protocol')
			}
		}
		return colors
	}, [seriesNames])

	const chainCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			chainChartPayload.charts.map((chart) => ({
				...chart,
				color: stackColors[chart.name] ?? chart.color ?? '#3e79cc',
				...(chainChartType === 'tokenMcaps' ? { hideAreaStyle: true } : {})
			})),
		[chainChartPayload.charts, chainChartType, stackColors]
	)
	const assetChainCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			assetPresentation.chartType === 'chainMcaps'
				? assetPresentation.charts.map((chart) => ({
						...chart,
						color: assetChainColors[chart.name] ?? chart.color ?? '#3e79cc',
						hideAreaStyle: true
					}))
				: [],
		[assetPresentation, assetChainColors]
	)
	const assetChainDominanceCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			assetPresentation.chartType === 'chainDominance'
				? assetPresentation.charts.map((chart) => ({
						...chart,
						color: assetChainColors[chart.name] ?? chart.color ?? '#3e79cc'
					}))
				: [],
		[assetPresentation, assetChainColors]
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
			return (
				<div className="flex h-[320px] items-center justify-center">
					<LocalLoader />
				</div>
			)
		}

		if (chainChartType === 'pie') {
			return (
				<Suspense fallback={<LocalLoader />}>
					<PieChart
						chartData={chainPiePresentation.chartData}
						stackColors={{ ...chainPiePresentation.stackColors, ...stackColors }}
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
			<Suspense fallback={<LocalLoader />}>
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
					csvSource={{ type: 'dataset', prepare: prepareCompleteChainCsvDataset }}
					exportButtons={exportButtons}
				/>
			</Suspense>
		)
	}

	const renderAssetChart = () => {
		if (isLoading) {
			return (
				<div className="flex h-[320px] items-center justify-center">
					<LocalLoader />
				</div>
			)
		}

		switch (assetChartType) {
			case 'totalCirc':
				if (!assetDataset) return null
				return (
					<Suspense
						fallback={
							<div className="flex h-[320px] items-center justify-center">
								<LocalLoader />
							</div>
						}
					>
						<MultiSeriesChart
							title=""
							dataset={assetDataset}
							charts={TOTAL_CIRCULATING_CHARTS}
							valueSymbol={stablecoinSymbol}
							hallmarks={EMPTY_HALLMARKS}
							chartOptions={STABLECOIN_DOLLAR_CHART_OPTIONS}
							csvSource={{ type: 'dataset', prepare: prepareCompleteAssetCsvDataset }}
							exportButtons={AREA_EXPORT_BUTTONS}
						/>
					</Suspense>
				)
			case 'chainMcaps':
				if (!assetDataset) return null
				return (
					<Suspense
						fallback={
							<div className="flex h-[320px] items-center justify-center">
								<LocalLoader />
							</div>
						}
					>
						<MultiSeriesChart
							title=""
							dataset={assetDataset}
							charts={assetChainCharts}
							selectedCharts={selectedAssetCharts}
							valueSymbol={stablecoinSymbol}
							chartOptions={STABLECOIN_DOLLAR_CHART_OPTIONS}
							csvSource={{ type: 'dataset', prepare: prepareCompleteAssetCsvDataset }}
							exportButtons={AREA_EXPORT_BUTTONS}
						/>
					</Suspense>
				)
			case 'chainPie':
				return (
					<Suspense
						fallback={
							<div className="flex h-[320px] items-center justify-center">
								<LocalLoader />
							</div>
						}
					>
						<PieChart
							chartData={assetPiePresentation.chartData}
							stackColors={{ ...assetPiePresentation.stackColors, ...assetChainColors }}
							valueSymbol={stablecoinSymbol}
						/>
					</Suspense>
				)
			case 'chainDominance':
				if (!assetDataset) return null
				return (
					<Suspense
						fallback={
							<div className="flex h-[320px] items-center justify-center">
								<LocalLoader />
							</div>
						}
					>
						<MultiSeriesChart
							title=""
							valueSymbol="%"
							dataset={assetDataset}
							charts={assetChainDominanceCharts}
							selectedCharts={selectedAssetCharts}
							expandTo100Percent
							chartOptions={STABLECOIN_PERCENT_CHART_OPTIONS}
							csvSource={{ type: 'dataset', prepare: prepareCompleteAssetCsvDataset }}
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
				<div className="flex rounded-md border border-pro-cards-border p-0.5">
					<button
						type="button"
						onClick={() => onStablecoinModeChange('chain')}
						className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
							stablecoinMode === 'chain'
								? 'bg-pro-cards-bg text-pro-text-primary shadow-sm'
								: 'text-pro-text-secondary hover:text-pro-text-primary'
						}`}
					>
						By Chain
					</button>
					<button
						type="button"
						onClick={() => onStablecoinModeChange('asset')}
						className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
							stablecoinMode === 'asset'
								? 'bg-pro-cards-bg text-pro-text-primary shadow-sm'
								: 'text-pro-text-secondary hover:text-pro-text-primary'
						}`}
					>
						By Asset
					</button>
				</div>

				{stablecoinMode === 'chain' ? (
					<>
						{chainParameter.boundVariable ? (
							<BoundParameterChip label={chainParameter.boundVariable.label} onUnbind={chainParameter.unbind} />
						) : null}
						<AriakitVirtualizedSelect
							label="Chain"
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
							placeholder="Select chain..."
							isLoading={chainsLoading}
						/>

						<AriakitSelect
							label="Chart Type"
							options={STABLECOIN_CHAIN_CHART_TYPES}
							selectedValue={chainChartType}
							onChange={(option) => onSelectedStablecoinChartTypeChange(option.value)}
							placeholder="Select chart type..."
						/>
					</>
				) : (
					<>
						<AriakitVirtualizedSelect
							label="Stablecoin"
							options={assetOptions}
							selectedValue={selectedStablecoinAsset || ''}
							onChange={handleAssetChange}
							placeholder="Select stablecoin..."
							isLoading={assetsLoading}
						/>

						<AriakitSelect
							label="Chart Type"
							options={STABLECOIN_ASSET_CHART_TYPES}
							selectedValue={assetChartType}
							onChange={(option) => onSelectedStablecoinAssetChartTypeChange(option.value)}
							placeholder="Select chart type..."
						/>
					</>
				)}

				<div className="text-xs text-pro-text-tertiary">
					{stablecoinMode === 'chain' && totalMcapCurrent !== null ? (
						<p>
							Total Market Cap:{' '}
							<span className="font-semibold text-pro-text-primary">
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
							<span className="font-semibold text-pro-text-primary">
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

			<div className="overflow-hidden rounded-lg border border-pro-cards-border">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-pro-cards-border px-3 py-2">
					<h4 className="text-xs font-medium text-pro-text-secondary">Preview</h4>
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
					<div className="bg-pro-cards-bg p-3">
						<div className="mb-3">
							<h3 className="mb-1 text-sm font-semibold text-pro-text-primary">
								{stablecoinMode === 'chain'
									? `${selectedStablecoinChain === 'All' ? 'All Chains' : selectedStablecoinChain} - ${chartTypeLabel}`
									: `${stablecoinName || selectedStablecoinAsset}${stablecoinSymbol ? ` (${stablecoinSymbol})` : ''} - ${chartTypeLabel}`}
							</h3>
							<p className="text-xs text-pro-text-secondary">
								{stablecoinMode === 'chain' ? 'Stablecoins Market Cap' : 'Circulating by Chain'}
							</p>
						</div>
						<div className="h-[320px]">{stablecoinMode === 'chain' ? renderChainChart() : renderAssetChart()}</div>
					</div>
				) : (
					<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
						<div>
							<Icon name="dollar-sign" height={32} width={32} className="mx-auto mb-1" />
							<div className="text-xs">
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
