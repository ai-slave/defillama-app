import { createContext, type PropsWithChildren, useMemo, useState } from 'react'

interface SessionAliasRegistry {
	resolve: (id: string) => string
	register: (fakeId: string, realId: string) => void
	clear: () => void
}

export const SessionAliasContext = createContext<SessionAliasRegistry | null>(null)

export function SessionAliasProvider({ userId, children }: PropsWithChildren<{ userId: string | null }>) {
	// Aliases belong to one signed-in user: the next user starts with an empty map in the same render, before any
	// child resolves or registers against it. A key would remount the whole chat page, so the map is swapped here.
	const [session, setSession] = useState(() => ({ userId, aliases: new Map<string, string>() }))
	if (session.userId !== userId) setSession({ userId, aliases: new Map() })
	const { aliases } = session

	// The map is mutated in place: registering an alias must not re-render the chat.
	const value = useMemo<SessionAliasRegistry>(
		() => ({
			resolve: (id) => aliases.get(id) ?? id,
			register: (fakeId, realId) => {
				aliases.set(fakeId, realId)
			},
			clear: () => {
				aliases.clear()
			}
		}),
		[aliases]
	)

	return <SessionAliasContext.Provider value={value}>{children}</SessionAliasContext.Provider>
}
