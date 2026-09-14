import { useId } from 'react'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { ProButton, ProMeta } from '../../ui'
import { resolveSubmitBlocker } from './submitBlocker'
import type { ModalState } from './types'

interface SubmitButtonProps {
	editItem?: DashboardItemConfig | null | undefined
	state: ModalState
	onSubmit: () => void
}

function getButtonText(state: ModalState, editItem: DashboardItemConfig | null | undefined): string {
	if (editItem) return 'Save changes'

	switch (state.selectedMainTab) {
		case 'table':
			return 'Add card'
		case 'metric':
			return 'Add card'
		case 'charts': {
			if (state.chartMode === 'builder') return 'Add chart'
			if (state.selectedChartTab !== 'chain' && state.selectedChartTab !== 'protocol') return 'Add chart'
			if (state.chartCreationMode === 'combined') return 'Add chart'
			const count = state.composerItems.length > 0 ? state.composerItems.length : state.selectedChartTypes.length
			return count > 1 ? `Add ${count.toString()} cards` : 'Add card'
		}
		case 'text':
			return 'Add card'
		case 'llamaai':
			return 'Add card'
		case 'custom-data':
			return 'Add card'
		default:
			return 'Add card'
	}
}

export function SubmitButton({ editItem, state, onSubmit }: SubmitButtonProps) {
	const reasonId = useId()
	const disabledReason = resolveSubmitBlocker(state, editItem)
	const isDisabled = disabledReason !== null

	return (
		<div className="mt-2 flex items-center justify-between gap-3 border-t border-pro-cards-border pt-3">
			<div id={reasonId} className="flex min-h-4 min-w-0 items-center">
				<ProMeta items={[disabledReason]} />
			</div>
			<ProButton
				type="button"
				variant="primary"
				size="md"
				onClick={() => {
					if (!isDisabled) onSubmit()
				}}
				{...(isDisabled ? { 'aria-disabled': true, 'aria-describedby': reasonId, title: disabledReason } : {})}
				{...(state.selectedMainTab === 'custom-data' ? { 'data-umami-event': 'custom-data-add' } : {})}
			>
				{getButtonText(state, editItem)}
			</ProButton>
		</div>
	)
}
