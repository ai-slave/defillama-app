import { type MouseEvent, useMemo, useState } from 'react'
import type { VirtualizedSelectOption } from '~/components/Select/VirtualizedSelect'
import { Dialog, DialogDiscardGuard, DialogHeader } from '~/ui/Dialog'
import { showFieldErrors } from '~/ui/focus'
import { InlineStatus } from '~/ui/Status'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { queryReadFailed } from '~/utils/query'
import { useIsSqlAllowed } from '../../hooks/useIsSqlAllowed'
import { useYieldsData } from '../datasets/YieldsDataset/useYieldsData'
import { getComposerGrouping } from '../multiChartSeries'
import { SqlChartUpsell } from '../SqlChart/SqlChartUpsell'
import { ModalBindingsProvider } from './bindingContext'
import { ChartTab } from './ChartTab'
import { CustomDataTab } from './CustomDataTab'
import { LlamaAITab } from './LlamaAITab'
import { MetricTab } from './MetricTab'
import { hasDraftChanges } from './modalReducer'
import type { AddCardPane } from './panes'
import { SqlHandoffPanel } from './SqlHandoffPanel'
import { resolvePickListLoad, resolveSubmitError } from './submitBlocker'
import { SubmitButton } from './SubmitButton'
import { getMainTabEditLabel, MAIN_TAB_VALUES, TabNavigation } from './TabNavigation'
import { TextTab } from './TextTab'
import type { AddChartModalProps } from './types'
import { UnifiedTableTab } from './UnifiedTableTab'
import { tableDraftKey, useUnifiedTableWizard } from './UnifiedTableTab/hooks/useUnifiedTableWizard'
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
	placement,
	finalFocus
}: AddChartModalProps) {
	const { state, actions, computed, submitError } = useModalActions(editItem, onClose, placement, draftItem)
	const { isAllowed: isSqlAllowed, isUnknown: isSqlAccessUnknown, isRetrying, retry } = useIsSqlAllowed()

	const unifiedEditItem = editItem?.kind === 'unified-table' ? editItem : undefined
	const tableWizard = useUnifiedTableWizard(unifiedEditItem)

	// Leaving asks first when it would lose work entered in any tab, the protocols table's included; browsing tabs,
	// modes and categories never asks.
	const [opened] = useState(() => ({ state, table: tableDraftKey(tableWizard.state) }))
	const dirty = hasDraftChanges(state, opened.state) || tableDraftKey(tableWizard.state) !== opened.table
	// The protocols table wizard lays out its own scrolling body and footer.
	const tableWizardOpen = state.selectedMainTab === 'table' && state.selectedTableType === 'protocols'

	// A combined preview loads every series at one grouping, as the saved chart will.
	const previewItems = useMemo(() => {
		if (state.chartCreationMode !== 'combined') return state.composerItems
		const grouping = getComposerGrouping(state.composerItems)
		return state.composerItems.map((item) => ({ ...item, grouping }))
	}, [state.chartCreationMode, state.composerItems])
	const composerItemsWithData = useComposerItemsData(previewItems, computed.timePeriod)

	// Each tab and form checks its own input: an error shows once Add was pressed on the form it belongs to, and
	// moving to another form starts that one quiet.
	const formKey = `${state.selectedMainTab}:${state.chartMode}:${state.selectedChartTab}:${state.selectedTableType}`
	const [submittedForm, setSubmittedForm] = useState<string | null>(null)
	const inputError = resolveSubmitError(state, editItem)
	const shownError = submittedForm === formKey ? inputError : null
	// Below lg a form shows its configure or its preview pane, and each form opens on configure. showFieldErrors skips
	// a hidden pane, so a failed Add brings back the pane holding the error: the composer's layout toggle for keeping
	// one series (preview), every other error (configure).
	const [paneOf, setPaneOf] = useState<{ form: string; pane: AddCardPane }>({ form: formKey, pane: 'configure' })
	const pane = paneOf.form === formKey ? paneOf.pane : 'configure'
	const setPane = (next: AddCardPane) => setPaneOf({ form: formKey, pane: next })
	const errorPane: AddCardPane =
		state.selectedMainTab === 'charts' && state.chartMode === 'manual' && state.composerItems.length > 0
			? 'preview'
			: 'configure'
	// The yield pool list belongs to its form; read here too (one shared query) so Add waits while it loads.
	const { query: yieldPools, isLoading: yieldPoolsLoading } = useYieldsData(
		[],
		state.selectedMainTab === 'charts' &&
			state.chartMode === 'manual' &&
			state.manualFormOpen &&
			state.selectedChartTab === 'yields'
	)
	const pickList = resolvePickListLoad(state, {
		protocolsLoading: computed.protocolsLoading,
		yieldPools: queryReadFailed(yieldPools) ? 'failed' : yieldPoolsLoading ? 'loading' : null
	})
	// The dialog is the scope showFieldErrors searches. The tabs sit in no form, so Enter in a tab's search or name
	// field never adds the card.
	const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
		if (inputError)
			return showFieldErrors(event.currentTarget.closest<HTMLElement>('[data-dialog]')!, () => {
				setSubmittedForm(formKey)
				setPane(errorPane)
			})
		actions.handleSubmit()
	}

	const handleMetricChainChange = (opt: { value: string; label: string }) => actions.setMetricChain(opt?.value ?? null)
	const handleMetricProtocolChange = (opt: { value: string; label: string }) =>
		actions.setMetricProtocol(opt?.value ?? null)
	return (
		// An outside tap never drops the card; Cancel, × and Escape ask first once there is work to lose.
		<Dialog
			size="xl"
			workspace
			open={isOpen}
			onClose={onClose}
			{...(onClosed ? { onClosed } : {})}
			{...(finalFocus ? { finalFocus } : {})}
			unmountOnHide
			portal
			hideOnInteractOutside={false}
		>
			<DialogDiscardGuard
				when={dirty}
				title={editItem ? 'Discard your changes?' : 'Discard this card?'}
				description={
					editItem ? 'Your edits to this card are not saved.' : 'The card you set up is not added to the dashboard.'
				}
			/>
			<ModalBindingsProvider bindings={state.bindings} setBinding={actions.setItemBinding}>
				<Tabs value={state.selectedMainTab} values={MAIN_TAB_VALUES} onValueChange={actions.handleMainTabChange}>
					<DialogHeader title={editItem ? `Edit card · ${getMainTabEditLabel(state.selectedMainTab)}` : 'Add card'} />
					{editItem ? null : <TabNavigation isSqlAllowed={isSqlAllowed} />}
					<TabPanel
						value={state.selectedMainTab}
						className={`flex min-h-0 min-w-0 flex-1 flex-col ${tableWizardOpen ? '' : 'overflow-y-auto p-4'}`}
					>
						{state.selectedMainTab === 'charts' ? (
							<ChartTab
								state={state}
								actions={actions}
								computed={computed}
								composerItems={composerItemsWithData}
								isEditingItem={Boolean(editItem)}
								error={shownError}
								pane={pane}
								onPaneChange={setPane}
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
								error={shownError}
								pane={pane}
								onPaneChange={setPane}
							/>
						) : null}

						{state.selectedMainTab === 'table' ? (
							<UnifiedTableTab
								wizard={tableWizard}
								placement={placement}
								onClose={onClose}
								chainOptions={computed.chainOptions ?? EMPTY_CHAIN_OPTIONS}
								editItem={editItem}
								initialFocusSection={unifiedEditItem ? initialUnifiedFocusSection : undefined}
								selectedTableType={state.selectedTableType}
								onTableTypeChange={actions.setSelectedTableType}
								selectedChains={state.selectedChains}
								onChainsChange={actions.setSelectedChains}
								selectedDatasetChain={state.selectedDatasetChain}
								onDatasetChainChange={actions.setSelectedDatasetChain}
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
								error={shownError}
							/>
						) : null}

						{state.selectedMainTab === 'text' ? (
							<TextTab
								textTitle={state.textTitle}
								textContent={state.textContent}
								onTextTitleChange={actions.setTextTitle}
								onTextContentChange={actions.setTextContent}
								error={shownError}
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
								error={shownError}
								pane={pane}
								onPaneChange={setPane}
							/>
						) : null}

						{state.selectedMainTab === 'llamaai' ? (
							<LlamaAITab selectedChart={state.selectedLlamaAIChart} onChartSelect={actions.setSelectedLlamaAIChart} />
						) : null}

						{state.selectedMainTab === 'sql' ? (
							isSqlAccessUnknown ? (
								<div className="mx-auto w-full max-w-md py-8">
									<InlineStatus variant="error" retry={{ refetch: retry, isFetching: isRetrying }}>
										Couldn&apos;t load your subscription.
									</InlineStatus>
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

					{!tableWizardOpen && state.selectedMainTab !== 'sql' ? (
						<SubmitButton
							editItem={editItem}
							state={state}
							onSubmit={handleAdd}
							submitError={submitError}
							pickList={pickList}
						/>
					) : null}
				</Tabs>
			</ModalBindingsProvider>
		</Dialog>
	)
}
