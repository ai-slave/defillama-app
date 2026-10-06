import { createContext, useMemo, type ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import type { UploadContext } from '~/containers/LlamaAI/hooks/useImageUpload'

export const UploadTargetContext = createContext<UploadContext | null>(null)

// Names the chat a file should upload into. A context rather than a prop because the composer sits
// four components below the state, and nothing in between has any use for it.
export function UploadTargetProvider({
	sessionId,
	projectId,
	children
}: {
	sessionId: string | null
	projectId?: string | null
	children: ReactNode
}) {
	const { authToken } = useAuthContext()
	const value = useMemo(
		() => (authToken && sessionId ? { authToken, sessionId, projectId } : null),
		[authToken, sessionId, projectId]
	)
	return <UploadTargetContext.Provider value={value}>{children}</UploadTargetContext.Provider>
}
