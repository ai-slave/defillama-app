import { useId, useState } from 'react'
import { Button } from '~/ui/Button'
import { Textarea } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
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

	// The mutation owns the outcome: `update.error` is the inline message, and the next save clears it.
	const saveDraft = (instructions: string | null) => {
		setDraft((current) => ({ ...current, edited: false }))
		update.mutate({ custom_instructions: instructions })
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
				aria-describedby={`${inputId}-hint${update.error ? ` ${inputId}-error` : ''}`}
				aria-invalid={!!update.error}
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
			{update.error ? (
				<div role="alert" id={`${inputId}-error`} className="flex flex-wrap items-center gap-2 body-sm text-error">
					<p>{saveInstructionsError(update.error)}</p>
					<Button
						type="button"
						size="sm"
						onClick={() => saveDraft(draft.value.trim() || null)}
						disabled={update.isPending}
					>
						Retry save
					</Button>
				</div>
			) : null}
			<p id={`${inputId}-hint`} className="body-sm text-secondary">
				{formatNumber(draft.value.length)}/{formatNumber(MAX_LENGTH)} characters · Saves when you leave the field
			</p>
		</section>
	)
}
