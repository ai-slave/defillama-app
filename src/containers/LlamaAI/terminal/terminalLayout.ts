import { AI_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { isAgentTicker, readSymbolInput } from './terminalData'

const LAYOUT_URL = `${AI_SERVER}/terminal/layout`

interface LayoutSource {
	state?: { inputs?: Record<string, unknown> }
}

interface LayoutPane {
	sources?: Array<LayoutSource>
}

function isAgentSeries(source: LayoutSource): boolean {
	const inputs = source?.state?.inputs
	if (!inputs) return false
	// A study has no `disableSave`, so the only way to keep an agent series out of the saved layout
	// is to take it out of the state before it is stored.
	return Object.values(inputs).some((value) => isAgentTicker(readSymbolInput(value)))
}

/**
 * Returns a copy without the agent's own series, and without any pane they left empty. Restoring
 * one would paint a dead pane next to whatever the chat replay draws for real.
 */
export function stripAgentSeries<T>(state: T): T {
	const copy = JSON.parse(JSON.stringify(state)) as { charts?: Array<{ panes?: Array<LayoutPane> }> }
	for (const chart of copy.charts ?? []) {
		chart.panes = (chart.panes ?? [])
			.map((pane) => ({ ...pane, sources: (pane.sources ?? []).filter((source) => !isAgentSeries(source)) }))
			.filter((pane) => pane.sources.length > 0)
	}
	return copy as T
}

export interface SavableTerminalWidget {
	save: (callback: (state: object) => void) => void
	subscribe: (event: 'onAutoSaveNeeded', callback: () => void) => void
}

// The widget is rebuilt whenever the theme changes, and the last save may still be in flight, so
// the state this tab already produced outranks whatever the server can answer with.
interface TerminalLayoutSession {
	userId: string
	layout: object | null
	controller: AbortController
}

let activeSession: TerminalLayoutSession | null = null

function syncLayoutSession() {
	const userId = pb.authStore.isValid ? pb.authStore.record?.id : null
	if (activeSession?.userId === userId) return
	if (activeSession) {
		activeSession.layout = null
		activeSession.controller.abort()
	}
	activeSession = userId ? { userId, layout: null, controller: new AbortController() } : null
}

// Invalidate before React cleanup can flush an old widget using the next account's token.
if (typeof window !== 'undefined') pb.authStore.onChange(syncLayoutSession)

export function getTerminalLayoutSession(userId: string): TerminalLayoutSession | null {
	syncLayoutSession()
	return activeSession?.userId === userId ? activeSession : null
}

export async function fetchTerminalLayout(
	session: TerminalLayoutSession,
	fetchFn: typeof fetch
): Promise<object | null> {
	if (getTerminalLayoutSession(session.userId) !== session) return null
	if (session.layout) return session.layout
	try {
		const res = await fetchFn(LAYOUT_URL, { signal: session.controller.signal })
		if (!res.ok) return null
		const data = await res.json()
		const layout = data?.layout
		if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return null
		if (getTerminalLayoutSession(session.userId) !== session) return null
		// A save made while the GET was in flight is newer than the server's answer.
		session.layout ??= layout
		return session.layout
	} catch {
		// A chart that loads with its default layout beats a chart that does not load.
		return null
	}
}

/**
 * The library throttles `onAutoSaveNeeded` to a trailing edge and `save()` inside the handler
 * always reflects the current chart, so this needs no debounce of its own. Agent drawings carry
 * `disableUndo`, which never raises the event, and `disableSave`, which keeps them out of the
 * state — they stay in the replay channel where they belong.
 */
export function startTerminalLayoutAutoSave(
	session: TerminalLayoutSession,
	widget: SavableTerminalWidget,
	fetchFn: typeof fetch
): () => void {
	let sent: string | null = null

	const put = (raw: object, keepalive: boolean) => {
		if (getTerminalLayoutSession(session.userId) !== session) return
		const state = stripAgentSeries(raw)
		const body = JSON.stringify({ layout: state })
		if (body === sent) return
		sent = body
		session.layout = state
		fetchFn(LAYOUT_URL, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body,
			signal: session.controller.signal,
			keepalive
		}).catch(() => {
			// Let the next event retry instead of treating a failed write as stored.
			sent = null
		})
	}

	// A widget torn down before the disposer runs throws from inside save(), which would both lose
	// this flush and abort the caller's cleanup before it reaches widget.remove().
	const save = (keepalive: boolean) => {
		if (getTerminalLayoutSession(session.userId) !== session) return
		try {
			widget.save((state) => put(state, keepalive))
		} catch {
			// Nothing to flush from a chart that is already gone.
		}
	}
	const onAutoSave = () => save(false)
	// A change made inside the throttle window has no event left to carry it, so leaving the page
	// has to take the current state with it.
	const onPageHide = () => save(true)

	widget.subscribe('onAutoSaveNeeded', onAutoSave)
	window.addEventListener('pagehide', onPageHide)

	return () => {
		window.removeEventListener('pagehide', onPageHide)
		save(true)
	}
}
