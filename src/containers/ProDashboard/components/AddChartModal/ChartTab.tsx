import { Icon } from '~/ui/Icon'
import type { ChartRuntimeView } from '../../chartRuntime'
import type { CustomTimePeriod, TimePeriod } from '../../dashboardTypes'
import type { RWAOverviewChartBreakdown, RWAOverviewChartMetric, RWAOverviewChartView } from '../../types'
import { ChartBuilderTab } from './ChartBuilderTab'
import type { ChartBuilderConfig, ChartBuilderUpdate, ChartModeType, ChartTabType } from './types'
import { UnifiedChartTab } from './UnifiedChartTab'

interface ChartTabProps {
	chartMode: ChartModeType
	onChartModeChange: (mode: ChartModeType) => void
	selectedChartTab: ChartTabType
	selectedChartTypes: Array<string>
	selectedYieldPool?: {
		configID: string
		name: string
		project: string
		chain: string
	} | null
	chainOptions: Array<{ value: string; label: string }>
	protocolOptions: Array<{ value: string; label: string; logo?: string }>
	protocolsLoading: boolean
	unifiedChartName: string
	chartCreationMode: 'separate' | 'combined'
	composerItems: Array<ChartRuntimeView>
	onChartTabChange: (tab: ChartTabType) => void
	onChartTypesChange: (types: Array<string>) => void
	onBulkChartTypeChange: (nextType: string) => void
	onSelectedYieldPoolChange?: (
		pool: {
			configID: string
			name: string
			project: string
			chain: string
		} | null
	) => void
	selectedYieldChains?: Array<string>
	selectedYieldProjects?: Array<string>
	selectedYieldCategories?: Array<string>
	selectedYieldTokens?: Array<string>
	minTvl?: number | null
	maxTvl?: number | null
	onSelectedYieldChainsChange?: (chains: Array<string>) => void
	onSelectedYieldProjectsChange?: (projects: Array<string>) => void
	onSelectedYieldCategoriesChange?: (categories: Array<string>) => void
	onSelectedYieldTokensChange?: (tokens: Array<string>) => void
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
	selectedRwaAssetMetrics?: Array<RWAOverviewChartMetric>
	onRwaModeChange?: (mode: 'overview' | 'asset') => void
	onSelectedRwaChainChange?: (chain: string) => void
	onSelectedRwaMetricChange?: (metric: RWAOverviewChartMetric) => void
	onSelectedRwaChartViewChange?: (view: RWAOverviewChartView) => void
	onSelectedRwaBreakdownChange?: (breakdown: RWAOverviewChartBreakdown) => void
	onSelectedRwaTreemapNestedByChange?: (nestedBy: string) => void
	onSelectedRwaAssetIdChange?: (id: string | null) => void
	onSelectedRwaAssetNameChange?: (name: string | null) => void
	onSelectedRwaAssetMetricsChange?: (metrics: Array<RWAOverviewChartMetric>) => void
	onUnifiedChartNameChange: (name: string) => void
	onChartCreationModeChange: (mode: 'separate' | 'combined') => void
	onComposerItemColorChange: (id: string, color: string) => void
	onAddToComposer: (types?: Array<string>, options?: { entity?: string; mode?: 'chain' | 'protocol' }) => void
	onRemoveFromComposer: (id: string) => void
	chartBuilder: ChartBuilderConfig
	chartBuilderName: string
	onChartBuilderChange: (updates: ChartBuilderUpdate) => void
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
						type="button"
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
						type="button"
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
					{...(props.customTimePeriod === undefined ? {} : { customTimePeriod: props.customTimePeriod })}
				/>
			) : (
				<UnifiedChartTab {...props} />
			)}
		</div>
	)
}
