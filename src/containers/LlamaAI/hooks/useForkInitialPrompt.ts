import { useEffect, useEffectEvent, useRef } from 'react'

interface UseForkInitialPromptOptions {
	initialPrompt: string | undefined
	routeSessionId: string | null
	sharedSession: boolean
	restoringSessionId: string | null
	sessionId: string | null
	resolveSessionAlias: (id: string) => string
	submitPrompt: (prompt: string) => void
}

export function useForkInitialPrompt({
	initialPrompt,
	routeSessionId,
	sharedSession,
	restoringSessionId,
	sessionId,
	resolveSessionAlias,
	submitPrompt
}: UseForkInitialPromptOptions) {
	const consumedRef = useRef<{ sessionId: string; prompt: string } | null>(null)
	// Only the callbacks go through effect events. They are read for freshness and must not restart the
	// effect below when a caller re-renders; the session values must, so they stay dependencies.
	const resolveAlias = useEffectEvent((aliasSessionId: string) => resolveSessionAlias(aliasSessionId))
	const submitPromptNow = useEffectEvent((prompt: string) => submitPrompt(prompt))

	useEffect(() => {
		if (!initialPrompt) return
		if (!sharedSession && !routeSessionId) return
		const nextToken = { sessionId: routeSessionId ?? 'shared', prompt: initialPrompt }
		const currentToken = consumedRef.current
		if (currentToken?.sessionId === nextToken.sessionId && currentToken.prompt === nextToken.prompt) return
		consumedRef.current = nextToken
	}, [initialPrompt, routeSessionId, sharedSession])

	// sessionId and sharedSession are triggers, not just values this reads: the effect has to run again
	// when the target session becomes ready, and its cleanup has to cancel a frame scheduled for a
	// session the reader has since left. Moving them into an effect event kept the reads fresh and threw
	// the scheduling away.
	useEffect(() => {
		const token = consumedRef.current
		if (!token) return
		if (restoringSessionId) return
		if (!sharedSession && resolveAlias(token.sessionId) !== sessionId) return
		consumedRef.current = null
		const frameId = window.requestAnimationFrame(() => {
			submitPromptNow(token.prompt)
		})

		return () => {
			window.cancelAnimationFrame(frameId)
		}
	}, [restoringSessionId, sessionId, sharedSession])
}
