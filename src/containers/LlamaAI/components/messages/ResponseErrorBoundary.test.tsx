// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import type { ChartConfiguration } from '../../chartTypes'
import type { Message } from '../../types'

vi.mock('~/auth', () => ({ useAuthContext: () => ({ user: null }) }))
vi.mock('../../hooks/useLlamaAISettings', () => ({
	useLlamaAISetting: () => false,
	useAdvancedProvenance: () => false
}))
vi.mock('../ImagePreviewModal', () => ({ ImagePreviewModal: () => null }))
vi.mock('../PastedContentModal', () => ({ PastedContentModal: () => null }))
vi.mock('../../reportChatError', async (original) => ({
	...(await original<typeof import('../../reportChatError')>()),
	reportChatError: vi.fn()
}))
vi.mock('../markdown/mendStreamingMarkdown', async (original) => {
	const actual = await original<typeof import('../markdown/mendStreamingMarkdown')>()
	return {
		mendStreamingMarkdown: (...args: Parameters<typeof actual.mendStreamingMarkdown>) => {
			// Exercise the real renderer's failure path even after the parser-position bug is fixed.
			if (args[0] === '[https://example.com/a') throw new TypeError('Missing Markdown source position')
			return actual.mendStreamingMarkdown(...args)
		}
	}
})
vi.mock('../charts/ChartRenderer', () => ({
	get ChartRenderer() {
		throw Object.assign(new Error('Failed to load chunk /_next/static/chunks/chart.js'), { name: 'ChunkLoadError' })
	}
}))

import { reportChatError } from '../../reportChatError'
import { MessageBubble } from './MessageBubble'

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

test.each(['chart', 'markdown'] as const)(
	'contains a %s failure while preserving other messages and the composer',
	async (kind) => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
		const host = document.createElement('div')
		document.body.append(host)
		const root = createRoot(host)
		let clicks = 0
		const render = (message: Message) =>
			root.render(
				<>
					<MessageBubble
						message={{ id: 'healthy', role: 'assistant', content: 'Earlier answer' }}
						sessionId="session"
						hideControls
						hideTimeline
					/>
					<MessageBubble
						message={message}
						sessionId="session"
						isDraft={kind === 'markdown' && message.id === 'failed'}
						hideControls
						hideTimeline
					/>
					<textarea aria-label="Prompt" defaultValue="Unsent draft" />
					<button type="button" onClick={() => clicks++}>
						Send
					</button>
				</>
			)
		try {
			await act(async () => render({ id: 'failed', role: 'assistant', content: 'Before failure' }))
			const composer = host.querySelector('textarea')!
			await act(async () =>
				render({
					id: 'failed',
					role: 'assistant',
					content: kind === 'chart' ? '<!-- LLAMA_ARTIFACT:CHART:chart-1 -->' : '[https://example.com/a',
					...(kind === 'chart' ? { charts: [{ charts: [chart], chartData: { 'chart-1': [] } }] } : {})
				})
			)
			expect(host.textContent).toContain('This response couldn’t be displayed.')
			expect(host.textContent).toContain('Earlier answer')
			expect(host.querySelector('textarea')).toBe(composer)
			expect(composer.value).toBe('Unsent draft')
			expect(reload).not.toHaveBeenCalled()
			expect(reportChatError).toHaveBeenCalledWith(expect.any(Error), 'render', expect.any(String))
			expect(host.textContent).toContain(
				kind === 'chart' ? 'Part of the page failed to load.' : 'You can continue chatting'
			)
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
			consoleError.mockRestore()
		}
	}
)
