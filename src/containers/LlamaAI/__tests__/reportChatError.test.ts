// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { installUmamiSink } from '~/utils/testing/umamiSink'

const track = installUmamiSink()

// reportChatError dedupes per page in module state, so each test loads a fresh module.
async function loadReporter() {
	vi.resetModules()
	return (await import('../reportChatError')).reportChatError
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {})
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
	vi.restoreAllMocks()
})

test('reports code locations and build/browser details once, without exception values, URL parameters or message contents', async () => {
	const reportChatError = await loadReporter()
	const error = new TypeError('Cannot render private response')
	error.stack =
		'TypeError: private response\n    at Chart (https://defillama.com/_next/static/chunks/chart.js:1:42?token=private-token)'
	reportChatError(error, 'render', '\n    at Chart (https://defillama.com/_next/static/chunks/chart.js:1:42)')
	reportChatError(error, 'render', '\n    at Chart (https://defillama.com/_next/static/chunks/chart.js:1:42)')

	expect(track.mock.calls).toEqual([
		[
			'llamaai-client-error',
			{
				phase: 'render',
				kind: 'exception',
				name: 'TypeError',
				reactCode: '',
				stack: '/_next/static/chunks/chart.js:1:42',
				components: 'Chart',
				chunk: '',
				buildId: 'build-a',
				route: '/ai/chat/[sessionId]',
				browser: navigator.userAgent
			}
		]
	])
})

test('captures a failed chunk path and sends it once analytics becomes ready', async () => {
	const reportChatError = await loadReporter()
	const sdk = window.umami
	window.umami = undefined
	const error = Object.assign(
		new Error('Failed to load chunk https://defillama.com/_next/static/chunks/a.js?token=secret'),
		{ name: 'ChunkLoadError' }
	)
	reportChatError(error, 'render', '')
	expect(track).not.toHaveBeenCalled()

	window.umami = sdk
	window.dispatchEvent(new Event(UMAMI_READY_EVENT))
	window.dispatchEvent(new Event(UMAMI_READY_EVENT))
	expect(track).toHaveBeenCalledExactlyOnceWith(
		'llamaai-client-error',
		expect.objectContaining({ kind: 'chunk-load', chunk: '/_next/static/chunks/a.js' })
	)
	expect(JSON.stringify(track.mock.calls)).not.toContain('secret')
})

test('reports a minified React code without the embedded decoder arguments', async () => {
	const reportChatError = await loadReporter()
	reportChatError(new Error('Minified React error #31; visit https://react.dev/errors/31?args[]=private'), 'render', '')
	expect(track).toHaveBeenCalledWith('llamaai-client-error', expect.objectContaining({ reactCode: '31' }))
	expect(JSON.stringify(track.mock.calls)).not.toContain('private')
})

test('keeps Safari-style stack frames without sending exception text', async () => {
	const reportChatError = await loadReporter()
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
