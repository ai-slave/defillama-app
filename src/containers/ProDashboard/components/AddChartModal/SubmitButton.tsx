import { type MouseEvent, useId } from 'react'
import { Button } from '~/ui/Button'
import { DialogCancelButton, DialogFooter } from '~/ui/Dialog'
import { ErrorLine } from '~/ui/Status'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { type PickListLoad, resolveSubmitGate } from './submitBlocker'
import type { ModalState } from './types'

interface SubmitButtonProps {
	editItem?: DashboardItemConfig | null | undefined
	state: ModalState
	/** Checks the input, which says what is missing under its control, then adds or saves the card. */
	onSubmit: (event: MouseEvent<HTMLButtonElement>) => void
	/** Why the dashboard refused the last submit, shown where the gate's reason would be. */
	submitError: string | null
	/** The open form's pick list while it loads (Add waits) or after it failed (Add stays disabled beside the failure). */
	pickList: PickListLoad
}

function getButtonText(state: ModalState, editItem: DashboardItemConfig | null | undefined): string {
	if (editItem) return 'Save changes'
	if (state.selectedMainTab !== 'charts') return 'Add card'
	if (state.chartMode === 'builder') return 'Add chart'
	if (state.selectedChartTab !== 'chain' && state.selectedChartTab !== 'protocol') return 'Add chart'
	if (state.chartCreationMode === 'combined') return 'Add chart'
	const count = state.composerItems.length > 0 ? state.composerItems.length : state.selectedChartTypes.length
	return count > 1 ? `Add ${count.toString()} cards` : 'Add card'
}

export function SubmitButton({ editItem, state, onSubmit, submitError, pickList }: SubmitButtonProps) {
	const reasonId = useId()
	const gate = resolveSubmitGate(state)

	return (
		<DialogFooter
			leading={
				<div id={reasonId} className="flex min-h-4 min-w-0 items-center">
					{submitError ? (
						<ErrorLine inset="none">{submitError}</ErrorLine>
					) : (
						<p className="body-sm text-tertiary">{gate}</p>
					)}
				</div>
			}
			dismiss={<DialogCancelButton />}
		>
			{/* Focusable while gated, so the reason beside it is read with it. */}
			<Button
				variant="primary"
				size="md"
				onClick={onSubmit}
				// The picked list's own loading label ("Loading protocols…") only exists while it loads.
				pendingLabel={pickList?.status === 'loading' ? pickList.label : undefined}
				pending={pickList?.status === 'loading'}
				disabled={gate !== null || pickList?.status === 'failed'}
				accessibleWhenDisabled
				aria-describedby={gate !== null ? reasonId : undefined}
				{...(state.selectedMainTab === 'custom-data' ? { 'data-umami-event': 'custom-data-add' } : {})}
			>
				{getButtonText(state, editItem)}
			</Button>
		</DialogFooter>
	)
}
