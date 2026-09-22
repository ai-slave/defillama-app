import { AI_SERVER } from '~/constants'
import {
	applyTerminalOps,
	forgetTerminalScripts,
	holdTerminalOps,
	normalizeTerminalChatState,
	readTerminalChatState,
	releaseTerminalOps,
	resetTerminalDrawings,
	restoreTerminalChatState,
	restoreTerminalDrawings,
	terminalSymbolOf,
	type TerminalOpsPayload
} from './terminalOps'

const CHAT_STATE_URL = `${AI_SERVER}/terminal/chat-state`
const SAVE_DELAY_MS = 1000

let saveFetch: typeof fetch | null = null
let session: string | null = null
let writable = false
let loading = false
let loads = 0
let timer: ReturnType<typeof setTimeout> | null = null
let sent: string | null = null
let saving: Promise<void> = Promise.resolve()

const urlFor = (sessionId: string) => `${CHAT_STATE_URL}/${encodeURIComponent(sessionId)}`

function saveNow(keepalive: boolean) {
	if (!saveFetch || !session || !writable || loading) return
	const body = JSON.stringify({ state: readTerminalChatState() })
	if (body === sent) return
	sent = body
	const retry = () => {
		if (sent === body) sent = null
	}
	saving = saveFetch(urlFor(session), {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body,
		keepalive
	}).then((response) => {
		if (!response.ok) retry()
	}, retry)
}

export function scheduleTerminalChatSave() {
	if (!saveFetch || !session || !writable || loading) return
	if (timer !== null) clearTimeout(timer)
	timer = setTimeout(() => {
		timer = null
		saveNow(false)
	}, SAVE_DELAY_MS)
}

export function flushTerminalChatSave(keepalive = false): Promise<void> {
	if (timer !== null) {
		clearTimeout(timer)
		timer = null
		saveNow(keepalive)
	}
	return saving
}

export function startTerminalChatSaving(fetchFn: typeof fetch): () => void {
	saveFetch = fetchFn
	const onPageHide = () => void flushTerminalChatSave(true)
	window.addEventListener('pagehide', onPageHide)
	return () => {
		window.removeEventListener('pagehide', onPageHide)
		void flushTerminalChatSave(true)
		saveFetch = null
	}
}

export function bindTerminalChatSession(sessionId: string) {
	if (sessionId === session) return
	if (session === null) writable = true
	session = sessionId
	sent = null
	scheduleTerminalChatSave()
}

export function resetTerminalChat() {
	void flushTerminalChatSave()
	loads++
	session = null
	writable = false
	loading = false
	sent = null
	releaseTerminalOps()
	forgetTerminalScripts()
	resetTerminalDrawings()
}

async function fetchSnapshot(sessionId: string, fetchFn: typeof fetch) {
	const response = await fetchFn(urlFor(sessionId))
	if (!response.ok) throw new Error(`chat state ${response.status}`)
	const data = await response.json()
	return normalizeTerminalChatState(data?.state)
}

export async function loadTerminalChatState(
	sessionId: string,
	messages: Array<{ terminalOps?: TerminalOpsPayload }>,
	fetchFn: typeof fetch,
	fallbackSymbol: string | null
): Promise<string | null> {
	const flushed = flushTerminalChatSave()
	const load = ++loads
	session = sessionId
	writable = false
	loading = true
	sent = null
	holdTerminalOps()
	forgetTerminalScripts()
	resetTerminalDrawings()
	const loaded = await flushed
		.then(() => fetchSnapshot(sessionId, fetchFn))
		.then(
			(state) => ({ ok: true, state }),
			() => ({ ok: false, state: null })
		)
	if (load !== loads) return null
	if (loaded.state) restoreTerminalChatState(loaded.state)
	else restoreTerminalDrawings(messages)
	writable = loaded.ok
	loading = false
	for (const payload of releaseTerminalOps()) applyTerminalOps(payload)
	if (loaded.ok && !loaded.state) saveNow(false)
	return loaded.state?.symbol ?? terminalSymbolOf(messages) ?? fallbackSymbol
}
