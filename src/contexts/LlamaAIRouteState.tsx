import { useRouter } from 'next/router'
import { createContext, type PropsWithChildren, useMemo } from 'react'
import { parseLlamaAIRoute, type LlamaAIRouteState } from './llamaAIRoute'

export { isLlamaAIConversationPage, type LlamaAIRouteState } from './llamaAIRoute'

export const LlamaAIRouteContext = createContext<LlamaAIRouteState>({ kind: 'unknown' })

export function useLlamaAIRouteState(): LlamaAIRouteState {
	const { isReady, pathname, asPath, query } = useRouter()
	const { sessionId, prompt, shareToken, id, tab } = query
	return useMemo(
		() => parseLlamaAIRoute({ isReady, pathname, asPath, query: { sessionId, prompt, shareToken, id, tab } }),
		[isReady, pathname, asPath, sessionId, prompt, shareToken, id, tab]
	)
}

export function LlamaAIRouteProvider({ value, children }: PropsWithChildren<{ value: LlamaAIRouteState }>) {
	return <LlamaAIRouteContext.Provider value={value}>{children}</LlamaAIRouteContext.Provider>
}
