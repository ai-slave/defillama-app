import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { IMultiSeriesChart2Props, IPieChartProps, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
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
import {
	buildStablecoinBreakdownDatasetPresentation,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT
} from '~/containers/Stablecoins/chartSeries'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { formattedNum, slug } from '~/utils'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { AriakitSelect } from '../AriakitSelect'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
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
const TOTAL_CIRCULATING_CHARTS: MultiSeriesChart2SeriesConfig[] = [
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
	const [selectedChainSeries, setSelectedChainSeries] = useState<string[] | null>(null)
	const [selectedAssetSeries, setSelectedAssetSeries] = useState<string[] | null>(null)

	useEffect(() => {
		setSelectedChainSeries(null)
	}, [selectedStablecoinChain, selectedStablecoinChartType])
	useEffect(() => {
		setSelectedAssetSeries(null)
	}, [selectedStablecoinAssetId, selectedStablecoinAssetChartType])

	const chainOptions: VirtualizedSelectOption[] = useMemo(() => {
		const options: VirtualizedSelectOption[] = [{ value: 'All', label: 'All Chains', icon: '🌐' }]
		for (const chain of chainsList as StablecoinChainInfo[]) {
			options.push({
				value: chain.name,
				label: chain.name,
				logo: chainIconUrl(chain.name),
				description: formattedNum(chain.tvl, true)
			})
		}
		return options
	}, [chainsList])

	const assetOptions: VirtualizedSelectOption[] = useMemo(() => {
		return (assetsList as StablecoinAssetInfo[]).map((asset) => ({
			value: asset.name,
			label: `${asset.name} (${asset.symbol})`,
			logo: asset.geckoId ? tokenIconUrl(asset.geckoId) : undefined,
			description: formattedNum(asset.mcap, true),
			extra: slug(asset.name)
		}))
	}, [assetsList])

	const {
		chartPayload: chainChartPayload,
		chainsCirculatingValues,
		seriesNames,
		availableSeries: availableChainSeries,
		defaultSeries: defaultChainSeries,
		totalMcapCurrent,
		isLoading: chainChartDataLoading
	} = useStablecoinsChartData(
		selectedStablecoinChain,
		selectedStablecoinChartType as StablecoinChartType,
		selectedChainSeries,
		stablecoinMode === 'chain'
	)

	const {
		totalDataset: assetTotalDataset,
		areaDataset: assetAreaDataset,
		dominanceDataset: assetDominanceDataset,
		chainsCirculatingValues: assetChainsCirculatingValues,
		chainsUnique,
		stablecoinName,
		stablecoinSymbol,
		totalCirculating,
		isLoading: assetChartDataLoading
	} = useStablecoinAssetChartData(
		stablecoinMode === 'asset' ? selectedStablecoinAssetId || '' : '',
		selectedStablecoinAssetChartType as StablecoinAssetChartType
	)

	const assetBreakdownPresentation = useMemo(() => {
		const dataset =
			selectedStablecoinAssetChartType === 'chainMcaps'
				? assetAreaDataset
				: selectedStablecoinAssetChartType === 'chainDominance'
					? assetDominanceDataset
					: null
		if (!dataset) return null
		return buildStablecoinBreakdownDatasetPresentation({
			dataset,
			seriesNames: chainsUnique,
			selectedNames: selectedAssetSeries
		})
	}, [assetAreaDataset, assetDominanceDataset, chainsUnique, selectedAssetSeries, selectedStablecoinAssetChartType])

	const assetChainColors = useMemo(() => {
		const colors: Record<string, string> = {}
		for (const chain of [...chainsUnique, 'Others']) {
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

	const chainCharts = useMemo<MultiSeriesChart2SeriesConfig[]>(
		() =>
			chainChartPayload.charts.map((chart) => ({
				...chart,
				color: stackColors[chart.name] ?? chart.color,
				...(selectedStablecoinChartType === 'tokenMcaps' ? { hideAreaStyle: true } : {})
			})),
		[chainChartPayload.charts, selectedStablecoinChartType, stackColors]
	)
	const assetChainCharts = useMemo<MultiSeriesChart2SeriesConfig[]>(
		() =>
			(assetBreakdownPresentation?.visibleSeries ?? []).map((name) => ({
				type: 'line',
				name,
				encode: { x: 'timestamp', y: name },
				color: assetChainColors[name],
				hideAreaStyle: true
			})),
		[assetBreakdownPresentation?.visibleSeries, assetChainColors]
	)
	const assetChainDominanceCharts = useMemo<MultiSeriesChart2SeriesConfig[]>(
		() =>
			(assetBreakdownPresentation?.visibleSeries ?? []).map((name) => ({
				type: 'line',
				name,
				encode: { x: 'timestamp', y: name },
				color: assetChainColors[name]
			})),
		[assetBreakdownPresentation?.visibleSeries, assetChainColors]
	)
	const activeChainSeries = selectedChainSeries ?? defaultChainSeries
	const activeAssetSeries = selectedAssetSeries ?? assetBreakdownPresentation?.defaultSeries ?? []
	const setActiveChainSeries: Dispatch<SetStateAction<string[]>> = (next) => {
		setSelectedChainSeries((current) => {
			const values = typeof next === 'function' ? next(current ?? defaultChainSeries) : next
			return values.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT)
		})
	}
	const setActiveAssetSeries: Dispatch<SetStateAction<string[]>> = (next) => {
		setSelectedAssetSeries((current) => {
			const values =
				typeof next === 'function' ? next(current ?? assetBreakdownPresentation?.defaultSeries ?? []) : next
			return values.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT)
		})
	}

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
					<PieChart chartData={chainsCirculatingValues} stackColors={stackColors} />
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
				<MultiSeriesChart2
					title=""
					dataset={chainChartPayload.dataset}
					charts={chainCharts}
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
						<MultiSeriesChart2
							title=""
							dataset={assetTotalDataset}
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
						<MultiSeriesChart2
							title=""
							dataset={assetBreakdownPresentation?.dataset ?? assetAreaDataset}
							charts={assetChainCharts}
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
						<PieChart chartData={assetChainsCirculatingValues} stackColors={assetChainColors} />
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
						<MultiSeriesChart2
							title=""
							valueSymbol="%"
							dataset={assetBreakdownPresentation?.dataset ?? assetDominanceDataset}
							charts={assetChainDominanceCharts}
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
	const showsChainSeriesSelection =
		selectedStablecoinChartType === 'tokenMcaps' ||
		selectedStablecoinChartType === 'dominance' ||
		selectedStablecoinChartType === 'tokenInflows'
	const showsAssetSeriesSelection =
		selectedStablecoinAssetChartType === 'chainMcaps' || selectedStablecoinAssetChartType === 'chainDominance'

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
							<span className="font-semibold text-pro-text-primary">{formattedNum(totalMcapCurrent, true)}</span>
						</p>
					) : null}
					{stablecoinMode === 'asset' && totalCirculating !== null ? (
						<p>
							Total Circulating:{' '}
							<span className="font-semibold text-pro-text-primary">{formattedNum(totalCirculating, true)}</span>
						</p>
					) : null}
				</div>
			</div>

			<div className="overflow-hidden rounded-lg border pro-border">
				<h4 className="border-b border-pro-cards-border px-3 py-2 text-xs font-medium text-pro-text-secondary">
					Preview
				</h4>

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
						{stablecoinMode === 'chain' && showsChainSeriesSelection && availableChainSeries.length > 1 ? (
							<div className="mb-2 flex justify-end">
								<SelectWithCombobox
									size="sm"
									allValues={availableChainSeries}
									selectedValues={activeChainSeries}
									setSelectedValues={setActiveChainSeries}
									label="Token"
									labelType="smol"
									variant="filter"
									popoverVariant="legacy"
								/>
							</div>
						) : null}
						{stablecoinMode === 'asset' &&
						showsAssetSeriesSelection &&
						(assetBreakdownPresentation?.availableSeries.length ?? 0) > 1 ? (
							<div className="mb-2 flex justify-end">
								<SelectWithCombobox
									size="sm"
									allValues={assetBreakdownPresentation?.availableSeries ?? []}
									selectedValues={activeAssetSeries}
									setSelectedValues={setActiveAssetSeries}
									label="Chain"
									labelType="smol"
									variant="filter"
									popoverVariant="legacy"
								/>
							</div>
						) : null}

						<div
							key={stablecoinMode === 'chain' ? selectedStablecoinChartType : selectedStablecoinAssetChartType}
							className="h-[320px]"
						>
							{stablecoinMode === 'chain' ? renderChainChart() : renderAssetChart()}
						</div>
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
