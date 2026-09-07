// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SESSIONS_QUERY_KEY, type SessionListInfiniteData } from '~/containers/LlamaAI/hooks/sessionListCache'
import { useDeleteSession } from '~/containers/LlamaAI/hooks/useDeleteSession'
import { SessionListFocusContext } from '../../DeleteSessionDialog'
import { AgenticSessionItem } from '../AgenticSessionItem'
const api = vi.hoisted(() => ({ request: vi.fn(), authorizedFetch: vi.fn(), toastError: vi.fn() }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ user: { id: 'user' }, authorizedFetch: api.authorizedFetch }) }))
vi.mock('~/containers/LlamaAI/api/transport', () => ({ llamaAIRequest: api.request }))
vi.mock('react-hot-toast', () => ({ default: { error: api.toastError } }))
vi.mock('~/containers/LlamaAI/chrome', () => ({ useLlamaAIChrome: () => ({ hideSidebar: vi.fn() }) }))
vi.mock('~/containers/LlamaAI/hooks/useClearUnseenCompletion', () => ({ useClearUnseenCompletion: () => vi.fn() }))
vi.mock('~/containers/LlamaAI/projects/MoveToProjectMenu', () => ({ MoveToProjectMenuItem: () => null }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
const key = [SESSIONS_QUERY_KEY, 'user']
const session = (sessionId: string) => ({
	sessionId,
	title: sessionId,
	createdAt: '2026-09-06',
	lastActivity: '2026-09-06',
	isActive: false,
	isPinned: false
})
const initial: SessionListInfiniteData = {
	pages: [
		{
			sessions: [session('chat'), session('other')],
			usage: null,
			factCheckedUsage: null,
			alertsUsage: null,
			hasMore: false
		}
	],
	pageParams: [0]
}
beforeEach(() => {
	vi.resetAllMocks()
	client = new QueryClient()
	client.setQueryData(key, initial)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.restoreAllMocks()
	vi.useRealTimers()
})
async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				{initial.pages[0].sessions.map((item) => (
					<AgenticSessionItem
						key={item.sessionId}
						session={item}
						isActive={false}
						onSessionSelect={vi.fn()}
						onDelete={vi.fn()}
						isRestoring={false}
					/>
				))}
			</QueryClientProvider>
		)
	)
}
// The menu mounts its items only while open, and clicking one hides it again.
async function pinItem(sessionId: string) {
	await click(`Actions for ${sessionId}`)
	const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter((item) =>
		item.textContent?.includes('Pin to Top')
	)
	expect(items).toHaveLength(1)
	return items[0]
}
const isPinned = (sessionId: string) =>
	client.getQueryData<SessionListInfiniteData>(key)!.pages[0].sessions.find((item) => item.sessionId === sessionId)!
		.isPinned

test('a failed pin restores the cached session, reports the failure, and can retry', async () => {
	let reject!: (error: Error) => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockResolvedValueOnce({})
	await render()
	await act(async () => (await pinItem('chat')).click())
	await vi.waitFor(() => expect(isPinned('chat')).toBe(true))
	await act(async () => reject(new Error('Unavailable')))
	await vi.waitFor(() => expect(client.getQueryData(key)).toEqual(initial))
	expect(api.toastError).toHaveBeenCalledExactlyOnceWith('Failed to toggle pin: Unavailable')
	const retry = await pinItem('chat')
	await vi.waitFor(() => expect(retry.getAttribute('aria-disabled')).not.toBe('true'))
	await act(async () => retry.click())
	await vi.waitFor(() => expect(isPinned('chat')).toBe(true))
})

test('a pending pin prevents duplicate requests without blocking another session', async () => {
	let finish!: () => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve
				})
		)
		.mockResolvedValueOnce({})
	await render()
	await act(async () => (await pinItem('chat')).click())
	await vi.waitFor(() => expect(api.request).toHaveBeenCalledOnce())
	const pendingItem = await pinItem('chat')
	await vi.waitFor(() => expect(pendingItem.getAttribute('aria-disabled')).toBe('true'))
	await act(async () => pendingItem.click())
	expect(api.request).toHaveBeenCalledTimes(1)
	await act(async () => pendingItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	await act(async () => (await pinItem('other')).click())
	await vi.waitFor(() =>
		expect(api.request).toHaveBeenLastCalledWith(expect.any(Function), '/user/sessions/other/pin', { method: 'PUT' })
	)
	expect(isPinned('other')).toBe(true)
	await act(async () => finish())
	await vi.waitFor(() => expect(isPinned('chat')).toBe(true))
})

