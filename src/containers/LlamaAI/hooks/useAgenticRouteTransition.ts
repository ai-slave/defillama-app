import { useEffectEvent, useLayoutEffect, useMemo, useRef } from 'react'
import {
	isSameAgenticRouteTransition,
	shouldSkipCurrentSessionRouteRestore,
	toAgenticRouteTransition,
	type AgenticRouteTransition
} from '~/containers/LlamaAI/routeTransition'
import type { LlamaAIRouteState } from '~/contexts/LlamaAIRouteState'

interface UseAgenticRouteTransitionOptions {
	route: LlamaAIRouteState
	readOnly: boolean
	sharedSession: boolean
	resolveSessionAlias: (id: string) => string
	getCurrentSessionId: () => string | null
	onNewChat: () => void
	onOpenSession: (sessionId: string, aroundMessageId?: string) => void | Promise<void>
	onClearChat: () => void
}

export function useAgenticRouteTransition({
	route,
	readOnly,
	sharedSession,
	resolveSessionAlias,
	getCurrentSessionId,
	onNewChat,
	onOpenSession,
	onClearChat
}: UseAgenticRouteTransitionOptions) {
	const previousRouteTransitionRef = useRef<AgenticRouteTransition | null>(null)

	const routeTransition = useMemo(() => {
		if (readOnly || sharedSession) return null
		return toAgenticRouteTransition(route, resolveSessionAlias)
	}, [readOnly, sharedSession, route, resolveSessionAlias])

	useLayoutEffect(() => {
		return () => {
			previousRouteTransitionRef.current = null
		}
	}, [])

	// Runs inside the route effect only, so it reads the latest chat callbacks without making them triggers.
	const applyTransition = useEffectEvent(
		(transition: AgenticRouteTransition, previousTransition: AgenticRouteTransition | null) => {
			switch (transition.kind) {
				case 'new-chat':
					onNewChat()
					return
				case 'session': {
					if (
						shouldSkipCurrentSessionRouteRestore(
							transition,
							previousTransition?.kind === 'session'
								? { ...previousTransition, sessionId: resolveSessionAlias(previousTransition.sessionId) }
								: previousTransition,
							getCurrentSessionId()
						)
					) {
						return
					}
					void onOpenSession(transition.sessionId, transition.aroundMessageId)
					return
				}
				case 'project-list':
				case 'project':
					onClearChat()
					return
				default: {
					const _exhaustive: never = transition
					return _exhaustive
				}
			}
		}
	)

	useLayoutEffect(() => {
		if (!routeTransition) return

		const previousTransition = previousRouteTransitionRef.current
		if (previousTransition && isSameAgenticRouteTransition(previousTransition, routeTransition)) return
		previousRouteTransitionRef.current = routeTransition
		applyTransition(routeTransition, previousTransition)
	}, [routeTransition])
}
