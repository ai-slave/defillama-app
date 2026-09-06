import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef } from 'react'

interface SessionAliasRegistry {
	resolve: (id: string) => string
	register: (fakeId: string, realId: string) => void
	clear: () => void
}

const SessionAliasContext = createContext<SessionAliasRegistry | null>(null)

export function SessionAliasProvider({ userId, children }: PropsWithChildren<{ userId: string | null }>) {
	const aliasesRef = useRef(new Map<string, string>())

	useEffect(() => {
		aliasesRef.current = new Map()
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- userId is the trigger: aliases from the previous session must not resolve for the next one.
	}, [userId])

	const value = useMemo<SessionAliasRegistry>(
		() => ({
			resolve: (id) => aliasesRef.current.get(id) ?? id,
			register: (fakeId, realId) => {
				aliasesRef.current.set(fakeId, realId)
			},
			clear: () => {
				aliasesRef.current.clear()
			}
		}),
		[]
	)

	return <SessionAliasContext.Provider value={value}>{children}</SessionAliasContext.Provider>
}
export function useOptionalSessionAliases() {
	return useContext(SessionAliasContext)
}
