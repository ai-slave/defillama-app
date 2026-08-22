import { useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '~/ui/Loaders'
import { useUpdateProject } from './hooks'

interface ProjectInstructionsEditorProps {
	projectId: string
	value: string | null
}

const MAX_LENGTH = 8000

export function ProjectInstructionsEditor({ projectId, value }: ProjectInstructionsEditorProps) {
	const update = useUpdateProject(projectId)
	const incomingValue = value ?? ''
	const [draft, setDraft] = useState(() => ({ value: incomingValue, savedValue: incomingValue, edited: false }))

	if (incomingValue !== draft.savedValue) {
		const wasDirty = draft.value.trim() !== draft.savedValue.trim()
		const preserveDraft = wasDirty || draft.edited || update.isPending
		setDraft({ value: preserveDraft ? draft.value : incomingValue, savedValue: incomingValue, edited: draft.edited })
	}

	const dirty = draft.value.trim() !== draft.savedValue.trim()

	const saveDraft = async (nextDraft: string) => {
		try {
			await update.mutateAsync({ custom_instructions: nextDraft || null })
			toast.success('Instructions saved')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save instructions')
		}
	}

	const onBlur = () => {
		const shouldSave = dirty || (draft.edited && update.isPending)
		if (!shouldSave) {
			if (draft.edited) setDraft((current) => ({ ...current, edited: false }))
			return
		}
		setDraft((current) => ({ ...current, edited: false }))
		void saveDraft(draft.value.trim())
	}

	return (
		<section className="flex flex-col gap-2">
			<header className="flex items-center justify-between">
				<h3 className="text-[13px] font-semibold text-primary">Instructions</h3>
				{update.isPending ? (
					<LoadingSpinner size={12} />
				) : dirty ? (
					<span className="text-[11px] text-ai-muted">Unsaved</span>
				) : null}
			</header>
			<textarea
				value={draft.value}
				onChange={(e) => {
					setDraft((current) => ({ ...current, value: e.target.value, edited: true }))
				}}
				onBlur={() => void onBlur()}
				maxLength={MAX_LENGTH}
				rows={6}
				placeholder="System-level guidance for chats in this project. Appended after your global instructions."
				className="resize-y rounded-md border border-ai-line bg-surface px-3 py-2 text-xs leading-5 text-inherit placeholder:text-ai-muted focus:border-brand focus:outline-hidden"
			/>
			<p className="text-[11px] text-ai-muted">
				{draft.value.length}/{MAX_LENGTH} chars · saved automatically
			</p>
		</section>
	)
}