function ManagedRows() {
	const data = useQuery<SessionListInfiniteData>({ queryKey: key, enabled: false }).data!
	const deletion = useDeleteSession()
	const focus = useRef<HTMLButtonElement>(null)
	const [completed, setCompleted] = useState(false)
	return (
		<SessionListFocusContext.Provider value={focus}>
			<button type="button" ref={focus}>
				New Chat
			</button>
			{data.pages[0].sessions.map((item) => (
				<AgenticSessionItem
					key={item.sessionId}
					session={item}
					isActive={false}
					isRestoring={false}
					onSessionSelect={() => {}}
					onDelete={async (sessionId) => {
						await deletion.mutateAsync({ sessionId })
						setCompleted(true)
					}}
				/>
			))}
			{completed ? <p>Deletion completed</p> : null}
		</SessionListFocusContext.Provider>
	)
}
async function mountManaged() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ManagedRows />
			</QueryClientProvider>
		)
	)
}
function button(name: string) {
	const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim() === name
	)
	expect(result).toBeDefined()
	return result!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function openDelete() {
	await click('Actions for chat')
	const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
		el.textContent?.includes('Delete Session')
	)!
	await act(async () => item.click())
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
}

test('session confirmation cancels without a request and returns focus to its menu', async () => {
	await mountManaged()
	await openDelete()
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete “chat”?')
	await click('Cancel')
	expect(api.request).not.toHaveBeenCalled()
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Actions for chat')))
})

