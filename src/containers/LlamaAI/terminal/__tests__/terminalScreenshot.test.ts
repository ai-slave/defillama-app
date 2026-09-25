// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { respondToTerminalRequest } from '../terminalScreenshot'
import { setTerminalViewOpen, setTerminalWidget, type TerminalWidget } from '../terminalViewStore'

/**
 * The server waits 25s for exactly one POST per request id, and a resumed stream replays the ask.
 * These cases pin the two halves of that contract: one POST per request id, and a POST even when
 * there is nothing to capture.
 */

function fakeCanvas(): HTMLCanvasElement {
	return {
		toBlob: (callback: BlobCallback) => callback(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }))
	} as unknown as HTMLCanvasElement
}

function fakeWidget(takeClientScreenshot: () => Promise<HTMLCanvasElement>) {
	return {
		onChartReady: () => undefined,
		activeChart: () => ({ dataReady: (callback: () => void) => (callback(), true) }),
		takeClientScreenshot,
		remove: () => undefined
	} as unknown as TerminalWidget
}

function okFetch() {
	return vi.fn(async () => new Response(JSON.stringify({ delivered: true }), { status: 200 }))
}

async function bodyOf(call: [unknown, RequestInit | undefined]) {
	const body = call[1]?.body
	return typeof body === 'string' ? body : body instanceof Blob ? await body.text() : null
}

afterEach(() => {
	setTerminalWidget(null)
	setTerminalViewOpen(false)
})

describe('respondToTerminalRequest', () => {
	test('answers a screenshot once, even when the stream replays the request', async () => {
		const takeClientScreenshot = vi.fn(async () => fakeCanvas())
		setTerminalViewOpen(true)
		setTerminalWidget(fakeWidget(takeClientScreenshot))
		const fetchFn = okFetch()
		const request = { requestId: 'scr_abc12345_replayed', kind: 'screenshot', expiresAt: Date.now() + 25_000 }

		await respondToTerminalRequest(request, 'session-1', fetchFn as unknown as typeof fetch)
		await respondToTerminalRequest(request, 'session-1', fetchFn as unknown as typeof fetch)

		expect(fetchFn).toHaveBeenCalledOnce()
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
		expect(url).toBe(`${AI_SERVER}/agentic/terminal/chart-image/session-1/scr_abc12345_replayed`)
		expect(init.method).toBe('POST')
		expect(new Headers(init.headers).get('content-type')).toBe('application/octet-stream')
		expect(init.body).toBeInstanceOf(Blob)
		expect(takeClientScreenshot).toHaveBeenCalledOnce()
	})

	test('reports a closed terminal without reaching for the widget', async () => {
		const takeClientScreenshot = vi.fn(async () => fakeCanvas())
		setTerminalWidget(fakeWidget(takeClientScreenshot))
		const fetchFn = okFetch()

		await respondToTerminalRequest(
			{ requestId: 'scr_abc12345_closed', kind: 'screenshot' },
			'session-1',
			fetchFn as unknown as typeof fetch
		)

		expect(takeClientScreenshot).not.toHaveBeenCalled()
		expect(fetchFn).toHaveBeenCalledOnce()
		const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
		expect(new Headers(init.headers).get('content-type')).toBe('application/json')
		expect(await bodyOf(fetchFn.mock.calls[0] as never)).toBe(JSON.stringify({ error: 'terminal_closed' }))
	})

	test('still posts one error when the capture throws', async () => {
		setTerminalViewOpen(true)
		setTerminalWidget(
			fakeWidget(() => {
				throw new Error('screenshot unavailable')
			})
		)
		const fetchFn = okFetch()

		await respondToTerminalRequest(
			{ requestId: 'scr_abc12345_threw', kind: 'screenshot' },
			'session-1',
			fetchFn as unknown as typeof fetch
		)

		expect(fetchFn).toHaveBeenCalledOnce()
		expect(await bodyOf(fetchFn.mock.calls[0] as never)).toBe(JSON.stringify({ error: 'capture_failed' }))
	})
})
