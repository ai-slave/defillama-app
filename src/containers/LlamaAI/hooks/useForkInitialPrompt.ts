import { useEffect, useRef } from 'react'

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
	const submitPromptRef = useRef(submitPrompt)
	submitPromptRef.current = submitPrompt
	const resolveSessionAliasRef = useRef(resolveSessionAlias)
	resolveSessionAliasRef.current = resolveSessionAlias

	useEffect(() => {
		if (!initialPrompt) return
		if (!sharedSession && !routeSessionId) return
		const nextToken = { sessionId: routeSessionId ?? 'shared', prompt: initialPrompt }
		const currentToken = consumedRef.current
		if (currentToken?.sessionId === nextToken.sessionId && currentToken.prompt === nextToken.prompt) return
		consumedRef.current = nextToken
	}, [initialPrompt, routeSessionId, sharedSession])

	useEffect(() => {
		const token = consumedRef.current
		if (!token) return
		if (restoringSessionId) return
		if (!sharedSession && resolveSessionAliasRef.current(token.sessionId) !== sessionId) return
		consumedRef.current = null
		const frameId = window.requestAnimationFrame(() => {
			submitPromptRef.current(token.prompt)
		})

		return () => {
			window.cancelAnimationFrame(frameId)
		}
	}, [restoringSessionId, sessionId, sharedSession])
}
