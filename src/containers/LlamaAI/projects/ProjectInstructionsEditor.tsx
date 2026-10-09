import { useId, useState } from 'react'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { Textarea } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import { useUpdateProject } from './hooks'
import {
	getInstructionsBlurAction,
	getInstructionsSaveStatus,
	type InstructionsDraft,
	isInstructionsDraftDirty,
	reconcileInstructionsDraft
} from './instructionsDraft'

interface ProjectInstructionsEditorProps {
	projectId: string
	value: string | null
}

const MAX_LENGTH = 8000

function saveInstructionsError(error: unknown) {
	return error instanceof Error ? error.message : 'Failed to save instructions'
}

export function ProjectInstructionsEditor({ projectId, value }: ProjectInstructionsEditorProps) {
	const update = useUpdateProject(projectId)
	const inputId = useId()
	const incomingValue = value ?? ''
	const [draft, setDraft] = useState<InstructionsDraft>(() => ({
		value: incomingValue,
		savedValue: incomingValue,
		edited: false
	}))

	const reconciled = reconcileInstructionsDraft(draft, incomingValue, update.isPending)
	if (reconciled !== draft) setDraft(reconciled)

	const dirty = isInstructionsDraftDirty(draft)
	const status = getInstructionsSaveStatus({ isPending: update.isPending, hasError: !!update.error, dirty })

	// The mutation owns the save status. The inline notice keeps the last failure until a save succeeds: `update.error`
	// clears when a retry starts, which would unmount the focused Try again.
	const [saveError, setSaveError] = useState<unknown>(null)
	const saveDraft = (instructions: string | null) => {
		setDraft((current) => ({ ...current, edited: false }))
		update.mutate(
			{ custom_instructions: instructions },
			{ onError: (error) => setSaveError(error), onSuccess: () => setSaveError(null) }
		)
	}

	const onBlur = () => {
		const action = getInstructionsBlurAction(draft, { isPending: update.isPending, hasError: !!update.error })
		if (action.type === 'save') saveDraft(action.value)
		else if (action.type === 'clear-edited') setDraft((current) => ({ ...current, edited: false }))
	}

	return (
		<section className="flex flex-col gap-2">
			<header className="flex items-center justify-between">
				<label htmlFor={inputId} className="label-md text-primary">
					Instructions
				</label>
				<span role="status" className="flex items-center gap-1 body-sm text-secondary">
					{status === 'saving' ? (
						<>
							<LoadingSpinner size={12} /> Saving…
						</>
					) : status === 'failed' ? (
						'Not saved'
					) : status === 'unsaved' ? (
						'Unsaved'
					) : (
						'Saved'
					)}
				</span>
			</header>
			<Textarea
				id={inputId}
				aria-describedby={`${inputId}-hint${saveError !== null ? ` ${inputId}-error` : ''}`}
				aria-invalid={saveError !== null}
				value={draft.value}
				onChange={(e) => {
					setDraft((current) => ({ ...current, value: e.target.value, edited: true }))
				}}
				onBlur={() => void onBlur()}
				maxLength={MAX_LENGTH}
				rows={3}
				placeholder="How should LlamaAI respond in this project?"
				className="field-sizing-content max-h-64 min-h-20 resize-y"
			/>
			{saveError !== null ? (
				<div id={`${inputId}-error`}>
					<InlineStatus
						variant="error"
						action={
							<Button
								type="button"
								size="sm"
								// The retry leaves once the save succeeds; the section keeps focus.
								ref={focusRegionOnLeave}
								onClick={() => saveDraft(draft.value.trim() || null)}
								pendingLabel="Saving…"
								pending={update.isPending}
							>
								Try again
							</Button>
						}
					>
						{saveInstructionsError(saveError)}
					</InlineStatus>
				</div>
			) : null}
			<p id={`${inputId}-hint`} className="body-sm text-secondary">
				{formatNumber(draft.value.length)}/{formatNumber(MAX_LENGTH)} characters · Saves when you leave the field
			</p>
		</section>
	)
}
