// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import type { ChartConfiguration } from '../../../chartTypes'
import type { Message } from '../../../types'

// Heavy children these messages never open.
vi.mock('../../ImagePreviewModal', () => ({ ImagePreviewModal: () => null }))
vi.mock('../../PastedContentModal', () => ({ PastedContentModal: () => null }))
// A chart chunk that fails to load, as a deploy mid-session produces.
vi.mock('../../charts/ChartRenderer', () => ({
	get ChartRenderer() {
		throw Object.assign(new Error('Failed to load chunk /_next/static/chunks/chart.js'), { name: 'ChunkLoadError' })
	}
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { MessageBubble } from '../MessageBubble'
import { ResponseErrorBoundary } from '../ResponseErrorBoundary'

const umami = installUmamiSink()

const chart = {
	id: 'chart-1',
	type: 'line',
	title: 'TVL',
	description: '',
	axes: { x: { field: 'date', label: 'Date', type: 'time' }, yAxes: [] },
	series: [],
	dataTransformation: { timeField: 'date', metrics: [] }
} satisfies ChartConfiguration

afterEach(() => vi.restoreAllMocks())

test('contains a chart chunk failure while preserving other messages and the composer', async () => {
	const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
	const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
	const host = document.createElement('div')
	document.body.append(host)
	const root = createRoot(host)
	let clicks = 0
	const client = new QueryClient()
	const nextData = document.createElement('script')
	nextData.id = '__NEXT_DATA__'
	nextData.textContent = JSON.stringify({ buildId: 'build-1', page: '/ai/chat/[[...sessionId]]' })
	document.body.append(nextData)
	const render = (message: Message) =>
		root.render(
			<QueryClientProvider client={client}>
				<MessageBubble
					message={{ id: 'healthy', role: 'assistant', content: 'Earlier answer' }}
					sessionId="session"
					hideControls
					hideTimeline
				/>
				<MessageBubble message={message} sessionId="session" hideControls hideTimeline />
				<textarea aria-label="Prompt" defaultValue="Unsent draft" />
				<button type="button" onClick={() => clicks++}>
					Send
				</button>
			</QueryClientProvider>
		)
	try {
		await act(async () => render({ id: 'failed', role: 'assistant', content: 'Before failure' }))
		const composer = host.querySelector('textarea')!
		await act(async () =>
			render({
				id: 'failed',
				role: 'assistant',
				content: '<!-- LLAMA_ARTIFACT:CHART:chart-1 -->',
				charts: [{ charts: [chart], chartData: { 'chart-1': [] } }]
			})
		)
		expect(host.textContent).toContain('This response couldn’t be displayed.')
		expect(host.textContent).toContain('Earlier answer')
		expect(host.querySelector('textarea')).toBe(composer)
		expect(composer.value).toBe('Unsent draft')
		expect(reload).not.toHaveBeenCalled()
		expect(umami.mock.calls).toEqual([
			[
				'llamaai-client-error',
				expect.objectContaining({
					phase: 'render',
					kind: 'chunk-load',
					buildId: 'build-1'
				})
			]
		])
		expect(host.textContent).toContain('Part of the page failed to load.')
		await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Send')!.click())
		expect(clicks).toBe(1)
		await act(async () => host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
		expect(reload).toHaveBeenCalledOnce()
		// A genuinely new response gets a fresh boundary, not the previous response's fallback.
		await act(async () => render({ id: 'next-response', role: 'assistant', content: 'New answer' }))
		expect(host.querySelector('[role="alert"]')).toBeNull()
		expect(host.textContent).toContain('New answer')
	} finally {
		await act(async () => root.unmount())
		host.remove()
		nextData.remove()
		client.clear()
		consoleError.mockRestore()
	}
})

function Throws(): never {
	throw new TypeError('Cannot read properties of undefined')
}

test('an ordinary render exception offers to keep chatting instead of the failed-download copy', async () => {
	const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
	const host = document.createElement('div')
	const root = createRoot(host)
	await act(async () =>
		root.render(
			<>
				<ResponseErrorBoundary>
					<Throws />
				</ResponseErrorBoundary>
				<p>Composer</p>
			</>
		)
	)
	expect(host.querySelector('[role="alert"]')!.textContent).toBe(
		'This response couldn’t be displayed.You can continue chatting, or reload to try displaying this response again.Reload page'
	)
	expect(host.textContent).toContain('Composer')
	await act(async () => root.unmount())
	consoleError.mockRestore()
})
