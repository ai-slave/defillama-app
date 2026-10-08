import { AdvancedTvlChartTab } from './AdvancedTvlChartTab'
import { BorrowedChartTab } from './BorrowedChartTab'
import { IncomeStatementChartTab } from './IncomeStatementChartTab'
import { RWAChartTab } from './RWAChartTab'
import { StablecoinsChartTab } from './StablecoinsChartTab'
import type { ModalState } from './types'
import { UnlocksChartTab } from './UnlocksChartTab'
import type { ModalActions } from './useModalActions'
import { YieldsChartTab } from './YieldsChartTab'

interface CategoryChartFormProps {
	state: ModalState
	actions: ModalActions
	protocolOptions: Array<{ value: string; label: string; logo?: string }>
	protocolsLoading: boolean
	/** What Add still needs, shown under the control that needs it once Add was pressed. */
	error: string | null
}

/** The form of a single-card category, which saves from its own selection rather than the series composer. Chains
    and protocols have no form here: they compose series. */
export function CategoryChartForm({
	state,
	actions,
	protocolOptions,
	protocolsLoading,
	error
}: CategoryChartFormProps) {
	switch (state.selectedChartTab) {
		case 'chain':
		case 'protocol':
			return null
		case 'yields':
			return (
				<YieldsChartTab
					error={error}
					selectedYieldPool={state.selectedYieldPool}
					onSelectedYieldPoolChange={actions.setSelectedYieldPool}
					selectedYieldChartType={state.selectedYieldChartType}
					onSelectedYieldChartTypeChange={actions.setSelectedYieldChartType}
					selectedYieldChains={state.selectedYieldChains}
					selectedYieldProjects={state.selectedYieldProjects}
					selectedYieldCategories={state.selectedYieldCategories}
					selectedYieldTokens={state.selectedYieldTokens}
					minTvl={state.minTvl}
					maxTvl={state.maxTvl}
					onSelectedYieldChainsChange={actions.setSelectedYieldChains}
					onSelectedYieldProjectsChange={actions.setSelectedYieldProjects}
					onSelectedYieldCategoriesChange={actions.setSelectedYieldCategories}
					onSelectedYieldTokensChange={actions.setSelectedYieldTokens}
					onMinTvlChange={actions.setMinTvl}
					onMaxTvlChange={actions.setMaxTvl}
				/>
			)
		case 'stablecoins':
			return (
				<StablecoinsChartTab
					error={error}
					selectedStablecoinChain={state.selectedStablecoinChain}
					selectedStablecoinChartType={state.selectedStablecoinChartType}
					stablecoinMode={state.stablecoinMode}
					selectedStablecoinAsset={state.selectedStablecoinAsset}
					selectedStablecoinAssetId={state.selectedStablecoinAssetId}
					selectedStablecoinAssetChartType={state.selectedStablecoinAssetChartType}
					onSelectedStablecoinChainChange={actions.setSelectedStablecoinChain}
					onSelectedStablecoinChartTypeChange={actions.setSelectedStablecoinChartType}
					onStablecoinModeChange={actions.setStablecoinMode}
					onSelectedStablecoinAssetChange={actions.setSelectedStablecoinAsset}
					onSelectedStablecoinAssetIdChange={actions.setSelectedStablecoinAssetId}
					onSelectedStablecoinAssetChartTypeChange={actions.setSelectedStablecoinAssetChartType}
				/>
			)
		case 'rwa':
			return (
				<RWAChartTab
					error={error}
					rwaMode={state.rwaMode}
					selectedRwaChain={state.selectedRwaChain}
					selectedRwaMetric={state.selectedRwaMetric}
					selectedRwaChartView={state.selectedRwaChartView}
					selectedRwaBreakdown={state.selectedRwaBreakdown}
					selectedRwaTreemapNestedBy={state.selectedRwaTreemapNestedBy}
					selectedRwaAssetId={state.selectedRwaAssetId}
					selectedRwaAssetName={state.selectedRwaAssetName}
					selectedRwaAssetMetrics={state.selectedRwaAssetMetrics}
					onRwaModeChange={actions.setRwaMode}
					onSelectedRwaChainChange={actions.setSelectedRwaChain}
					onSelectedRwaMetricChange={actions.setSelectedRwaMetric}
					onSelectedRwaChartViewChange={actions.setSelectedRwaChartView}
					onSelectedRwaBreakdownChange={actions.setSelectedRwaBreakdown}
					onSelectedRwaTreemapNestedByChange={actions.setSelectedRwaTreemapNestedBy}
					onSelectedRwaAssetIdChange={actions.setSelectedRwaAssetId}
					onSelectedRwaAssetNameChange={actions.setSelectedRwaAssetName}
					onSelectedRwaAssetMetricsChange={actions.setSelectedRwaAssetMetrics}
				/>
			)
		case 'advanced-tvl':
			return (
				<AdvancedTvlChartTab
					error={error}
					selectedAdvancedTvlProtocol={state.selectedAdvancedTvlProtocol}
					selectedAdvancedTvlProtocolName={state.selectedAdvancedTvlProtocolName}
					selectedAdvancedTvlChartType={state.selectedAdvancedTvlChartType}
					onSelectedAdvancedTvlProtocolChange={actions.setSelectedAdvancedTvlProtocol}
					onSelectedAdvancedTvlProtocolNameChange={actions.setSelectedAdvancedTvlProtocolName}
					onSelectedAdvancedTvlChartTypeChange={actions.setSelectedAdvancedTvlChartType}
					protocolOptions={protocolOptions}
					protocolsLoading={protocolsLoading}
				/>
			)
		case 'borrowed':
			return (
				<BorrowedChartTab
					error={error}
					selectedBorrowedProtocol={state.selectedBorrowedProtocol}
					selectedBorrowedProtocolName={state.selectedBorrowedProtocolName}
					selectedBorrowedChartType={state.selectedBorrowedChartType}
					onSelectedBorrowedProtocolChange={actions.setSelectedBorrowedProtocol}
					onSelectedBorrowedProtocolNameChange={actions.setSelectedBorrowedProtocolName}
					onSelectedBorrowedChartTypeChange={actions.setSelectedBorrowedChartType}
					protocolOptions={protocolOptions}
					protocolsLoading={protocolsLoading}
				/>
			)
		case 'income-statement':
			return (
				<IncomeStatementChartTab
					error={error}
					selectedIncomeStatementProtocol={state.selectedIncomeStatementProtocol}
					selectedIncomeStatementProtocolName={state.selectedIncomeStatementProtocolName}
					onSelectedIncomeStatementProtocolChange={actions.setSelectedIncomeStatementProtocol}
					onSelectedIncomeStatementProtocolNameChange={actions.setSelectedIncomeStatementProtocolName}
					protocolOptions={protocolOptions}
					protocolsLoading={protocolsLoading}
				/>
			)
		case 'unlocks':
			return (
				<UnlocksChartTab
					error={error}
					selectedUnlocksProtocol={state.selectedUnlocksProtocol}
					selectedUnlocksProtocolName={state.selectedUnlocksProtocolName}
					selectedUnlocksChartType={state.selectedUnlocksChartType}
					onSelectedUnlocksProtocolChange={actions.setSelectedUnlocksProtocol}
					onSelectedUnlocksProtocolNameChange={actions.setSelectedUnlocksProtocolName}
					onSelectedUnlocksChartTypeChange={actions.setSelectedUnlocksChartType}
					protocolOptions={protocolOptions}
					protocolsLoading={protocolsLoading}
				/>
			)
	}
}
