// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAIChromeContext } from '~/containers/LlamaAI/chrome'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AgenticSidebar } from '../AgenticSidebar'
const api = vi.hoisted(() => ({ bulk: vi.fn(), open: vi.fn(), hideSidebar: vi.fn() }))
const viewport = vi.hoisted(() => ({ scroll: (_offset: number, _isScrolling: boolean) => {} }))
// Heavy children these tests do not read.
vi.mock('~/containers/LlamaAI/projects/ProjectsSidebarSection', () => ({ ProjectsSidebarSection: () => null }))
vi.mock('~/containers/LlamaAI/projects/MoveToProjectMenu', () => ({ MoveToProjectMenuItem: () => null }))
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
const session = installSubscriberSession('user')
const chrome = {
	toggleSidebar: () => {},
	hideSidebar: api.hideSidebar,
	toggleFullscreen: () => {},
	isFullscreen: false,
	fullscreenLocked: false,
	sidebarVisible: true,
	toggleDashboardPanel: () => {},
	isDashboardPanelOpen: false
}
const aiRequests = () => session.requests.filter((request) => request.url.hostname === 'ai.llama.fi')
let root: Root
let container: HTMLDivElement
const sessions: Array<ChatSession> = ['Alpha', 'Beta', 'Gamma'].map((title) => ({
	sessionId: title,
	title,
	isActive: false,
	createdAt: '2026-09-07',
	lastActivity: '2026-09-07'
}))
beforeEach(() => {
	api.bulk.mockReset()
	api.open.mockReset()
	api.hideSidebar.mockReset()
	session.serve({
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '0.25',
			toppedUpBalance: '0.5',
			freeLimit: '1',
			freeSpent: '0.75'
		}
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	vi.useRealTimers()
	await act(async () => root.unmount())
	container.remove()
})
async function render(items = sessions, options: { showBalance?: boolean; onOpenBalanceSettings?: () => void } = {}) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<LlamaAIChromeContext.Provider value={chrome}>
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
						searchOpen
					/>
				</LlamaAIChromeContext.Provider>
			</session.Wrapper>
		)
	)
}

test('shows an enabled balance below chat history and opens Balance settings', async () => {
	const openBalance = vi.fn()
	await render()
	expect(document.body.textContent).not.toContain('External Data Balance')

	await render(sessions, { showBalance: true, onOpenBalanceSettings: openBalance })

	const balanceButton = () =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((element) =>
			element.textContent?.includes('External Data Balance')
		)
	await act(async () => {
		await waitForUi(() => expect(balanceButton()).toBeDefined())
	})
	expect(balanceButton()!.textContent).toContain('$0.75')
	await act(async () => balanceButton()!.click())
	expect(openBalance).toHaveBeenCalledOnce()
})
function button(name: string) {
	const scope = name === 'Cancel' ? (document.querySelector('[role=alertdialog]:not([hidden])') ?? document) : document
	const element = [...scope.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)
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
	await click('Select all')
	expect(checked()).toEqual(['Alpha', 'Beta', 'Gamma'])
	await click('Deselect all')
	expect(checked()).toEqual([])
	await click('Select all')
	vi.useFakeTimers()
	await search('Beta')
	await act(async () => vi.advanceTimersByTimeAsync(300))
	expect(aiRequests()).toEqual([])
	vi.useRealTimers()
	expect(checked()).toEqual([])
	expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
	await click('Select all')
	expect(checked()).toEqual(['Beta'])
	await click('Delete (1)')
	await click('Cancel')
	expect(api.bulk).not.toHaveBeenCalled()
	await click('Delete (1)')
	await click('Delete')
	await waitForUi(() => expect(api.bulk).toHaveBeenCalledExactlyOnceWith(['Beta']))
})

test('removed selections do not count toward deletion and a failed bulk delete can retry', async () => {
	api.bulk.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined)
	await render()
	await click('Select')
	await click('Select all')
	await render(sessions.slice(1))
	expect(button('Delete (2)')).toBeDefined()
	await click('Delete (2)')
	await click('Delete')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	expect(checked()).toEqual(['Beta', 'Gamma'])
	await click('Delete')
	await waitForUi(() => expect(api.bulk).toHaveBeenCalledTimes(2))
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

test('on a phone, tapping the bulk delete confirm keeps the sidebar and its confirm open', async () => {
	// The sidebar hides on a tap outside it below 1024px.
	Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 375 })
	try {
		await render()
		await click('Select')
		await click('Select all')
		await click('Delete (3)')
		const confirm = document.querySelector('[role="alertdialog"]')!
		await act(async () => {
			confirm.querySelector('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
		})
		expect(api.hideSidebar).not.toHaveBeenCalled()
		await act(async () => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
		expect(api.hideSidebar).toHaveBeenCalledOnce()
	} finally {
		Reflect.deleteProperty(document.documentElement, 'clientWidth')
	}
})

test("a chat's open menu stays open when the chat gets new activity", async () => {
	await render()
	await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Actions for Beta"]')!.click())
	await waitForUi(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
	await render(sessions.map((item) => (item.sessionId === 'Beta' ? { ...item, lastActivity: '2026-09-08' } : item)))
	expect(document.querySelector('[role="menu"]')).not.toBeNull()
})

test('a finished bulk delete hands focus to the Select toggle that replaces its footer', async () => {
	api.bulk.mockResolvedValue(undefined)
	await render()
	await click('Select')
	await act(async () =>
		[...document.querySelectorAll('label')]
			.find((l) => l.textContent === 'Alpha')!
			.querySelector('input')!
			.click()
	)
	await click('Delete (1)')
	await click('Delete')
	await render(sessions.slice(1))
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(button('Select')))
})
