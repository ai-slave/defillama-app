import type { LlamaAIRouteState } from '~/contexts/LlamaAIRouteState'

export type AgenticRouteTransition =
	| { kind: 'new-chat' }
	| { kind: 'session'; sessionId: string; aroundMessageId?: string }
	| { kind: 'project-list' }
	| { kind: 'project'; projectId: string }

export function toAgenticRouteTransition(
	route: LlamaAIRouteState,
	resolveSessionAlias: (id: string) => string
): AgenticRouteTransition | null {
	switch (route.kind) {
		case 'chat-new':
			return { kind: 'new-chat' }
		case 'chat-session':
			return {
				kind: 'session',
				sessionId: resolveSessionAlias(route.sessionId),
				aroundMessageId: route.aroundMessageId
			}
		case 'project-list':
			return { kind: 'project-list' }
		case 'project':
			return { kind: 'project', projectId: route.projectId }
		case 'unknown':
			return null
		default: {
			const _exhaustive: never = route
			return _exhaustive
		}
	}
}

export function isSameAgenticRouteTransition(a: AgenticRouteTransition, b: AgenticRouteTransition) {
	switch (a.kind) {
		case 'new-chat':
			return b.kind === 'new-chat'
		case 'session':
			return b.kind === 'session' && a.sessionId === b.sessionId && a.aroundMessageId === b.aroundMessageId
		case 'project-list':
			return b.kind === 'project-list'
		case 'project':
			return b.kind === 'project' && a.projectId === b.projectId
		default: {
			const _exhaustive: never = a
			return _exhaustive
		}
	}
}

export function shouldSkipCurrentSessionRouteRestore(
	routeTransition: Extract<AgenticRouteTransition, { kind: 'session' }>,
	previousTransition: AgenticRouteTransition | null,
	currentSessionId: string | null
) {
	if (routeTransition.sessionId !== currentSessionId) return false
	if (routeTransition.aroundMessageId) return false
	if (previousTransition?.kind !== 'session') return false
	if (previousTransition.sessionId !== routeTransition.sessionId) return false
	if (previousTransition.aroundMessageId) return false
	return true
}
