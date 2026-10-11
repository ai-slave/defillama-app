import { Icon } from '~/ui/Icon'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { Tabs, TabPanel } from '~/ui/Tabs'
import type { ChartRuntimeView } from '../../chartRuntime'
import { ProMeta } from '../../ui'
import { CategoryChartForm } from './CategoryChartForm'
import { ChartBuilderTab } from './ChartBuilderTab'
import type { AddCardPane } from './panes'
import type { ChartModeType, ModalState } from './types'
import { UnifiedChartTab } from './UnifiedChartTab'
import type { ModalActions, ModalComputed } from './useModalActions'

const CHART_MODE_HINTS: Record<ChartModeType, string> = {
	builder: 'Top protocols or chains by one metric, stacked into a single chart.',
	manual: 'Pick a category, then choose specific protocols, chains or assets.'
}

const CHART_MODE_OPTIONS: Array<SegmentedControlOption<ChartModeType>> = [
	{
		value: 'builder',
		label: (
			<>
				<Icon name="pencil-ruler" className="size-3.5" />
				Top-N breakdown
			</>
		)
	},
	{
		value: 'manual',
		label: (
			<>
				<Icon name="layers" className="size-3.5" />
				Manual
			</>
		)
	}
]

interface ChartTabProps {
	state: ModalState
	actions: ModalActions
	computed: ModalComputed
	/** The picked series with their loaded data, for the previews. */
	composerItems: Array<ChartRuntimeView>
	isEditingItem: boolean
	/** What Add still needs, shown under the control that needs it once Add was pressed. */
	error: string | null
	/** The pane a form shows below lg; see AddChartModal. */
	pane: AddCardPane
	onPaneChange: (pane: AddCardPane) => void
}

const CHART_MODES = ['builder', 'manual'] as const

export function ChartTab({
	state,
	actions,
	computed,
	composerItems,
	isEditingItem,
	error,
	pane,
	onPaneChange
}: ChartTabProps) {
	const { chartMode } = state
	return (
		<Tabs value={chartMode} values={CHART_MODES} onValueChange={actions.setChartMode}>
			<div className="flex h-full flex-col">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
					<SegmentedControl
						semantics="tabs"
						variant="default"
						size="md"
						label="Chart creation"
						options={CHART_MODE_OPTIONS}
					/>
					<ProMeta className="min-w-0" items={[CHART_MODE_HINTS[chartMode]]} />
				</div>
				<TabPanel value={chartMode} className="flex min-h-0 flex-1 flex-col">
					{chartMode === 'builder' ? (
						<ChartBuilderTab
							chartBuilder={state.chartBuilder}
							chartBuilderName={state.chartBuilderName}
							chainOptions={computed.chainOptions}
							protocolOptions={computed.protocolOptions}
							protocolsLoading={computed.protocolsLoading}
							onChartBuilderChange={actions.updateChartBuilder}
							onChartBuilderNameChange={actions.setChartBuilderName}
							timePeriod={computed.timePeriod}
							customTimePeriod={computed.customTimePeriod}
							error={error}
							pane={pane}
							onPaneChange={onPaneChange}
						/>
					) : (
						<UnifiedChartTab
							selectedChartTab={state.selectedChartTab}
							selectedChartTypes={state.selectedChartTypes}
							chainOptions={computed.chainOptions}
							protocolOptions={computed.protocolOptions}
							protocolsLoading={computed.protocolsLoading}
							unifiedChartName={state.unifiedChartName}
							chartCreationMode={state.chartCreationMode}
							composerItems={composerItems}
							manualFormOpen={state.manualFormOpen}
							isEditingItem={isEditingItem}
							onSelectCategory={actions.handleSelectChartCategory}
							onBackToCategories={actions.handleBackToChartCategories}
							onChartTabChange={actions.handleChartTabChange}
							onChartTypesChange={actions.setSelectedChartTypes}
							onBulkChartTypeChange={actions.handleBulkChartTypeChange}
							onUnifiedChartNameChange={actions.setUnifiedChartName}
							onChartCreationModeChange={actions.setChartCreationMode}
							onComposerItemColorChange={actions.handleUpdateComposerItemColor}
							onAddToComposer={actions.handleAddToComposer}
							onRemoveFromComposer={actions.handleRemoveFromComposer}
							categoryForm={
								<CategoryChartForm
									state={state}
									actions={actions}
									protocolOptions={computed.protocolOptions}
									protocolsLoading={computed.protocolsLoading}
									error={error}
								/>
							}
							error={error}
							pane={pane}
							onPaneChange={onPaneChange}
						/>
					)}
				</TabPanel>
			</div>
		</Tabs>
	)
}
