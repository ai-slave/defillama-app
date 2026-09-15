// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { AgenticSidebar } from '../AgenticSidebar'
const api = vi.hoisted(() => ({ fetch: vi.fn(), bulk: vi.fn(), open: vi.fn(), balance: null as object | null }))
const viewport = vi.hoisted(() => ({ scroll: (_offset: number, _isScrolling: boolean) => {} }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		user: { id: 'user' },
		authorizedFetch: api.fetch,
		isAuthenticated: true,
		hasActiveSubscription: true
	})
}))
vi.mock('~/containers/LlamaAI/chrome', () => ({
	useLlamaAIChrome: () => ({ hideSidebar: vi.fn(), toggleSidebar: vi.fn() })
}))
vi.mock('~/containers/Subscription/useTopup', () => ({
	useAiBalance: () => ({ balance: api.balance, totalAvailable: 0.75 })
}))
vi.mock('~/containers/LlamaAI/projects/ProjectsSidebarSection', () => ({ ProjectsSidebarSection: () => null }))
vi.mock('~/containers/LlamaAI/projects/MoveToProjectMenu', () => ({ MoveToProjectMenuItem: () => null }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
vi.mock('@tanstack/react-virtual', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@tanstack/react-virtual')>()
	return {
		...actual,
		useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) =>
			actual.useVirtualizer({
				...options,
				// happy-dom has no layout. Supply only viewport measurements; retain real virtualized items.
				observeElementRect: (_, callback) => {
					callback({ width: 272, height: 600 })
					return () => {}
				},
				observeElementOffset: (_, callback) => {
					viewport.scroll = callback
					callback(0, false)
					return () => {}
				}
			})
	}
})
let root: Root
let container: HTMLDivElement
let client: QueryClient
const sessions: Array<ChatSession> = ['Alpha', 'Beta', 'Gamma'].map((title) => ({
	sessionId: title,
	title,
	isActive: false,
	createdAt: '2026-09-07',
	lastActivity: '2026-09-07'
}))
beforeEach(() => {
	vi.resetAllMocks()
	api.balance = null
	api.fetch.mockResolvedValue(new Response(JSON.stringify({ results: [] })))
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	vi.useRealTimers()
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
async function render(items = sessions, options: { showBalance?: boolean; onOpenBalanceSettings?: () => void } = {}) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AgenticSidebar
					sessions={items}
					isLoading={false}
					currentSessionId={null}
					restoringSessionId={null}
					onSessionSelect={api.open}
					onNewChat={() => {}}
					onDelete={async () => {}}
					onBulkDelete={api.bulk}
					showBalance={options.showBalance}
					onOpenBalanceSettings={options.onOpenBalanceSettings}
				/>
			</QueryClientProvider>
		)
	)
}

test('shows an enabled balance below chat history and opens Balance settings', async () => {
	api.balance = {}
	const openBalance = vi.fn()
	await render()
	expect(document.body.textContent).not.toContain('External Data Balance')

	await render(sessions, { showBalance: true, onOpenBalanceSettings: openBalance })

	const balanceButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((element) =>
		element.textContent?.includes('External Data Balance')
	)!
	expect(balanceButton.textContent).toContain('$0.75')
	await act(async () => balanceButton.click())
	expect(openBalance).toHaveBeenCalledOnce()
})
function button(name: string) {
	const scope = name === 'Cancel' ? (document.querySelector('[role=dialog]:not([hidden])') ?? document) : document
	const element = [...scope.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === name)
	expect(element).toBeDefined()
	return element!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function search(text: string) {
	await act(async () => {
		const input = document.querySelector<HTMLInputElement>('[aria-label="Search sessions"]')!
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
function checked() {
	return [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
		.filter((el) => el.checked)
		.map((el) => el.closest('label')!.textContent?.trim())
}

test('select all, deselect, and filtering use visible checkbox rows without semantic search', async () => {
	await render()
	await click('Select')
	const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
	expect(checkbox.checked).toBe(false)
	await act(async () => checkbox.click())
	expect(checked()).toEqual(['Alpha'])
	await act(async () => checkbox.click())
	expect(checked()).toEqual([])
	expect(api.open).not.toHaveBeenCalled()
	await click('Select All')
	expect(checked()).toEqual(['Alpha', 'Beta', 'Gamma'])
	await click('Deselect All')
	expect(checked()).toEqual([])
	await click('Select All')
	vi.useFakeTimers()
	await search('Beta')
	await act(async () => vi.advanceTimersByTimeAsync(300))
	expect(api.fetch).not.toHaveBeenCalled()
	vi.useRealTimers()
	expect(checked()).toEqual([])
	expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
	await click('Select All')
	expect(checked()).toEqual(['Beta'])
	await click('Delete (1)')
	await click('Cancel')
	expect(api.bulk).not.toHaveBeenCalled()
	await click('Delete (1)')
	await click('Delete')
	await vi.waitFor(() => expect(api.bulk).toHaveBeenCalledExactlyOnceWith(['Beta']))
})

test('removed selections do not count toward deletion and a failed bulk delete can retry', async () => {
	api.bulk.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined)
	await render()
	await click('Select')
	await click('Select All')
	await render(sessions.slice(1))
	expect(button('Delete (2)')).toBeDefined()
	await click('Delete (2)')
	await click('Delete')
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	expect(checked()).toEqual(['Beta', 'Gamma'])
	await click('Retry deletion')
	await vi.waitFor(() => expect(api.bulk).toHaveBeenCalledTimes(2))
	expect(api.bulk).toHaveBeenLastCalledWith(['Beta', 'Gamma'])
})

test('virtual rows refresh when scrolling away from and back to the start', async () => {
	const items = Array.from({ length: 100 }, (_, index) => ({
		...sessions[0],
		sessionId: `session-${index}`,
		title: `Chat ${String(index).padStart(3, '0')}`,
		isPinned: true
	}))
	await render(items)
	const history = container.querySelector('[aria-label="Chat history"]')!
	expect(history.textContent).toContain('Chat 000')
	expect(history.textContent).not.toContain('Chat 050')
	await act(async () => viewport.scroll(1620, true))
	expect(history.textContent).toContain('Chat 050')
	expect(history.textContent).not.toContain('Chat 000')
	await act(async () => viewport.scroll(0, false))
	expect(history.textContent).toContain('Chat 000')
	expect(history.textContent).not.toContain('Chat 050')
})
