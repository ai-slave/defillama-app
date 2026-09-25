/** `edited` marks typing since the last save request, so an acknowledgement of an older save never overwrites it. */
export type InstructionsDraft = { value: string; savedValue: string; edited: boolean }

export function isInstructionsDraftDirty(draft: InstructionsDraft) {
	return draft.value.trim() !== draft.savedValue.trim()
}

/** Adopt a new server value unless the user has unsaved or in-flight text to keep. */
export function reconcileInstructionsDraft(
	draft: InstructionsDraft,
	incomingValue: string,
	isPending: boolean
): InstructionsDraft {
	if (incomingValue === draft.savedValue) return draft
	const preserveDraft = isInstructionsDraftDirty(draft) || draft.edited || isPending
	return { value: preserveDraft ? draft.value : incomingValue, savedValue: incomingValue, edited: draft.edited }
}

export type InstructionsBlurAction =
	| { type: 'none' }
	| { type: 'clear-edited' }
	| { type: 'save'; value: string | null }

export function getInstructionsBlurAction(
	draft: InstructionsDraft,
	{ isPending, hasError }: { isPending: boolean; hasError: boolean }
): InstructionsBlurAction {
	// A failed save is retried explicitly, so focusing Retry cannot submit twice.
	if (hasError) return { type: 'none' }
	// While a save is in flight, an edit back to the saved text must still be sent to supersede it.
	if (isInstructionsDraftDirty(draft) || (draft.edited && isPending)) {
		return { type: 'save', value: draft.value.trim() || null }
	}
	return draft.edited ? { type: 'clear-edited' } : { type: 'none' }
}

export function getInstructionsSaveStatus({
	isPending,
	hasError,
	dirty
}: {
	isPending: boolean
	hasError: boolean
	dirty: boolean
}) {
	if (isPending) return 'saving'
	if (hasError) return 'failed'
	return dirty ? 'unsaved' : 'saved'
}
