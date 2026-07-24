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
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { slug } from '~/utils'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { AriakitSelect } from '../AriakitSelect'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'

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

const EMPTY_HALLMARKS: [number, string][] = []
const EMPTY_CHAIN_LIST: StablecoinChainInfo[] = []
const EMPTY_ASSET_LIST: StablecoinAssetInfo[] = []
const EMPTY_SERIES: string[] = []
const TOTAL_CIRCULATING_CHARTS: MultiSeriesChartSeriesConfig[] = [
	{ type: 'line', name: 'Circulating', encode: { x: 'timestamp', y: 'Circulating' }, color: '#3e79cc' }
]
const AREA_EXPORT_BUTTONS = { csv: true, png: true, filename: 'chart' }
const BAR_EXPORT_BUTTONS = { csv: true, png: false, filename: 'bar-chart-data' }
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
	const { data: chainsListData, isLoading: chainsLoading } = useStablecoinChainsList()
	const { data: assetsListData, isLoading: assetsLoading } = useStablecoinAssetsList()
	const chainsList = chainsListData ?? EMPTY_CHAIN_LIST
	const assetsList = assetsListData ?? EMPTY_ASSET_LIST
	const chainOptions: VirtualizedSelectOption[] = useMemo(() => {
		const options: VirtualizedSelectOption[] = [{ value: 'All', label: 'All Chains', icon: '🌐' }]
		for (const chain of chainsList as StablecoinChainInfo[]) {
			options.push({
				value: chain.name,
				label: chain.name,
				logo: chainIconUrl(chain.name),
				description: formatUsd(chain.tvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
			})
		}
		return options
	}, [chainsList])

	const assetOptions: VirtualizedSelectOption[] = useMemo(() => {
		return (assetsList as StablecoinAssetInfo[]).map((asset) => ({
			value: asset.name,
			label: `${asset.name} (${asset.symbol})`,
			logo: asset.geckoId ? tokenIconUrl(asset.geckoId) : undefined,
			description: formatUsd(asset.mcap, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
			extra: slug(asset.name)
		}))
	}, [assetsList])
	const { selectionIntent: chainSelectionIntent, setSelectionIntent: setChainSelectionIntent } =
		useStablecoinSelectionIntent(`${selectedStablecoinChain}:${selectedStablecoinChartType}`)
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
		totalMcapCurrent,
		isLoading: chainChartDataLoading
	} = useStablecoinsChartData(
		selectedStablecoinChain,
		selectedStablecoinChartType as StablecoinChartType,
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
	const chainPieSelection = useAllSeriesSelection({
		availableSeries: chainPieSeriesNames,
		selectionKey: `${selectedStablecoinChain}:pie`
	})
	const chainPiePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: chainPieSeries,
				selectedSeries: chainPieSelection.selectedCharts,
				includeUpstreamOthers: chainPieSelection.includeUpstreamOthers
			}),
		[chainPieSelection.includeUpstreamOthers, chainPieSelection.selectedCharts, chainPieSeries]
	)
	const { selectionIntent: assetSelectionIntent, setSelectionIntent: setAssetSelectionIntent } =
		useStablecoinSelectionIntent(`${selectedStablecoinAssetId}:${selectedStablecoinAssetChartType}`)
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
		isLoading: assetChartDataLoading
	} = useStablecoinAssetChartData(
		stablecoinMode === 'asset' ? selectedStablecoinAssetId || '' : '',
		selectedStablecoinAssetChartType as StablecoinAssetChartType,
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
				? getStablecoinRuntimeSeries({
						dataset: assetPresentation.dataset,
						charts: assetPresentation.charts,
						availableSeries: assetPresentation.availableSeries
					})
				: {
						selectableSeries: EMPTY_SERIES,
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

	const chainCharts = useMemo<MultiSeriesChartSeriesConfig[]>(
		() =>
			chainChartPayload.charts.map((chart) => ({
				...chart,
				color: stackColors[chart.name] ?? chart.color,
				...(selectedStablecoinChartType === 'tokenMcaps' ? { hideAreaStyle: true } : {})
			})),
		[chainChartPayload.charts, selectedStablecoinChartType, stackColors]
	)
	const assetChainCharts = useMemo<MultiSeriesChartSeriesConfig[]>(
		() =>
			assetPresentation.chartType === 'chainMcaps'
				? assetPresentation.charts.map((chart) => ({
						...chart,
						color: assetChainColors[chart.name] ?? chart.color,
						hideAreaStyle: true
					}))
				: [],
		[assetPresentation, assetChainColors]
	)
	const assetChainDominanceCharts = useMemo<MultiSeriesChartSeriesConfig[]>(
		() =>
			assetPresentation.chartType === 'chainDominance'
				? assetPresentation.charts.map((chart) => ({
						...chart,
						color: assetChainColors[chart.name] ?? chart.color
					}))
				: [],
		[assetPresentation, assetChainColors]
	)
	const showsChainSeriesSelection =
		selectedStablecoinChartType === 'tokenMcaps' ||
		selectedStablecoinChartType === 'dominance' ||
		selectedStablecoinChartType === 'tokenInflows'
	const showsAssetSeriesSelection =
		selectedStablecoinAssetChartType === 'chainMcaps' || selectedStablecoinAssetChartType === 'chainDominance'

	const isLoading =
		chainsLoading || assetsLoading || (stablecoinMode === 'chain' ? chainChartDataLoading : assetChartDataLoading)

	const chartTypeLabel =
		stablecoinMode === 'chain'
			? STABLECOIN_CHAIN_CHART_TYPES.find((t) => t.value === selectedStablecoinChartType)?.label || ''
			: STABLECOIN_ASSET_CHART_TYPES.find((t) => t.value === selectedStablecoinAssetChartType)?.label || ''

	const handleAssetChange = (option: VirtualizedSelectOption) => {
		onSelectedStablecoinAssetChange(option.value)
		onSelectedStablecoinAssetIdChange(option.extra as string)
	}

	const renderChainChart = () => {
		if (isLoading) {
			return (
				<div className="flex h-[320px] items-center justify-center">
					<LocalLoader />
				</div>
			)
		}

		if (selectedStablecoinChartType === 'pie') {
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
			selectedStablecoinChartType === 'dominance'
				? STABLECOIN_PERCENT_CHART_OPTIONS
				: selectedStablecoinChartType === 'tokenInflows'
					? STABLECOIN_INFLOWS_CHART_OPTIONS
					: selectedStablecoinChartType === 'usdInflows'
						? STABLECOIN_SINGLE_UNITLESS_CHART_OPTIONS
						: STABLECOIN_DOLLAR_CHART_OPTIONS
		const exportButtons =
			selectedStablecoinChartType === 'usdInflows' || selectedStablecoinChartType === 'tokenInflows'
				? BAR_EXPORT_BUTTONS
				: AREA_EXPORT_BUTTONS

		return (
			<Suspense fallback={<LocalLoader />}>
				<MultiSeriesChart
					title=""
					dataset={chainChartPayload.dataset}
					charts={chainCharts}
					selectedCharts={showsChainSeriesSelection ? renderedChainCharts : undefined}
					valueSymbol={chainChartPayload.valueSymbol ?? ''}
					stacked={chainChartPayload.stacked}
					expandTo100Percent={chainChartPayload.expandTo100Percent}
					showTotalInTooltip={chainChartPayload.showTotalInTooltip}
					hallmarks={selectedStablecoinChartType === 'totalMcap' ? EMPTY_HALLMARKS : undefined}
					chartOptions={chartOptions}
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

		switch (selectedStablecoinAssetChartType) {
			case 'totalCirc':
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
							dataset={assetDataset!}
							charts={TOTAL_CIRCULATING_CHARTS}
							valueSymbol="$"
							hallmarks={EMPTY_HALLMARKS}
							chartOptions={STABLECOIN_DOLLAR_CHART_OPTIONS}
							exportButtons={AREA_EXPORT_BUTTONS}
						/>
					</Suspense>
				)
			case 'chainMcaps':
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
							dataset={assetDataset!}
							charts={assetChainCharts}
							selectedCharts={selectedAssetCharts}
							valueSymbol="$"
							chartOptions={STABLECOIN_DOLLAR_CHART_OPTIONS}
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
						/>
					</Suspense>
				)
			case 'chainDominance':
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
							dataset={assetDataset!}
							charts={assetChainDominanceCharts}
							selectedCharts={selectedAssetCharts}
							expandTo100Percent={true}
							chartOptions={STABLECOIN_PERCENT_CHART_OPTIONS}
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
						<AriakitVirtualizedSelect
							label="Chain"
							options={chainOptions}
							selectedValue={selectedStablecoinChain}
							onChange={(option) => onSelectedStablecoinChainChange(option.value)}
							placeholder="Select chain..."
							isLoading={chainsLoading}
						/>

						<AriakitSelect
							label="Chart Type"
							options={STABLECOIN_CHAIN_CHART_TYPES}
							selectedValue={selectedStablecoinChartType}
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
							selectedValue={selectedStablecoinAssetChartType}
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
								{formatUsd(totalCirculating, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							</span>
						</p>
					) : null}
				</div>
			</div>

			<div className="overflow-hidden rounded-lg border pro-border">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-pro-cards-border px-3 py-2">
					<h4 className="text-xs font-medium text-pro-text-secondary">Preview</h4>
					{stablecoinMode === 'chain' && selectedStablecoinChartType === 'pie' && chainPieSeriesNames.length > 1 ? (
						<SelectWithCombobox
							size="sm"
							allValues={chainPieSeriesNames}
							selectedValues={chainPieSelection.activeSeries}
							setSelectedValues={chainPieSelection.setSelectedSeries}
							label="Token"
							labelType="smol"
							variant="filter"
							popoverVariant="legacy"
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
							popoverVariant="legacy"
						/>
					) : stablecoinMode === 'asset' &&
					  selectedStablecoinAssetChartType === 'chainPie' &&
					  assetPieSeriesNames.length > 1 ? (
						<SelectWithCombobox
							size="sm"
							allValues={assetPieSeriesNames}
							selectedValues={assetPieSelection.activeSeries}
							setSelectedValues={assetPieSelection.setSelectedSeries}
							label="Chain"
							labelType="smol"
							variant="filter"
							popoverVariant="legacy"
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
							popoverVariant="legacy"
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
