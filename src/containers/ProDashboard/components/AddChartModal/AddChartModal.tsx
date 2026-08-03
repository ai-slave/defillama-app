import * as Ariakit from '@ariakit/react'
import { useIsSqlAllowed } from '../../hooks/useIsSqlAllowed'
import type { VirtualizedSelectOption } from '../AriakitVirtualizedSelect'
import { SqlChartUpsell } from '../SqlChart/SqlChartUpsell'
import { ChartTab } from './ChartTab'
import { LlamaAITab } from './LlamaAITab'
import { MetricTab } from './MetricTab'
import { ModalHeader } from './ModalHeader'
import { SubmitButton } from './SubmitButton'
import { TabNavigation } from './TabNavigation'
import { TextTab } from './TextTab'
import type { AddChartModalProps } from './types'
import { UnifiedTableTab } from './UnifiedTableTab'
import { useComposerItemsData } from './useComposerItemsData'
import { useModalActions } from './useModalActions'

const EMPTY_CHAIN_OPTIONS: VirtualizedSelectOption[] = []
export function AddChartModal({
	isOpen,
	onClose,
	editItem,
	initialUnifiedFocusSection,
	onOpenSqlModal
}: AddChartModalProps) {
	const { state, actions, computed } = useModalActions(editItem, onClose)
	const { isAllowed: isSqlAllowed } = useIsSqlAllowed()
	const handleTabChange: typeof actions.handleMainTabChange = (tab) => {
		if (tab === 'sql' && isSqlAllowed && onOpenSqlModal) {
			onOpenSqlModal()
			return
		}
		actions.handleMainTabChange(tab)
	}

	const composerItemsWithData = useComposerItemsData(state.composerItems, computed.timePeriod)

	const handleMetricChainChange = (opt: { value: string; label: string }) => actions.setMetricChain(opt?.value ?? null)
	const handleMetricProtocolChange = (opt: { value: string; label: string }) =>
		actions.setMetricProtocol(opt?.value ?? null)
	const handleYieldChartTypeChange = (chartType: string) => {
		switch (chartType) {
			case 'tvl-apy':
			case 'supply-apy':
			case 'supply-apy-7d':
			case 'borrow-apy':
			case 'net-borrow-apy':
			case 'pool-liquidity':
				return actions.setSelectedYieldChartType(chartType)
			default:
				throw new Error(`Unsupported yield chart type: ${chartType}`)
		}
	}
	const handleStablecoinChartTypeChange = (chartType: string) => {
		switch (chartType) {
			case 'totalMcap':
			case 'tokenMcaps':
			case 'pie':
			case 'dominance':
			case 'usdInflows':
			case 'tokenInflows':
				return actions.setSelectedStablecoinChartType(chartType)
			default:
				throw new Error(`Unsupported stablecoin chart type: ${chartType}`)
		}
	}
	const handleStablecoinAssetChartTypeChange = (chartType: string) => {
		switch (chartType) {
			case 'totalCirc':
			case 'chainMcaps':
			case 'chainPie':
			case 'chainDominance':
				return actions.setSelectedStablecoinAssetChartType(chartType)
			default:
				throw new Error(`Unsupported stablecoin asset chart type: ${chartType}`)
		}
	}
	const handleAdvancedTvlChartTypeChange = (chartType: string) => {
		switch (chartType) {
			case 'tvl':
			case 'chainsTvl':
			case 'tokenValuesUsd':
			case 'tokensPie':
			case 'tokenBalances':
			case 'usdInflows':
			case 'tokenInflows':
				return actions.setSelectedAdvancedTvlChartType(chartType)
			default:
				throw new Error(`Unsupported advanced TVL chart type: ${chartType}`)
		}
	}
	const handleBorrowedChartTypeChange = (chartType: string) => {
		switch (chartType) {
			case 'chainsBorrowed':
			case 'tokenBorrowedUsd':
			case 'tokensBorrowedPie':
			case 'tokenBorrowedRaw':
				return actions.setSelectedBorrowedChartType(chartType)
			default:
				throw new Error(`Unsupported borrowed chart type: ${chartType}`)
		}
	}

	return (
		<Ariakit.DialogProvider
			open={isOpen}
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<Ariakit.Dialog
				className="add-chart-dialog fixed top-0 right-0 bottom-0 z-50 flex h-full w-full max-w-6xl animate-slidein flex-col gap-3 overflow-hidden border-l pro-dashboard border-pro-cards-border bg-pro-cards-bg p-3 shadow-xl md:p-4"
				unmountOnHide
				portal
			>
				<ModalHeader editItem={editItem} />

				<TabNavigation
					selectedMainTab={state.selectedMainTab}
					editItem={editItem}
					onTabChange={handleTabChange}
					isSqlAllowed={isSqlAllowed}
				/>

				<div className="-mx-4 flex flex-1 flex-col overflow-y-auto px-4 md:mx-0 md:px-0">
					{state.selectedMainTab === 'charts' ? (
						<ChartTab
							chartMode={state.chartMode}
							onChartModeChange={actions.setChartMode}
							selectedChartTab={state.selectedChartTab}
							selectedChartTypes={state.selectedChartTypes}
							selectedYieldPool={state.selectedYieldPool}
							chainOptions={computed.chainOptions}
							protocolOptions={computed.protocolOptions}
							protocolsLoading={computed.protocolsLoading}
							unifiedChartName={state.unifiedChartName}
							chartCreationMode={state.chartCreationMode}
							composerItems={composerItemsWithData}
							onChartTabChange={actions.handleChartTabChange}
							onChartTypesChange={actions.setSelectedChartTypes}
							onBulkChartTypeChange={actions.handleBulkChartTypeChange}
							onSelectedYieldPoolChange={actions.setSelectedYieldPool}
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
							selectedYieldChartType={state.selectedYieldChartType}
							onSelectedYieldChartTypeChange={handleYieldChartTypeChange}
							selectedStablecoinChain={state.selectedStablecoinChain}
							selectedStablecoinChartType={state.selectedStablecoinChartType}
							stablecoinMode={state.stablecoinMode}
							selectedStablecoinAsset={state.selectedStablecoinAsset}
							selectedStablecoinAssetId={state.selectedStablecoinAssetId}
							selectedStablecoinAssetChartType={state.selectedStablecoinAssetChartType}
							onSelectedStablecoinChainChange={actions.setSelectedStablecoinChain}
							onSelectedStablecoinChartTypeChange={handleStablecoinChartTypeChange}
							onStablecoinModeChange={actions.setStablecoinMode}
							onSelectedStablecoinAssetChange={actions.setSelectedStablecoinAsset}
							onSelectedStablecoinAssetIdChange={actions.setSelectedStablecoinAssetId}
							onSelectedStablecoinAssetChartTypeChange={handleStablecoinAssetChartTypeChange}
							selectedAdvancedTvlProtocol={state.selectedAdvancedTvlProtocol}
							selectedAdvancedTvlProtocolName={state.selectedAdvancedTvlProtocolName}
							selectedAdvancedTvlChartType={state.selectedAdvancedTvlChartType}
							onSelectedAdvancedTvlProtocolChange={actions.setSelectedAdvancedTvlProtocol}
							onSelectedAdvancedTvlProtocolNameChange={actions.setSelectedAdvancedTvlProtocolName}
							onSelectedAdvancedTvlChartTypeChange={handleAdvancedTvlChartTypeChange}
							selectedBorrowedProtocol={state.selectedBorrowedProtocol}
							selectedBorrowedProtocolName={state.selectedBorrowedProtocolName}
							selectedBorrowedChartType={state.selectedBorrowedChartType}
							onSelectedBorrowedProtocolChange={actions.setSelectedBorrowedProtocol}
							onSelectedBorrowedProtocolNameChange={actions.setSelectedBorrowedProtocolName}
							onSelectedBorrowedChartTypeChange={handleBorrowedChartTypeChange}
							selectedIncomeStatementProtocol={state.selectedIncomeStatementProtocol}
							selectedIncomeStatementProtocolName={state.selectedIncomeStatementProtocolName}
							onSelectedIncomeStatementProtocolChange={actions.setSelectedIncomeStatementProtocol}
							onSelectedIncomeStatementProtocolNameChange={actions.setSelectedIncomeStatementProtocolName}
							selectedUnlocksProtocol={state.selectedUnlocksProtocol}
							selectedUnlocksProtocolName={state.selectedUnlocksProtocolName}
							selectedUnlocksChartType={state.selectedUnlocksChartType}
							onSelectedUnlocksProtocolChange={actions.setSelectedUnlocksProtocol}
							onSelectedUnlocksProtocolNameChange={actions.setSelectedUnlocksProtocolName}
							onSelectedUnlocksChartTypeChange={actions.setSelectedUnlocksChartType}
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
							onUnifiedChartNameChange={actions.setUnifiedChartName}
							onChartCreationModeChange={actions.setChartCreationMode}
							onComposerItemColorChange={actions.handleUpdateComposerItemColor}
							onAddToComposer={actions.handleAddToComposer}
							onRemoveFromComposer={actions.handleRemoveFromComposer}
							chartBuilder={state.chartBuilder}
							chartBuilderName={state.chartBuilderName}
							onChartBuilderChange={actions.updateChartBuilder}
							onChartBuilderNameChange={actions.setChartBuilderName}
							timePeriod={computed.timePeriod}
							customTimePeriod={computed.customTimePeriod}
						/>
					) : null}

					{state.selectedMainTab === 'metric' ? (
						<MetricTab
							metricSubjectType={state.metricSubjectType}
							metricChain={state.metricChain}
							metricProtocol={state.metricProtocol}
							metricType={state.metricType}
							metricAggregator={state.metricAggregator}
							metricWindow={state.metricWindow}
							metricLabel={state.metricLabel}
							metricChartType={state.metricChartType}
							onSubjectTypeChange={actions.setMetricSubjectType}
							onChainChange={handleMetricChainChange}
							onProtocolChange={handleMetricProtocolChange}
							onTypeChange={actions.setMetricType}
							onAggregatorChange={actions.setMetricAggregator}
							onWindowChange={actions.setMetricWindow}
							onLabelChange={actions.setMetricLabel}
							onChartTypeChange={actions.setMetricChartType}
						/>
					) : null}

					{state.selectedMainTab === 'table' ? (
						<UnifiedTableTab
							onClose={onClose}
							chainOptions={computed.chainOptions ?? EMPTY_CHAIN_OPTIONS}
							editItem={editItem?.kind === 'unified-table' ? editItem : undefined}
							initialFocusSection={editItem?.kind === 'unified-table' ? initialUnifiedFocusSection : undefined}
							selectedTableType={state.selectedTableType}
							onTableTypeChange={actions.setSelectedTableType}
							selectedChains={state.selectedChains}
							onChainsChange={actions.handleChainsChange}
							selectedDatasetChain={state.selectedDatasetChain}
							onDatasetChainChange={actions.handleDatasetChainChange}
							selectedCexAnalyticsView={state.selectedCexAnalyticsView}
							onCexAnalyticsViewChange={actions.setSelectedCexAnalyticsView}
							selectedCexAnalyticsMetric={state.selectedCexAnalyticsMetric}
							onCexAnalyticsMetricChange={actions.setSelectedCexAnalyticsMetric}
							selectedCexAnalyticsTopN={state.selectedCexAnalyticsTopN}
							onCexAnalyticsTopNChange={actions.setSelectedCexAnalyticsTopN}
							selectedTokens={state.selectedTokens}
							onTokensChange={actions.handleTokensChange}
							includeCex={state.includeCex}
							onIncludeCexChange={actions.setIncludeCex}
							protocolsLoading={computed.protocolsLoading}
							isEditingItem={Boolean(editItem)}
						/>
					) : null}

					{state.selectedMainTab === 'text' ? (
						<TextTab
							textTitle={state.textTitle}
							textContent={state.textContent}
							onTextTitleChange={actions.setTextTitle}
							onTextContentChange={actions.setTextContent}
						/>
					) : null}

					{state.selectedMainTab === 'llamaai' ? (
						<LlamaAITab selectedChart={state.selectedLlamaAIChart} onChartSelect={actions.setSelectedLlamaAIChart} />
					) : null}

					{state.selectedMainTab === 'sql' ? <SqlChartUpsell /> : null}
				</div>

				{(state.selectedMainTab !== 'table' || state.selectedTableType !== 'protocols') &&
				state.selectedMainTab !== 'sql' ? (
					<div className="shrink-0">
						<SubmitButton
							editItem={editItem}
							selectedMainTab={state.selectedMainTab}
							selectedChartTab={state.selectedChartTab}
							selectedChain={state.selectedChain}
							selectedChains={state.selectedChains}
							selectedProtocol={state.selectedProtocol}
							selectedChartTypes={state.selectedChartTypes}
							selectedYieldPool={state.selectedYieldPool}
							composerItems={state.composerItems}
							textContent={state.textContent}
							selectedTableType={state.selectedTableType}
							selectedDatasetChain={state.selectedDatasetChain}
							selectedTokens={state.selectedTokens}
							chartBuilder={state.chartBuilder}
							chartCreationMode={state.chartCreationMode}
							chartMode={state.chartMode}
							metricSubjectType={state.metricSubjectType}
							metricChain={state.metricChain}
							metricProtocol={state.metricProtocol}
							metricType={state.metricType}
							selectedStablecoinChain={state.selectedStablecoinChain}
							selectedStablecoinChartType={state.selectedStablecoinChartType}
							stablecoinMode={state.stablecoinMode}
							selectedStablecoinAsset={state.selectedStablecoinAsset}
							selectedStablecoinAssetId={state.selectedStablecoinAssetId}
							selectedStablecoinAssetChartType={state.selectedStablecoinAssetChartType}
							selectedAdvancedTvlProtocol={state.selectedAdvancedTvlProtocol}
							selectedAdvancedTvlChartType={state.selectedAdvancedTvlChartType}
							selectedBorrowedProtocol={state.selectedBorrowedProtocol}
							selectedBorrowedChartType={state.selectedBorrowedChartType}
							selectedIncomeStatementProtocol={state.selectedIncomeStatementProtocol}
							selectedLlamaAIChart={state.selectedLlamaAIChart}
							selectedUnlocksProtocol={state.selectedUnlocksProtocol}
							selectedUnlocksChartType={state.selectedUnlocksChartType}
							rwaMode={state.rwaMode}
							selectedRwaAssetId={state.selectedRwaAssetId}
							selectedRwaAssetMetrics={state.selectedRwaAssetMetrics}
							onSubmit={actions.handleSubmit}
						/>
					</div>
				) : null}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
