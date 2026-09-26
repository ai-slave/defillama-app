const CHAT_PATH = '/ai/chat'
export const TERMINAL_PATH = '/ai/terminal'

export const isTerminalPath = (pathname: string) =>
	pathname === TERMINAL_PATH || pathname.startsWith(`${TERMINAL_PATH}/`)

export const toTerminalPath = (href: string) => href.replace(/^\/ai\/chat(?=$|[/?#])/, TERMINAL_PATH)

const passThroughQuery = (params: URLSearchParams) => {
	const kept = new URLSearchParams(params)
	kept.delete('symbol')
	kept.delete('view')
	const query = kept.toString()
	return query ? `?${query}` : ''
}

export function terminalAccessRedirect(
	asPath: string,
	user: { collectionId?: string; flags?: { is_llama?: boolean } } | null
): string | null {
	const url = new URL(asPath, 'http://localhost')
	if (!user?.collectionId || user.flags?.is_llama || !isTerminalPath(url.pathname)) return null
	return `${CHAT_PATH}${url.pathname.slice(TERMINAL_PATH.length)}${passThroughQuery(url.searchParams)}${url.hash}`
}

export const chatSessionUrl = (sessionId: string, terminalSymbol: string | null | undefined, hash = '') =>
	`${terminalSymbol ? TERMINAL_PATH : CHAT_PATH}/${sessionId}${hash}`

export const terminalEntryUrl = (symbol?: string | null) =>
	symbol ? `${TERMINAL_PATH}?${new URLSearchParams({ symbol })}` : TERMINAL_PATH

export function legacyTerminalRedirect(pathname: string, searchParams: URLSearchParams): string | null {
	if (searchParams.get('view') !== 'terminal') return null
	if (pathname === CHAT_PATH) {
		const entry = terminalEntryUrl(searchParams.get('symbol'))
		const rest = passThroughQuery(searchParams).slice(1)
		return rest ? `${entry}${entry === TERMINAL_PATH ? '?' : '&'}${rest}` : entry
	}
	const sessionId = /^\/ai\/chat\/([^/]+)$/.exec(pathname)?.[1]
	return sessionId && sessionId !== 'shared' ? `${TERMINAL_PATH}/${sessionId}${passThroughQuery(searchParams)}` : null
}

// Conversation pages stay static so client navigation needs no build-bound data request,
// which leaves rejecting paths past the session ID to the proxy.
export const isExtraConversationPath = (pathname: string) =>
	/^\/ai\/(?:chat|terminal)\/[^/]+\/./.test(pathname) && !/^\/ai\/chat\/shared\/[^/]+$/.test(pathname)

export function terminalEntryFromUrl(asPath: string): { symbol?: string; cleanUrl?: string } {
	const url = new URL(asPath, 'http://localhost')
	if (!isTerminalPath(url.pathname) || (!url.searchParams.has('symbol') && !url.searchParams.has('view'))) return {}
	const symbol = url.pathname === TERMINAL_PATH ? url.searchParams.get('symbol') || undefined : undefined
	return { symbol, cleanUrl: `${url.pathname}${passThroughQuery(url.searchParams)}${url.hash}` }
}
