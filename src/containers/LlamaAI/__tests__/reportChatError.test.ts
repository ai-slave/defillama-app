// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const track = vi.hoisted(() => vi.fn())
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: track, UMAMI_READY_EVENT: 'umami-ready' }))

beforeEach(() => {
	vi.resetModules()
	track.mockClear()
	vi.spyOn(console, 'error').mockImplementation(() => {})
	window.umami = { track: vi.fn(), identify: vi.fn() }
	const script = document.createElement('script')
	script.id = '__NEXT_DATA__'
	script.textContent = JSON.stringify({
		buildId: 'build-a',
		page: '/ai/chat/[sessionId]',
		props: { prompt: 'private prompt' }
	})
	document.body.append(script)
})
afterEach(() => {
	document.getElementById('__NEXT_DATA__')?.remove()
	delete window.umami
	vi.restoreAllMocks()
})

test('reports code locations and build/browser details without exception values, URL parameters or message contents', async () => {
	const { reportChatError } = await import('../reportChatError')
	const error = new TypeError('Cannot render private response')
	error.stack =
		'TypeError: private response\n    at Chart (https://defillama.com/_next/static/chunks/chart.js:1:42?token=private-token)'
	reportChatError(error, 'render', '\n    at Chart (https://defillama.com/_next/static/chunks/chart.js:1:42)')
	expect(track).toHaveBeenCalledWith(
		'llamaai-client-error',
		expect.objectContaining({
			name: 'TypeError',
			kind: 'exception',
			phase: 'render',
			buildId: 'build-a',
			route: '/ai/chat/[sessionId]',
			stack: '/_next/static/chunks/chart.js:1:42',
			components: 'Chart',
			browser: navigator.userAgent
		})
	)
	expect(JSON.stringify(track.mock.calls)).not.toContain('private')
	reportChatError(error, 'render', '\n    at Chart (https://defillama.com/_next/static/chunks/chart.js:1:42)')
	expect(track).toHaveBeenCalledOnce()
})

test('captures a failed chunk path, waits for analytics readiness, and sends only once', async () => {
	delete window.umami
	const { reportChatError } = await import('../reportChatError')
	const error = Object.assign(
		new Error('Failed to load chunk https://defillama.com/_next/static/chunks/a.js?token=secret'),
		{ name: 'ChunkLoadError' }
	)
	reportChatError(error, 'render', '')
	expect(track).not.toHaveBeenCalled()
	window.dispatchEvent(new Event('umami-ready'))
	window.dispatchEvent(new Event('umami-ready'))
	expect(track).toHaveBeenCalledExactlyOnceWith(
		'llamaai-client-error',
		expect.objectContaining({ kind: 'chunk-load', chunk: '/_next/static/chunks/a.js' })
	)
	expect(JSON.stringify(track.mock.calls)).not.toContain('secret')
})

test('reports a minified React code without the embedded decoder arguments', async () => {
	const { reportChatError } = await import('../reportChatError')
	reportChatError(new Error('Minified React error #31; visit https://react.dev/errors/31?args[]=private'), 'render', '')
	expect(track).toHaveBeenCalledWith('llamaai-client-error', expect.objectContaining({ reactCode: '31' }))
	expect(JSON.stringify(track.mock.calls)).not.toContain('private')
})

test('reporting failures cannot throw into the response fallback', async () => {
	const { reportChatError } = await import('../reportChatError')
	track.mockImplementationOnce(() => {
		throw new Error('Reporting failed')
	})
	expect(() => reportChatError(new Error('Render failed'), 'render', '')).not.toThrow()
})

test('keeps the first Safari-style stack frame without sending exception text', async () => {
	const { reportChatError } = await import('../reportChatError')
	const error = new TypeError('private response')
	error.stack =
		'render@https://defillama.com/_next/static/chunks/safari.js:1:12\nnext@https://defillama.com/_next/static/chunks/safari.js:2:34'
	reportChatError(error, 'render', 'Chart@https://defillama.com/_next/static/chunks/safari.js:1:12')
	expect(track).toHaveBeenCalledWith(
		'llamaai-client-error',
		expect.objectContaining({
			stack: '/_next/static/chunks/safari.js:1:12\n/_next/static/chunks/safari.js:2:34',
			components: 'Chart'
		})
	)
	expect(JSON.stringify(track.mock.calls)).not.toContain('private')
})
