// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AgenticSessionItem } from '../AgenticSessionItem'

const auth = vi.hoisted(() => ({ user: { id: 'user', flags: { is_llama: false } } }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ user: auth.user, authorizedFetch: vi.fn() }) }))
vi.mock('~/containers/LlamaAI/chrome', () => ({ useLlamaAIChrome: () => ({ hideSidebar: vi.fn() }) }))
vi.mock('~/containers/LlamaAI/hooks/useClearUnseenCompletion', () => ({ useClearUnseenCompletion: () => vi.fn() }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

async function renderChartChat(isLlama: boolean) {
	auth.user = { id: 'user', flags: { is_llama: isLlama } }
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<AgenticSessionItem
					session={{
						sessionId: 'abc',
						title: 'HYPE levels',
						createdAt: '2026-09-21',
						lastActivity: '2026-09-21',
						isActive: false,
						isPinned: false,
						terminalSymbol: 'HYPE'
					}}
					isActive={false}
					onSessionSelect={vi.fn()}
					onDelete={vi.fn()}
					isRestoring={false}
				/>
			</QueryClientProvider>
		)
	)
	const open = vi.spyOn(window, 'open').mockImplementation(() => null)
	const row = container.querySelector<HTMLButtonElement>('button')!
	await act(async () => row.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true })))
	return { chartMark: container.querySelector('[aria-label="Terminal chart, HYPE"]'), opened: open.mock.calls[0]?.[0] }
}

test('a user without the terminal sees a chart chat as a plain chat and opens it under /ai/chat', async () => {
	const { chartMark, opened } = await renderChartChat(false)
	expect(chartMark).toBeNull()
	expect(opened).toBe('/ai/chat/abc')
})

test('a llama user sees the chart mark and opens the chat in the terminal', async () => {
	const { chartMark, opened } = await renderChartChat(true)
	expect(chartMark).not.toBeNull()
	expect(opened).toBe('/ai/terminal/abc')
})
