import { Icon } from '~/ui/Icon'
import type { CustomTimePeriod, TimePeriod } from '../../dashboardTypes'
import type { ChartConfig, RWAOverviewChartBreakdown, RWAOverviewChartMetric, RWAOverviewChartView } from '../../types'
import { ChartBuilderTab } from './ChartBuilderTab'
import type { ChartBuilderConfig, ChartModeType, ChartTabType } from './types'
import { UnifiedChartTab } from './UnifiedChartTab'

interface ChartTabProps {
	chartMode: ChartModeType
	onChartModeChange: (mode: ChartModeType) => void
	selectedChartTab: ChartTabType
	selectedChartTypes: string[]
	selectedYieldPool?: { configID: string; name: string; project: string; chain: string } | null
	chainOptions: Array<{ value: string; label: string }>
	protocolOptions: Array<{ value: string; label: string; logo?: string }>
	protocolsLoading: boolean
	unifiedChartName: string
	chartCreationMode: 'separate' | 'combined'
	composerItems: ChartConfig[]
	onChartTabChange: (tab: ChartTabType) => void
	onChartTypesChange: (types: string[]) => void
	onBulkChartTypeChange: (nextType: string) => void
	onSelectedYieldPoolChange?: (pool: { configID: string; name: string; project: string; chain: string } | null) => void
	selectedYieldChains?: string[]
	selectedYieldProjects?: string[]
	selectedYieldCategories?: string[]
	selectedYieldTokens?: string[]
	minTvl?: number | null
	maxTvl?: number | null
	onSelectedYieldChainsChange?: (chains: string[]) => void
	onSelectedYieldProjectsChange?: (projects: string[]) => void
	onSelectedYieldCategoriesChange?: (categories: string[]) => void
	onSelectedYieldTokensChange?: (tokens: string[]) => void
	onMinTvlChange?: (tvl: number | null) => void
	onMaxTvlChange?: (tvl: number | null) => void
	selectedYieldChartType?: string
	onSelectedYieldChartTypeChange?: (chartType: string) => void
	selectedStablecoinChain?: string
	selectedStablecoinChartType?: string
	stablecoinMode?: 'chain' | 'asset'
	selectedStablecoinAsset?: string | null
	selectedStablecoinAssetId?: string | null
	selectedStablecoinAssetChartType?: string
	onSelectedStablecoinChainChange?: (chain: string) => void
	onSelectedStablecoinChartTypeChange?: (chartType: string) => void
	onStablecoinModeChange?: (mode: 'chain' | 'asset') => void
	onSelectedStablecoinAssetChange?: (asset: string | null) => void
	onSelectedStablecoinAssetIdChange?: (id: string | null) => void
	onSelectedStablecoinAssetChartTypeChange?: (chartType: string) => void
	selectedAdvancedTvlProtocol?: string | null
	selectedAdvancedTvlProtocolName?: string | null
	selectedAdvancedTvlChartType?: string
	onSelectedAdvancedTvlProtocolChange?: (protocol: string | null) => void
	onSelectedAdvancedTvlProtocolNameChange?: (name: string | null) => void
	onSelectedAdvancedTvlChartTypeChange?: (chartType: string) => void
	selectedBorrowedProtocol?: string | null
	selectedBorrowedProtocolName?: string | null
	selectedBorrowedChartType?: string
	onSelectedBorrowedProtocolChange?: (protocol: string | null) => void
	onSelectedBorrowedProtocolNameChange?: (name: string | null) => void
	onSelectedBorrowedChartTypeChange?: (chartType: string) => void
	selectedIncomeStatementProtocol?: string | null
	selectedIncomeStatementProtocolName?: string | null
	onSelectedIncomeStatementProtocolChange?: (protocol: string | null) => void
	onSelectedIncomeStatementProtocolNameChange?: (name: string | null) => void
	selectedUnlocksProtocol?: string | null
	selectedUnlocksProtocolName?: string | null
	selectedUnlocksChartType?: 'total' | 'schedule' | 'allocation' | 'locked-unlocked'
	onSelectedUnlocksProtocolChange?: (protocol: string | null) => void
	onSelectedUnlocksProtocolNameChange?: (name: string | null) => void
	onSelectedUnlocksChartTypeChange?: (type: 'total' | 'schedule' | 'allocation' | 'locked-unlocked') => void
	rwaMode?: 'overview' | 'asset'
	selectedRwaChain?: string
	selectedRwaMetric?: RWAOverviewChartMetric
	selectedRwaChartView?: RWAOverviewChartView
	selectedRwaBreakdown?: RWAOverviewChartBreakdown
	selectedRwaTreemapNestedBy?: string
	selectedRwaAssetId?: string | null
	selectedRwaAssetName?: string | null
	selectedRwaAssetMetrics?: RWAOverviewChartMetric[]
	onRwaModeChange?: (mode: 'overview' | 'asset') => void
	onSelectedRwaChainChange?: (chain: string) => void
	onSelectedRwaMetricChange?: (metric: RWAOverviewChartMetric) => void
	onSelectedRwaChartViewChange?: (view: RWAOverviewChartView) => void
	onSelectedRwaBreakdownChange?: (breakdown: RWAOverviewChartBreakdown) => void
	onSelectedRwaTreemapNestedByChange?: (nestedBy: string) => void
	onSelectedRwaAssetIdChange?: (id: string | null) => void
	onSelectedRwaAssetNameChange?: (name: string | null) => void
	onSelectedRwaAssetMetricsChange?: (metrics: RWAOverviewChartMetric[]) => void
	onUnifiedChartNameChange: (name: string) => void
	onChartCreationModeChange: (mode: 'separate' | 'combined') => void
	onComposerItemColorChange: (id: string, color: string) => void
	onAddToComposer: (types?: string[], options?: { entity?: string; mode?: 'chain' | 'protocol' }) => void
	onRemoveFromComposer: (id: string) => void
	chartBuilder: ChartBuilderConfig
	chartBuilderName: string
	onChartBuilderChange: (updates: Partial<ChartBuilderConfig>) => void
	onChartBuilderNameChange: (name: string) => void
	timePeriod: TimePeriod
	customTimePeriod?: CustomTimePeriod | null
}

