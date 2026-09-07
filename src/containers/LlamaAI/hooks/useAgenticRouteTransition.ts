import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
	projectHomeSignal: number
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
	projectHomeSignal,
	getCurrentSessionId,
	onNewChat,
	onOpenSession,
	onClearChat
}: UseAgenticRouteTransitionOptions) {
	const onNewChatRef = useRef(onNewChat)
	const onOpenSessionRef = useRef(onOpenSession)
	const onClearChatRef = useRef(onClearChat)
	const getCurrentSessionIdRef = useRef(getCurrentSessionId)
	// Written after commit rather than during render: a render-phase ref write costs the hook its
	// compiler optimization, and every reader here runs from a handler or an effect, after commit.
	useLayoutEffect(() => {
		onNewChatRef.current = onNewChat
		onOpenSessionRef.current = onOpenSession
		onClearChatRef.current = onClearChat
		getCurrentSessionIdRef.current = getCurrentSessionId
	})

	const previousRouteTransitionRef = useRef<AgenticRouteTransition | null>(null)
	const projectHomeSignalRef = useRef(projectHomeSignal)

	const routeTransition = useMemo(() => {
		if (readOnly || sharedSession) return null
		return toAgenticRouteTransition(route, resolveSessionAlias)
	}, [readOnly, sharedSession, route, resolveSessionAlias])

	useLayoutEffect(() => {
		return () => {
			previousRouteTransitionRef.current = null
		}
	}, [])

	useLayoutEffect(() => {
		if (!routeTransition) return

		const previousTransition = previousRouteTransitionRef.current
		if (previousTransition && isSameAgenticRouteTransition(previousTransition, routeTransition)) return
		previousRouteTransitionRef.current = routeTransition

		const transition = async () => {
			switch (routeTransition.kind) {
				case 'new-chat':
					onNewChatRef.current()
					return
				case 'session': {
					if (
						shouldSkipCurrentSessionRouteRestore(routeTransition, previousTransition, getCurrentSessionIdRef.current())
					) {
						return
					}
					await onOpenSessionRef.current(routeTransition.sessionId, routeTransition.aroundMessageId)
					return
				}
				case 'project-list':
				case 'project':
					onClearChatRef.current()
					return
				default: {
					const _exhaustive: never = routeTransition
					return _exhaustive
				}
			}
		}

		void transition()
	}, [routeTransition])

	useEffect(() => {
		if (projectHomeSignal === projectHomeSignalRef.current) return
		projectHomeSignalRef.current = projectHomeSignal
		if (readOnly || sharedSession) return
		if (route.kind !== 'project') return
		onClearChatRef.current()
	}, [projectHomeSignal, route.kind, readOnly, sharedSession])
}
