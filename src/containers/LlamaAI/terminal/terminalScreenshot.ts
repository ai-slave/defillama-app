import { AI_SERVER } from '~/constants'
import { getTerminalViewOpen, getTerminalWidget, type TerminalWidget } from './terminalViewStore'

export interface TerminalRequestPayload {
	requestId: string
	kind: string
	expiresAt?: number
}

type TerminalRequestErrorCode =
	| 'terminal_closed'
	| 'widget_not_ready'
	| 'chart_not_ready'
	| 'capture_failed'
	| 'encode_failed'

// The server gives up after 25s; failing fast keeps the agent's turn moving.
const CAPTURE_BUDGET_MS = 6000
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

// Resumed streams replay buffered events, so the same request arrives more than once.
const handled = new Set<string>()

class CaptureError extends Error {
	readonly code: TerminalRequestErrorCode

	constructor(code: TerminalRequestErrorCode) {
		super(code)
		this.code = code
	}
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal, code: TerminalRequestErrorCode): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => {
			if (signal.aborted) {
				reject(new CaptureError(code))
				return
			}
			signal.addEventListener('abort', () => reject(new CaptureError(code)), { once: true })
		})
	])
}

// dataReady is level-triggered, so it also settles when the data is already loaded. Two frames after
// it is what separates a painted chart from a blank one.
async function waitForChart(widget: TerminalWidget, signal: AbortSignal) {
	try {
		const chart = widget.activeChart()
		await abortable(
			new Promise<void>((resolve) => {
				chart.dataReady(() => resolve())
			}),
			signal,
			'chart_not_ready'
		)
		await abortable(
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			}),
			signal,
			'chart_not_ready'
		)
	} catch (error) {
		throw error instanceof CaptureError ? error : new CaptureError('chart_not_ready')
	}
}

async function captureChart(signal: AbortSignal): Promise<Blob> {
	if (!getTerminalViewOpen()) throw new CaptureError('terminal_closed')
	const widget = getTerminalWidget()
	if (!widget) throw new CaptureError('widget_not_ready')
	await waitForChart(widget, signal)
	const canvas = await abortable(widget.takeClientScreenshot(), signal, 'capture_failed')
	const blob = await abortable(
		new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, 'image/png')
		}),
		signal,
		'encode_failed'
	)
	// PNG keeps thin study lines and axis text clean; measured chart JPEGs are both larger and ringed.
	if (!blob || blob.size === 0 || blob.size > MAX_IMAGE_BYTES) throw new CaptureError('encode_failed')
	return blob
}

export async function respondToTerminalRequest(
	request: TerminalRequestPayload,
	sessionId: string,
	fetchFn: typeof fetch
) {
	if (request.kind !== 'screenshot' || !sessionId || handled.has(request.requestId)) return
	handled.add(request.requestId)

	const controller = new AbortController()
	const budget = setTimeout(() => controller.abort(), CAPTURE_BUDGET_MS)
	let body: Blob | string
	try {
		body = await captureChart(controller.signal)
	} catch (error) {
		body = JSON.stringify({ error: error instanceof CaptureError ? error.code : 'capture_failed' })
	} finally {
		clearTimeout(budget)
	}

	// Exactly one POST either way: a silent client leaves the agent waiting out the server timeout.
	const url = `${AI_SERVER}/agentic/terminal/chart-image/${encodeURIComponent(sessionId)}/${encodeURIComponent(request.requestId)}`
	const response = await fetchFn(url, {
		method: 'POST',
		headers: { 'Content-Type': typeof body === 'string' ? 'application/json' : 'application/octet-stream' },
		body
	}).catch(() => null)
	// A replayed request is already resolved server-side; nothing here is retryable.
	if (response && !response.ok) console.debug('[llama-ai] [terminal] screenshot not delivered:', response.status)
}