export function ChartTab(props: ChartTabProps) {
	const { chartMode, onChartModeChange } = props

	return (
		<div className="flex h-full flex-col">
			<div className="mb-3 rounded-xl border border-pro-cards-border p-1 shadow-sm">
				<div className="grid grid-cols-2 gap-1">
					<button
						onClick={() => onChartModeChange('builder')}
						className={`group flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
							chartMode === 'builder'
								? 'bg-pro-accent text-on-brand shadow-md ring-1 ring-black/10'
								: 'text-pro-text-secondary hover:bg-pro-cards-bg/80 hover:text-pro-text-primary hover:shadow-sm'
						}`}
					>
						<Icon
							name="pencil-ruler"
							width={15}
							height={15}
							className={
								chartMode === 'builder' ? 'text-on-brand' : 'text-pro-text-tertiary group-hover:text-pro-text-secondary'
							}
						/>
						<span>Builder</span>
					</button>
					<button
						onClick={() => onChartModeChange('manual')}
						className={`group flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
							chartMode === 'manual'
								? 'bg-pro-accent text-on-brand shadow-md ring-1 ring-black/10'
								: 'text-pro-text-secondary hover:bg-pro-cards-bg/80 hover:text-pro-text-primary hover:shadow-sm'
						}`}
					>
						<Icon
							name="layers"
							width={15}
							height={15}
							className={
								chartMode === 'manual' ? 'text-on-brand' : 'text-pro-text-tertiary group-hover:text-pro-text-secondary'
							}
						/>
						<span>Manual</span>
					</button>
				</div>
			</div>

			{chartMode === 'builder' ? (
				<ChartBuilderTab
					chartBuilder={props.chartBuilder}
					chartBuilderName={props.chartBuilderName}
					chainOptions={props.chainOptions}
					protocolOptions={props.protocolOptions}
					protocolsLoading={props.protocolsLoading}
					onChartBuilderChange={props.onChartBuilderChange}
					onChartBuilderNameChange={props.onChartBuilderNameChange}
					timePeriod={props.timePeriod}
					customTimePeriod={props.customTimePeriod}
				/>
			) : (
				<UnifiedChartTab
					selectedChartTab={props.selectedChartTab}
					selectedChartTypes={props.selectedChartTypes}
					selectedYieldPool={props.selectedYieldPool}
					chainOptions={props.chainOptions}
					protocolOptions={props.protocolOptions}
					protocolsLoading={props.protocolsLoading}
					unifiedChartName={props.unifiedChartName}
					chartCreationMode={props.chartCreationMode}
					composerItems={props.composerItems}
					onChartTabChange={props.onChartTabChange}
					onChartTypesChange={props.onChartTypesChange}
					onBulkChartTypeChange={props.onBulkChartTypeChange}
					onSelectedYieldPoolChange={props.onSelectedYieldPoolChange}
					selectedYieldChains={props.selectedYieldChains}
					selectedYieldProjects={props.selectedYieldProjects}
					selectedYieldCategories={props.selectedYieldCategories}
					selectedYieldTokens={props.selectedYieldTokens}
					minTvl={props.minTvl}
					maxTvl={props.maxTvl}
					onSelectedYieldChainsChange={props.onSelectedYieldChainsChange}
					onSelectedYieldProjectsChange={props.onSelectedYieldProjectsChange}
					onSelectedYieldCategoriesChange={props.onSelectedYieldCategoriesChange}
					onSelectedYieldTokensChange={props.onSelectedYieldTokensChange}
					onMinTvlChange={props.onMinTvlChange}
					onMaxTvlChange={props.onMaxTvlChange}
					selectedYieldChartType={props.selectedYieldChartType}
					onSelectedYieldChartTypeChange={props.onSelectedYieldChartTypeChange}
					selectedStablecoinChain={props.selectedStablecoinChain}
					selectedStablecoinChartType={props.selectedStablecoinChartType}
					stablecoinMode={props.stablecoinMode}
					selectedStablecoinAsset={props.selectedStablecoinAsset}
					selectedStablecoinAssetId={props.selectedStablecoinAssetId}
					selectedStablecoinAssetChartType={props.selectedStablecoinAssetChartType}
					onSelectedStablecoinChainChange={props.onSelectedStablecoinChainChange}
					onSelectedStablecoinChartTypeChange={props.onSelectedStablecoinChartTypeChange}
					onStablecoinModeChange={props.onStablecoinModeChange}
					onSelectedStablecoinAssetChange={props.onSelectedStablecoinAssetChange}
					onSelectedStablecoinAssetIdChange={props.onSelectedStablecoinAssetIdChange}
					onSelectedStablecoinAssetChartTypeChange={props.onSelectedStablecoinAssetChartTypeChange}
					selectedAdvancedTvlProtocol={props.selectedAdvancedTvlProtocol}
					selectedAdvancedTvlProtocolName={props.selectedAdvancedTvlProtocolName}
					selectedAdvancedTvlChartType={props.selectedAdvancedTvlChartType}
					onSelectedAdvancedTvlProtocolChange={props.onSelectedAdvancedTvlProtocolChange}
					onSelectedAdvancedTvlProtocolNameChange={props.onSelectedAdvancedTvlProtocolNameChange}
					onSelectedAdvancedTvlChartTypeChange={props.onSelectedAdvancedTvlChartTypeChange}
					selectedBorrowedProtocol={props.selectedBorrowedProtocol}
					selectedBorrowedProtocolName={props.selectedBorrowedProtocolName}
					selectedBorrowedChartType={props.selectedBorrowedChartType}
					onSelectedBorrowedProtocolChange={props.onSelectedBorrowedProtocolChange}
					onSelectedBorrowedProtocolNameChange={props.onSelectedBorrowedProtocolNameChange}
					onSelectedBorrowedChartTypeChange={props.onSelectedBorrowedChartTypeChange}
					selectedIncomeStatementProtocol={props.selectedIncomeStatementProtocol}
					selectedIncomeStatementProtocolName={props.selectedIncomeStatementProtocolName}
					onSelectedIncomeStatementProtocolChange={props.onSelectedIncomeStatementProtocolChange}
					onSelectedIncomeStatementProtocolNameChange={props.onSelectedIncomeStatementProtocolNameChange}
					selectedUnlocksProtocol={props.selectedUnlocksProtocol}
					selectedUnlocksProtocolName={props.selectedUnlocksProtocolName}
					selectedUnlocksChartType={props.selectedUnlocksChartType}
					onSelectedUnlocksProtocolChange={props.onSelectedUnlocksProtocolChange}
					onSelectedUnlocksProtocolNameChange={props.onSelectedUnlocksProtocolNameChange}
					onSelectedUnlocksChartTypeChange={props.onSelectedUnlocksChartTypeChange}
					rwaMode={props.rwaMode}
					selectedRwaChain={props.selectedRwaChain}
					selectedRwaMetric={props.selectedRwaMetric}
					selectedRwaChartView={props.selectedRwaChartView}
					selectedRwaBreakdown={props.selectedRwaBreakdown}
					selectedRwaTreemapNestedBy={props.selectedRwaTreemapNestedBy}
					selectedRwaAssetId={props.selectedRwaAssetId}
					selectedRwaAssetName={props.selectedRwaAssetName}
					selectedRwaAssetMetrics={props.selectedRwaAssetMetrics}
					onRwaModeChange={props.onRwaModeChange}
					onSelectedRwaChainChange={props.onSelectedRwaChainChange}
					onSelectedRwaMetricChange={props.onSelectedRwaMetricChange}
					onSelectedRwaChartViewChange={props.onSelectedRwaChartViewChange}
					onSelectedRwaBreakdownChange={props.onSelectedRwaBreakdownChange}
					onSelectedRwaTreemapNestedByChange={props.onSelectedRwaTreemapNestedByChange}
					onSelectedRwaAssetIdChange={props.onSelectedRwaAssetIdChange}
					onSelectedRwaAssetNameChange={props.onSelectedRwaAssetNameChange}
					onSelectedRwaAssetMetricsChange={props.onSelectedRwaAssetMetricsChange}
					onUnifiedChartNameChange={props.onUnifiedChartNameChange}
					onChartCreationModeChange={props.onChartCreationModeChange}
					onComposerItemColorChange={props.onComposerItemColorChange}
					onAddToComposer={props.onAddToComposer}
					onRemoveFromComposer={props.onRemoveFromComposer}
				/>
			)}
		</div>
	)
}