test('deletion keeps feedback mounted, prevents duplicates, retries, and completes after row removal', async () => {
	let reject!: (error: Error) => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockResolvedValue({})
	await mountManaged()
	await openDelete()
	await click('Delete')
	await vi.waitFor(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await click('Deleting…')
	expect(api.request).toHaveBeenCalledTimes(1)
	expect(button('Actions for chat')).toBeDefined()
	await act(async () => reject(new Error('Offline')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	expect(document.querySelector('[role="dialog"]')).not.toBeNull()
	await click('Retry deletion')
	await vi.waitFor(() => expect(container.textContent).toContain('Deletion completed'))
	expect(container.querySelector('[aria-label="Actions for chat"]')).toBeNull()
	await vi.waitFor(() => expect(document.activeElement).toBe(button('New Chat')))
})

test('failed rename preserves the entered title for retry', async () => {
	api.request.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({})
	await mountManaged()
	await click('Rename chat')
	const input = document.querySelector<HTMLInputElement>('input[name="newTitle"]')!
	await act(async () => {
		input.value = 'QA renamed'
		input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	expect(input.value).toBe('QA renamed')
	await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	await vi.waitFor(() => expect(container.querySelector('[aria-label="Rename QA renamed"]')).not.toBeNull())
})

test('a failed pin does not undo another row pin that has succeeded', async () => {
	let reject!: (error: Error) => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockResolvedValue({})
	await render()
	await act(async () => (await pinItem('chat')).click())
	await vi.waitFor(() => expect(isPinned('chat')).toBe(true))
	await act(async () => (await pinItem('other')).click())
	await vi.waitFor(() => expect(isPinned('other')).toBe(true))
	await act(async () => reject(new Error('Offline')))
	await vi.waitFor(() => expect(isPinned('chat')).toBe(false))
	expect(isPinned('other')).toBe(true)
})

async function openShareMenu(isPublic: boolean) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AgenticSessionItem
					session={{ ...session('chat'), isPublic, shareToken: 'test-share' }}
					isActive={false}
					onSessionSelect={vi.fn()}
					onDelete={vi.fn()}
					isRestoring={false}
				/>
			</QueryClientProvider>
		)
	)
	const trigger = button('Actions for chat')
	await act(async () => trigger.click())
	return trigger
}
const namedButton = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button,[role=menuitem]')].find(
		(el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name
	)!

test('making a chat private confirms first, keeps failures retryable, and restores menu focus', async () => {
	const request = Promise.withResolvers<Response>()
	api.authorizedFetch.mockReturnValueOnce(request.promise).mockResolvedValueOnce(Response.json({ isPublic: false }))
	const trigger = await openShareMenu(true)
	await act(async () => namedButton('Make Private').click())
	await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Cancel'))
	await act(async () => namedButton('Cancel').click())
	expect(api.authorizedFetch).not.toHaveBeenCalled()
	await act(async () => namedButton('Make Private').click())
	const confirm = document.querySelector<HTMLElement>('[role="alertdialog"]')!
	await act(async () =>
		[...confirm.querySelectorAll('button')].find((el) => el.textContent === 'Make private')!.click()
	)
	await vi.waitFor(() => expect(confirm.textContent).toContain('Updating…'))
	await act(async () => request.resolve(Response.json({ message: 'Not available' }, { status: 503 })))
	await vi.waitFor(() => expect(confirm.querySelector('[role="alert"]')).not.toBeNull())
	expect(api.toastError).not.toHaveBeenCalled()
	await act(async () =>
		[...confirm.querySelectorAll('button')].find((el) => el.textContent === 'Make private')!.click()
	)
	await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(api.authorizedFetch).toHaveBeenCalledTimes(2)
})

test('making a chat public reports failure in the menu without adding a private-action confirmation', async () => {
	api.authorizedFetch
		.mockRejectedValueOnce(new Error('Offline'))
		.mockResolvedValueOnce(Response.json({ isPublic: true }))
	await openShareMenu(false)
	await act(async () => namedButton('Make Public').click())
	await vi.waitFor(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Failed to update visibility')
	)
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	await act(async () => namedButton('Make Public').click())
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')).toBeNull())
	expect(api.authorizedFetch).toHaveBeenCalledTimes(2)
})

test('copy failures stay inline while the menu is open and remain visible if it closes during a request', async () => {
	const request = Promise.withResolvers<void>()
	const copy = vi
		.spyOn(navigator.clipboard, 'writeText')
		.mockRejectedValueOnce(new Error('Denied'))
		.mockReturnValueOnce(request.promise)
		.mockResolvedValueOnce(undefined)
	const trigger = await openShareMenu(true)
	await act(async () => namedButton('Copy Link').click())
	await vi.waitFor(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not copy the link')
	)
	expect(api.toastError).not.toHaveBeenCalled()
	await act(async () => namedButton('Copy Link').click())
	await act(async () =>
		document
			.querySelector('[role="menu"]')!
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull())
	await act(async () => request.reject(new Error('Clipboard blocked')))
	await vi.waitFor(() => expect(api.toastError).toHaveBeenCalledExactlyOnceWith('Failed to copy link'))
	await act(async () => trigger.click())
	await act(async () => namedButton('Copy Link').click())
	await vi.waitFor(() => expect(namedButton('Link copied')).toBeDefined())
	expect(copy).toHaveBeenLastCalledWith(`${window.location.origin}/ai/chat/shared/test-share`)
})

test('repeated link copies restart success feedback without clearing a later pending copy', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
	const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
	await openShareMenu(true)
	await act(async () => namedButton('Copy Link').click())
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(namedButton('Link copied')).toBeDefined()
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1000)
	})
	await act(async () => namedButton('Link copied').click())
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(copy).toHaveBeenCalledTimes(2)
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1100)
	})
	expect(namedButton('Link copied')).toBeDefined()
	const pending = Promise.withResolvers<void>()
	copy.mockReturnValueOnce(pending.promise)
	await act(async () => namedButton('Link copied').click())
	await act(async () => {
		await vi.advanceTimersByTimeAsync(2100)
	})
	expect(namedButton('Copying…')?.getAttribute('aria-disabled')).toBe('true')
	await act(async () => pending.resolve())
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(namedButton('Link copied')).toBeDefined()
	await act(async () => {
		await vi.advanceTimersByTimeAsync(2100)
	})
	expect(namedButton('Copy Link')).toBeDefined()
})
