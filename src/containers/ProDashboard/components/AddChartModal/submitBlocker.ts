import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { ModalState } from './types'

function resolveManualChartBlocker(state: ModalState, editItem: DashboardItemConfig | null | undefined): string | null {
	switch (state.selectedChartTab) {
		case 'yields':
			return state.selectedYieldPool ? null : 'Pick a yield pool'
		case 'stablecoins':
			if (state.stablecoinMode === 'asset') {
				return state.selectedStablecoinAsset &&
					state.selectedStablecoinAssetId &&
					state.selectedStablecoinAssetChartType
					? null
					: 'Pick a chain or asset'
			}
			return state.selectedStablecoinChain && state.selectedStablecoinChartType ? null : 'Pick a chain or asset'
		case 'advanced-tvl':
			return state.selectedAdvancedTvlProtocol && state.selectedAdvancedTvlChartType ? null : 'Pick a protocol'
		case 'borrowed':
			return state.selectedBorrowedProtocol && state.selectedBorrowedChartType ? null : 'Pick a protocol'
		case 'rwa':
			return state.rwaMode === 'asset' && (!state.selectedRwaAssetId || state.selectedRwaAssetMetrics.length === 0)
				? 'Pick a chain or asset'
				: null
		case 'income-statement':
			return state.selectedIncomeStatementProtocol ? null : 'Pick a protocol'
		case 'unlocks':
			return state.selectedUnlocksProtocol ? null : 'Pick a protocol'
		case 'chain':
		case 'protocol':
			// An edit writes back one card, so separate mode can keep only one series, whatever the card was.
			if (editItem && state.chartCreationMode === 'separate' && state.composerItems.length > 1) {
				return 'Keep one series, or switch to One chart'
			}
			if (state.composerItems.length > 0) return null
			return state.manualFormOpen ? 'Select at least one chain or protocol' : 'Pick a category to start'
		default:
			return state.selectedChartTab satisfies never
	}
}

export function resolveSubmitBlocker(
	state: ModalState,
	editItem?: DashboardItemConfig | null | undefined
): string | null {
	switch (state.selectedMainTab) {
		case 'charts':
			if (state.chartMode === 'builder') return state.chartBuilder.metric ? null : 'Choose a metric'
			return resolveManualChartBlocker(state, editItem)
		case 'table':
			if (state.selectedTableType === null) return 'Pick a table type to start'
			if (state.selectedTableType === 'stablecoins' || state.selectedTableType === 'rwa-selected-chain') {
				return state.selectedDatasetChain ? null : 'Pick a chain'
			}
			if (state.selectedTableType === 'token-usage') {
				return state.selectedTokens.length > 0 ? null : 'Pick at least one token'
			}
			return null
		case 'text':
			return state.textContent.trim() ? null : 'Write some text'
		case 'metric':
			if (!state.metricType) return 'Pick a subject and a metric'
			if (state.metricSubjectType === 'chain') return state.metricChain ? null : 'Pick a subject and a metric'
			return state.metricProtocol ? null : 'Pick a subject and a metric'
		case 'llamaai':
			return state.selectedLlamaAIChart ? null : 'Pick a saved chart'
		case 'custom-data':
			if (state.customData.error) return 'Fix the CSV to continue'
			if (state.customData.isPreparing) return 'Preparing data…'
			return state.customData.storedRows && state.customData.columns.length > 0 ? null : 'Upload or paste a CSV'
		case 'sql':
			return null
		default:
			return state.selectedMainTab satisfies never
	}
}
