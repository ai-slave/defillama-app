export interface ComposerFocusIntent {
	readOnly: boolean
	isMobile: boolean
	restoringSessionId: string | null
	settledSessionId: string
	lastFocusedSessionId: string | null
}

export function shouldFocusComposerOnSessionChange({
	readOnly,
	isMobile,
	restoringSessionId,
	settledSessionId,
	lastFocusedSessionId
}: ComposerFocusIntent): boolean {
	if (readOnly) return false
	if (isMobile) return false
	if (restoringSessionId) return false
	return settledSessionId !== lastFocusedSessionId
}
