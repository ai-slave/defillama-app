import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { ModalState } from './types'

/** Why Add cannot run for a reason other than the input: the tab has nothing chosen to start from, or its data is still
    preparing. Add stays disabled and the footer says why. */
export function resolveSubmitGate(state: ModalState): string | null {
	switch (state.selectedMainTab) {
		case 'charts':
			// The category grid is the tab's content until a category opens its form; series composed earlier still add.
			return state.chartMode === 'manual' && !state.manualFormOpen && state.composerItems.length === 0
				? 'Pick a category to start'
				: null
		case 'table':
			return state.selectedTableType === null ? 'Pick a table type to start' : null
		case 'llamaai':
			// The saved-chart list is the whole tab, and it can be empty, signed out or behind Pro.
			return state.selectedLlamaAIChart ? null : 'Pick a saved chart'
		case 'custom-data':
			return state.customData.isPreparing ? 'Preparing data…' : null
		case 'metric':
		case 'text':
		case 'sql':
			return null
		default:
			return state.selectedMainTab satisfies never
	}
}

export type PickListLoad = { status: 'loading'; label: string } | { status: 'failed' } | null

/** The list a manual chart form picks from, while its picker shows a loader or the failure with Try again in its place.
    An error under a list the reader cannot use helps nobody, so Add waits for the list, or stays disabled beside the
    failure (docs/focus-and-errors.md, "Validating a form"). */
export function resolvePickListLoad(
	state: ModalState,
	lists: { protocolsLoading: boolean; yieldPools: 'loading' | 'failed' | null }
): PickListLoad {
	if (state.selectedMainTab !== 'charts' || state.chartMode !== 'manual' || !state.manualFormOpen) return null
	switch (state.selectedChartTab) {
		// A pick already made (an edited card, composed series) adds without the list.
		case 'yields':
			if (state.selectedYieldPool) return null
			if (lists.yieldPools === 'failed') return { status: 'failed' }
			return lists.yieldPools === 'loading' ? { status: 'loading', label: 'Loading pools…' } : null
		case 'chain':
		case 'protocol':
			if (!lists.protocolsLoading || state.composerItems.length > 0) return null
			return { status: 'loading', label: state.selectedChartTab === 'chain' ? 'Loading chains…' : 'Loading protocols…' }
		default:
			// The other categories keep their picker on screen while it loads.
			return null
	}
}

function resolveManualChartError(state: ModalState, editItem: DashboardItemConfig | null | undefined): string | null {
	switch (state.selectedChartTab) {
		case 'yields':
			return state.selectedYieldPool ? null : 'Choose a yield pool.'
		case 'stablecoins':
			if (state.stablecoinMode === 'asset') return state.selectedStablecoinAssetId ? null : 'Choose a stablecoin.'
			return state.selectedStablecoinChain ? null : 'Choose a chain.'
		case 'advanced-tvl':
			return state.selectedAdvancedTvlProtocol ? null : 'Choose a protocol.'
		case 'borrowed':
			return state.selectedBorrowedProtocol ? null : 'Choose a protocol.'
		// The asset view's metric toggles never drop the last metric, so the asset is all it can miss.
		case 'rwa':
			return state.rwaMode === 'asset' && !state.selectedRwaAssetId ? 'Choose an asset.' : null
		case 'income-statement':
			return state.selectedIncomeStatementProtocol ? null : 'Choose a protocol.'
		case 'unlocks':
			return state.selectedUnlocksProtocol ? null : 'Choose a protocol.'
		case 'chain':
		case 'protocol':
			// An edit writes back one card, so separate mode can keep only one series, whatever the card was.
			if (editItem && state.chartCreationMode === 'separate' && state.composerItems.length > 1) {
				return 'Keep one series, or switch to One chart.'
			}
			if (state.composerItems.length > 0 || !state.manualFormOpen) return null
			return state.selectedChartTab === 'chain' ? 'Choose at least one chain.' : 'Choose at least one protocol.'
		default:
			return state.selectedChartTab satisfies never
	}
}

/** What the input still needs before Add, said under the control that needs it once Add is pressed. */
export function resolveSubmitError(
	state: ModalState,
	editItem?: DashboardItemConfig | null | undefined
): string | null {
	switch (state.selectedMainTab) {
		case 'charts':
			if (state.chartMode === 'builder') return state.chartBuilder.metric ? null : 'Choose a metric.'
			return resolveManualChartError(state, editItem)
		case 'table':
			if (state.selectedTableType === 'stablecoins' || state.selectedTableType === 'rwa-selected-chain') {
				return state.selectedDatasetChain ? null : 'Choose a chain.'
			}
			if (state.selectedTableType === 'token-usage') {
				return state.selectedTokens.length > 0 ? null : 'Choose at least one token.'
			}
			return null
		case 'text':
			return state.textContent.trim() ? null : 'Enter some text.'
		case 'metric':
			if (!state.metricType) return 'Choose a metric.'
			if (state.metricSubjectType === 'chain') return state.metricChain ? null : 'Choose a chain.'
			return state.metricProtocol ? null : 'Choose a protocol.'
		case 'custom-data':
			// A CSV that failed to parse already says why under its field.
			if (state.customData.error) return state.customData.error
			return state.customData.storedRows && state.customData.columns.length > 0 ? null : 'Paste or upload a CSV.'
		case 'llamaai':
		case 'sql':
			return null
		default:
			return state.selectedMainTab satisfies never
	}
}
