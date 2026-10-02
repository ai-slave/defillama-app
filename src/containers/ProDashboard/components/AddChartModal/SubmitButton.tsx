import { useId } from 'react'
import { Button } from '~/ui/Button'
import { DialogFooter } from '~/ui/Dialog'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { ProMeta } from '../../ui'
import { resolveSubmitBlocker } from './submitBlocker'
import type { ModalState } from './types'

interface SubmitButtonProps {
	editItem?: DashboardItemConfig | null | undefined
	state: ModalState
	onSubmit: () => void
	/** Why the dashboard refused the last submit, shown where the blocker would be. */
	submitError: string | null
	onCancel: () => void
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

export function SubmitButton({ editItem, state, onSubmit, submitError, onCancel }: SubmitButtonProps) {
	const reasonId = useId()
	const disabledReason = resolveSubmitBlocker(state, editItem)
	const isDisabled = disabledReason !== null

	return (
		<DialogFooter
			leading={
				<div id={reasonId} className="flex min-h-4 min-w-0 items-center">
					{submitError ? (
						<p role="alert" className="text-xs text-error">
							{submitError}
						</p>
					) : (
						<ProMeta items={[disabledReason]} />
					)}
				</div>
			}
			dismiss={
				<Button size="md" onClick={onCancel}>
					Cancel
				</Button>
			}
		>
			<Button
				variant="primary"
				size="md"
				onClick={() => {
					if (!isDisabled) onSubmit()
				}}
				// Focusable while blocked, so the reason beside it is read with it.
				{...(isDisabled ? { 'aria-disabled': true, 'aria-describedby': reasonId } : {})}
				{...(state.selectedMainTab === 'custom-data' ? { 'data-umami-event': 'custom-data-add' } : {})}
			>
				{getButtonText(state, editItem)}
			</Button>
		</DialogFooter>
	)
}
