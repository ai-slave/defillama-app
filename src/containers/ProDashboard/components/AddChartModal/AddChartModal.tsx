import * as Ariakit from '@ariakit/react'
import { useEffect, useMemo, useRef } from 'react'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { useIsSqlAllowed } from '../../hooks/useIsSqlAllowed'
import type { VirtualizedSelectOption } from '../AriakitVirtualizedSelect'
import { getComposerGrouping } from '../multiChartSeries'
import { SqlChartUpsell } from '../SqlChart/SqlChartUpsell'
import { ModalBindingsProvider } from './bindingContext'
import { ChartTab } from './ChartTab'
import { CustomDataTab } from './CustomDataTab'
import { LlamaAITab } from './LlamaAITab'
import { MetricTab } from './MetricTab'
import { ModalHeader } from './ModalHeader'
import { SqlHandoffPanel } from './SqlHandoffPanel'
import { SubmitButton } from './SubmitButton'
import { MAIN_TAB_VALUES, TabNavigation } from './TabNavigation'
import { TextTab } from './TextTab'
import type { AddChartModalProps } from './types'
import { UnifiedTableTab } from './UnifiedTableTab'
import { useComposerItemsData } from './useComposerItemsData'
import { useModalActions } from './useModalActions'

const EMPTY_CHAIN_OPTIONS: Array<VirtualizedSelectOption> = []
export function AddChartModal({
	isOpen,
	onClose,
	onClosed,
	editItem,
	draftItem,
	initialUnifiedFocusSection,
	onOpenSqlModal,
	placement
}: AddChartModalProps) {
	const dialogStore = Ariakit.useDialogStore({
		open: isOpen,
		setOpen: (open) => {
			if (!open) onClose()
		}
	})
	const isMounted = Ariakit.useStoreState(dialogStore, 'mounted')
	const wasMountedRef = useRef(false)
	useEffect(() => {
		if (isMounted) {
			wasMountedRef.current = true
			return
		}
		if (!wasMountedRef.current) return
		wasMountedRef.current = false
		onClosed?.()
	}, [isMounted, onClosed])
	const { state, actions, computed } = useModalActions(editItem, onClose, placement, draftItem)
	const { isAllowed: isSqlAllowed, isUnknown: isSqlAccessUnknown, isRetrying, retry } = useIsSqlAllowed()

	// A combined preview loads every series at one grouping, as the saved chart will.
	const previewItems = useMemo(() => {
		if (state.chartCreationMode !== 'combined') return state.composerItems
		const grouping = getComposerGrouping(state.composerItems)
		return state.composerItems.map((item) => ({ ...item, grouping }))
	}, [state.chartCreationMode, state.composerItems])
	const composerItemsWithData = useComposerItemsData(previewItems, computed.timePeriod)

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
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				className="add-chart-dialog fixed top-0 right-0 bottom-0 z-50 flex h-full w-full max-w-6xl translate-x-full flex-col gap-3 overflow-hidden border-l border-pro-cards-border bg-pro-cards-bg p-3 opacity-0 shadow-dialog transition-[opacity,translate] duration-260 ease-out-quart pro-dashboard data-enter:translate-x-0 data-enter:opacity-100 data-leave:duration-200 md:p-4"
				unmountOnHide
				portal
			>
				<ModalBindingsProvider bindings={state.bindings} setBinding={actions.setItemBinding}>
					<Tabs value={state.selectedMainTab} values={MAIN_TAB_VALUES} onValueChange={actions.handleMainTabChange}>
						<ModalHeader editItem={editItem} selectedMainTab={state.selectedMainTab} />
						<TabNavigation editItem={editItem} isSqlAllowed={isSqlAllowed} />

						<TabPanel
							value={state.selectedMainTab}
							className="-mx-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-3 md:mx-0 md:px-0"
						>
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
									manualFormOpen={state.manualFormOpen}
									isEditingItem={Boolean(editItem)}
									onSelectCategory={actions.handleSelectChartCategory}
									onBackToCategories={actions.handleBackToChartCategories}
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

							{state.selectedMainTab === 'custom-data' ? (
								<CustomDataTab
									customData={state.customData}
									onNameChange={actions.setCustomDataName}
									onTextChange={actions.setCustomDataText}
									onParsed={actions.setCustomDataParsed}
									onStoredRowsChange={actions.setCustomDataStoredRows}
									onError={actions.setCustomDataError}
									onChartChange={actions.setCustomDataChart}
									onDisplayModeChange={actions.setCustomDataDisplayMode}
								/>
							) : null}

							{state.selectedMainTab === 'llamaai' ? (
								<LlamaAITab
									selectedChart={state.selectedLlamaAIChart}
									onChartSelect={actions.setSelectedLlamaAIChart}
								/>
							) : null}

							{state.selectedMainTab === 'sql' ? (
								isSqlAccessUnknown ? (
									<div className="mx-auto w-full max-w-md py-8">
										<SubscriptionLoadError isRetrying={isRetrying} onRetry={retry} />
									</div>
								) : !isSqlAllowed || !onOpenSqlModal ? (
									<SqlChartUpsell />
								) : (
									<div className="w-full py-8">
										<SqlHandoffPanel onOpenSqlEditor={onOpenSqlModal} />
									</div>
								)
							) : null}
						</TabPanel>

						{(state.selectedMainTab !== 'table' || state.selectedTableType !== 'protocols') &&
						state.selectedMainTab !== 'sql' ? (
							<div className="shrink-0">
								<SubmitButton editItem={editItem} state={state} onSubmit={actions.handleSubmit} />
							</div>
						) : null}
					</Tabs>
				</ModalBindingsProvider>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
