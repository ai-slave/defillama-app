export interface ChatAttention {
	uncovered: boolean
	sessionId: string | null
	visibleMessageIds: ReadonlySet<string>
}

export function hasWebChatAttention() {
	return typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus()
}

export function isChatSurfaceAttended(attention: Pick<ChatAttention, 'uncovered'>) {
	return attention.uncovered && hasWebChatAttention()
}
