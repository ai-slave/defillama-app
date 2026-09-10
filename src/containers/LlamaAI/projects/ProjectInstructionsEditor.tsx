import { useId, useState } from 'react'
import { Button } from '~/ui/Button'
import { textareaStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { formatNumber } from '~/utils/numberFormat'
import { useUpdateProject } from './hooks'

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
	const [draft, setDraft] = useState(() => ({ value: incomingValue, savedValue: incomingValue, edited: false }))

	if (incomingValue !== draft.savedValue) {
		const wasDirty = draft.value.trim() !== draft.savedValue.trim()
		const preserveDraft = wasDirty || draft.edited || update.isPending
		setDraft({ value: preserveDraft ? draft.value : incomingValue, savedValue: incomingValue, edited: draft.edited })
	}

	const dirty = draft.value.trim() !== draft.savedValue.trim()

	// The mutation owns the outcome: `update.error` is the inline message, and the next save clears it.
	const saveDraft = (nextDraft: string) => {
		setDraft((current) => ({ ...current, edited: false }))
		update.mutate({ custom_instructions: nextDraft || null })
	}

	const onBlur = () => {
		// A failed save is retried explicitly, so focusing Retry cannot submit twice.
		if (update.error) return
		const shouldSave = dirty || (draft.edited && update.isPending)
		if (!shouldSave) {
			if (draft.edited) setDraft((current) => ({ ...current, edited: false }))
			return
		}
		saveDraft(draft.value.trim())
	}

	return (
		<section className="flex flex-col gap-2">
			<header className="flex items-center justify-between">
				<label htmlFor={inputId} className="label-md text-primary">
					Instructions
				</label>
				<span role="status" className="flex items-center gap-1 body-sm text-secondary">
					{update.isPending ? (
						<>
							<LoadingSpinner size={12} /> Saving…
						</>
					) : update.error ? (
						'Not saved'
					) : dirty ? (
						'Unsaved'
					) : (
						'Saved'
					)}
				</span>
			</header>
			<textarea
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
				className={`${textareaStyles} field-sizing-content max-h-64 min-h-20 resize-y`}
			/>
			{update.error ? (
				<div role="alert" id={`${inputId}-error`} className="flex flex-wrap items-center gap-2 body-sm text-error">
					<p>{saveInstructionsError(update.error)}</p>
					<Button type="button" size="sm" onClick={() => saveDraft(draft.value.trim())} disabled={update.isPending}>
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
