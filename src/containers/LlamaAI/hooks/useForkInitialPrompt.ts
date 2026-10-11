import { useEffect, useEffectEvent, useRef } from 'react'

interface UseForkInitialPromptOptions {
	initialPrompt: string | undefined
	routeSessionId: string | null
	sharedSession: boolean
	restoringSessionId: string | null
	sessionId: string | null
	resolveSessionAlias: (id: string) => string
	/** Delivers the prompt: sends it, or fills the composer. Returns whether the chat took it. */
	submitPrompt: (prompt: string) => boolean
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
	// The prompt the chat last took, by target, so a re-render or a return to the same URL never delivers it
	// twice. A canceled frame or a refused prompt leaves it pending for the next time the target is ready.
	const submittedRef = useRef<{ target: string; prompt: string } | null>(null)
	// Only the callbacks go through effect events. They are read for freshness and must not restart the
	// effect below when a caller re-renders; the session values must, so they stay dependencies.
	const resolveAlias = useEffectEvent((aliasSessionId: string) => resolveSessionAlias(aliasSessionId))
	const submitPromptNow = useEffectEvent((prompt: string) => submitPrompt(prompt))

	// Every value that decides whether the target is ready is a dependency, so the effect runs whenever any of
	// them arrives last, and its cleanup cancels a frame scheduled for a session the reader has since left.
	useEffect(() => {
		if (!initialPrompt) return
		if (!sharedSession && !routeSessionId) return
		if (restoringSessionId) return
		const target = routeSessionId ?? 'shared'
		if (!sharedSession && resolveAlias(target) !== sessionId) return
		const submitted = submittedRef.current
		if (submitted?.target === target && submitted.prompt === initialPrompt) return
		const frameId = window.requestAnimationFrame(() => {
			if (submitPromptNow(initialPrompt)) submittedRef.current = { target, prompt: initialPrompt }
		})
		return () => window.cancelAnimationFrame(frameId)
	}, [initialPrompt, restoringSessionId, routeSessionId, sessionId, sharedSession])
}
