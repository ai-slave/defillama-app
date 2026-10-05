// @vitest-environment happy-dom
import { type QueryClient, useQuery } from '@tanstack/react-query'
import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAIChromeContext } from '~/containers/LlamaAI/chrome'
import { SESSIONS_QUERY_KEY, type SessionListInfiniteData } from '~/containers/LlamaAI/hooks/sessionListCache'
import { useDeleteSession } from '~/containers/LlamaAI/hooks/useDeleteSession'
import { PROJECTS_KEY } from '~/containers/LlamaAI/projects/queryKeys'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { SessionListFocusContext } from '../../DeleteSessionDialog'
import { AgenticSessionItem } from '../AgenticSessionItem'
const toastError = vi.hoisted(() => vi.fn())
// The toast library is the app's notification boundary; its calls are what a user would see.
vi.mock('react-hot-toast', () => ({ default: { error: toastError } }))

const auth = installSubscriberSession('user')
const AI = 'https://ai.llama.fi'
const chrome = {
	toggleSidebar: () => {},
	hideSidebar: () => {},
	toggleFullscreen: () => {},
	isFullscreen: false,
	fullscreenLocked: false,
	sidebarVisible: true,
	toggleDashboardPanel: () => {},
	isDashboardPanelOpen: false
}
const failure = (message: string) => Response.json({ error: message }, { status: 503 })
const requestsTo = (path: string, method: string) =>
	auth.requests.filter((request) => request.url.href === `${AI}${path}` && request.init?.method === method)
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
	toastError.mockReset()
	client = auth.client
	client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	client.setQueryData(key, initial)
	auth.serve({ [`${AI}/projects`]: { projects: [] } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
	vi.useRealTimers()
})
async function render() {
	await act(async () =>
		root.render(
			<auth.Wrapper>
				<LlamaAIChromeContext.Provider value={chrome}>
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
				</LlamaAIChromeContext.Provider>
			</auth.Wrapper>
		)
	)
}
// The menu mounts its items only while open, and clicking one hides it again.
async function pinItem(sessionId: string) {
	await click(`Actions for ${sessionId}`)
	const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter((item) =>
		item.textContent?.includes('Pin to top')
	)
	expect(items).toHaveLength(1)
	return items[0]
}
const isPinned = (sessionId: string) =>
	client.getQueryData<SessionListInfiniteData>(key)!.pages[0].sessions.find((item) => item.sessionId === sessionId)!
		.isPinned

test('a failed pin restores the cached session, reports the failure, and can retry', async () => {
	const first = Promise.withResolvers<Response>()
	auth.serveInOrder(`${AI}/user/sessions/chat/pin`, [() => first.promise], {})
	await render()
	await act(async () => (await pinItem('chat')).click())
	await waitForUi(() => expect(isPinned('chat')).toBe(true))
	await act(async () => first.resolve(failure('Unavailable')))
	await waitForUi(() => expect(client.getQueryData(key)).toEqual(initial))
	expect(toastError).toHaveBeenCalledExactlyOnceWith('Failed to toggle pin: Unavailable')
	const retry = await pinItem('chat')
	await waitForUi(() => expect(retry.getAttribute('aria-disabled')).not.toBe('true'))
	await act(async () => retry.click())
	await waitForUi(() => expect(isPinned('chat')).toBe(true))
})

test('a pending pin prevents duplicate requests without blocking another session', async () => {
	const first = Promise.withResolvers<Response>()
	auth.serve({
		[`${AI}/user/sessions/chat/pin`]: () => first.promise,
		[`${AI}/user/sessions/other/pin`]: {}
	})
	await render()
	await act(async () => (await pinItem('chat')).click())
	await waitForUi(() => expect(requestsTo('/user/sessions/chat/pin', 'PUT')).toHaveLength(1))
	const pendingItem = await pinItem('chat')
	await waitForUi(() => expect(pendingItem.getAttribute('aria-disabled')).toBe('true'))
	await act(async () => pendingItem.click())
	expect(requestsTo('/user/sessions/chat/pin', 'PUT')).toHaveLength(1)
	await act(async () => pendingItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	await act(async () => (await pinItem('other')).click())
	await waitForUi(() => expect(requestsTo('/user/sessions/other/pin', 'PUT')).toHaveLength(1))
	expect(isPinned('other')).toBe(true)
	await act(async () => first.resolve(Response.json({})))
	await waitForUi(() => expect(isPinned('chat')).toBe(true))
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
			<auth.Wrapper>
				<LlamaAIChromeContext.Provider value={chrome}>
					<ManagedRows />
				</LlamaAIChromeContext.Provider>
			</auth.Wrapper>
		)
	)
}
function button(name: string) {
	const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)
	expect(result).toBeDefined()
	return result!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function openDelete() {
	await click('Actions for chat')
	const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
		el.textContent?.includes('Delete session')
	)!
	await act(async () => item.click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
}

test('session confirmation cancels without a request and returns focus to its menu', async () => {
	await mountManaged()
	await openDelete()
	const dialog = document.querySelector('[role="alertdialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete “chat”?')
	await click('Cancel')
	expect(requestsTo('/user/sessions/chat', 'DELETE')).toEqual([])
	await waitForUi(() => expect(document.activeElement).toBe(button('Actions for chat')))
})

test('deletion keeps feedback mounted, prevents duplicates, retries, and completes after row removal', async () => {
	const first = Promise.withResolvers<Response>()
	auth.serveInOrder(`${AI}/user/sessions/chat`, [() => first.promise], {})
	await mountManaged()
	await openDelete()
	await click('Delete')
	await waitForUi(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await click('Deleting…')
	expect(requestsTo('/user/sessions/chat', 'DELETE')).toHaveLength(1)
	expect(button('Actions for chat')).toBeDefined()
	await act(async () => first.resolve(failure('Offline')))
	await waitForUi(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't delete this chat. Try again.")
	)
	expect(document.querySelector('[role="alertdialog"]')).not.toBeNull()
	await click('Delete')
	await waitForUi(() => expect(container.textContent).toContain('Deletion completed'))
	expect(container.querySelector('[aria-label="Actions for chat"]')).toBeNull()
	await waitForUi(() => expect(document.activeElement).toBe(button('New Chat')))
})

test('failed rename preserves the entered title for retry', async () => {
	auth.serveInOrder(`${AI}/user/sessions/chat/title`, [() => failure('Offline')], {})
	await mountManaged()
	await click('Rename chat')
	const input = document.querySelector<HTMLInputElement>('input[name="newTitle"]')!
	await act(async () => {
		input.value = 'QA renamed'
		input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	expect(input.value).toBe('QA renamed')
	await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	await waitForUi(() => expect(container.querySelector('[aria-label="Rename QA renamed"]')).not.toBeNull())
})

test('a saving rename keeps focus in its field, then returns it to the rename button', async () => {
	const saved = Promise.withResolvers<Response>()
	auth.serve({ [`${AI}/user/sessions/chat/title`]: () => saved.promise })
	await mountManaged()
	await click('Rename chat')
	const input = document.querySelector<HTMLInputElement>('input[name="newTitle"]')!
	await act(async () => {
		input.focus()
		input.value = 'QA renamed'
		input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	await waitForUi(() => expect(input.readOnly).toBe(true))
	expect(input.disabled).toBe(false)
	expect(document.activeElement).toBe(input)
	await act(async () => saved.resolve(Response.json({})))
	await waitForUi(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Rename QA renamed'))
})

test('a failed pin does not undo another row pin that has succeeded', async () => {
	const first = Promise.withResolvers<Response>()
	auth.serve({
		[`${AI}/user/sessions/chat/pin`]: () => first.promise,
		[`${AI}/user/sessions/other/pin`]: {}
	})
	await render()
	await act(async () => (await pinItem('chat')).click())
	await waitForUi(() => expect(isPinned('chat')).toBe(true))
	await act(async () => (await pinItem('other')).click())
	await waitForUi(() => expect(isPinned('other')).toBe(true))
	await act(async () => first.resolve(failure('Offline')))
	await waitForUi(() => expect(isPinned('chat')).toBe(false))
	expect(isPinned('other')).toBe(true)
})

async function openShareMenu(isPublic: boolean) {
	await act(async () =>
		root.render(
			<auth.Wrapper>
				<LlamaAIChromeContext.Provider value={chrome}>
					<AgenticSessionItem
						session={{ ...session('chat'), isPublic, shareToken: 'test-share' }}
						isActive={false}
						onSessionSelect={vi.fn()}
						onDelete={vi.fn()}
						isRestoring={false}
					/>
				</LlamaAIChromeContext.Provider>
			</auth.Wrapper>
		)
	)
	const trigger = button('Actions for chat')
	await act(async () => trigger.click())
	return trigger
}
/** The clipboard, read the way a browser reads a ClipboardItem: `text` receives each written link once its promise settles. */
function mockClipboard() {
	const text = vi.fn<(value: string) => Promise<void>>()
	const write = vi.spyOn(navigator.clipboard, 'write').mockImplementation(async (items) => {
		const blob = await items[0].getType('text/plain')
		return text(await blob.text())
	})
	return { text, write }
}
const namedButton = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button,[role=menuitem]')].find((el) => accessibleName(el) === name)!

test('making a chat private confirms first, keeps failures retryable, and restores menu focus', async () => {
	const request = Promise.withResolvers<Response>()
	auth.serveInOrder(`${AI}/user/sessions/chat/share`, [() => request.promise], { isPublic: false })
	const trigger = await openShareMenu(true)
	await act(async () => namedButton('Make private').click())
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Cancel'))
	await act(async () => namedButton('Cancel').click())
	expect(requestsTo('/user/sessions/chat/share', 'PUT')).toEqual([])
	await act(async () => namedButton('Make private').click())
	const confirm = document.querySelector<HTMLElement>('[role="alertdialog"]')!
	await act(async () =>
		[...confirm.querySelectorAll('button')].find((el) => accessibleName(el) === 'Make private')!.click()
	)
	await waitForUi(() => expect(confirm.textContent).toContain('Updating…'))
	await act(async () => request.resolve(Response.json({ message: 'Not available' }, { status: 503 })))
	await waitForUi(() => expect(confirm.querySelector('[role="alert"]')).not.toBeNull())
	expect(toastError).not.toHaveBeenCalled()
	await act(async () =>
		[...confirm.querySelectorAll('button')].find((el) => accessibleName(el) === 'Make private')!.click()
	)
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(trigger))
	expect(requestsTo('/user/sessions/chat/share', 'PUT')).toHaveLength(2)
})

test('making a private chat public copies its new link, and a failure stays in the menu without a confirmation', async () => {
	const copy = mockClipboard().text.mockResolvedValue(undefined)
	auth.serveInOrder(
		`${AI}/user/sessions/chat/share`,
		[
			() => {
				throw new TypeError('Failed to fetch')
			}
		],
		{ isPublic: true, shareToken: 'new-share' }
	)
	const trigger = await openShareMenu(false)
	expect(namedButton('Copy link')).toBeUndefined()
	expect(namedButton('Make private')).toBeUndefined()
	await act(async () => namedButton('Make public and copy link').click())
	await waitForUi(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Failed to update visibility')
	)
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	expect(copy).not.toHaveBeenCalled()
	await reopenMenu(trigger)
	expect(document.querySelector('[role="alert"]')).toBeNull()
	await act(async () => namedButton('Make public and copy link').click())
	await waitForUi(() => expect(namedButton('Link copied')).toBeDefined())
	expect(copy).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/ai/chat/shared/new-share`)
	expect(requestsTo('/user/sessions/chat/share', 'PUT')).toHaveLength(2)
})

test('Make public and copy link starts the clipboard write inside the click, before publishing returns', async () => {
	// Safari and every iOS browser reject a clipboard write that starts after the click's task ends.
	const publish = Promise.withResolvers<Response>()
	auth.serve({ [`${AI}/user/sessions/chat/share`]: () => publish.promise })
	const { text, write } = mockClipboard()
	text.mockResolvedValue(undefined)
	await openShareMenu(false)
	await act(async () => namedButton('Make public and copy link').click())
	expect(write).toHaveBeenCalledTimes(1)
	expect(text).not.toHaveBeenCalled()
	await act(async () => publish.resolve(Response.json({ isPublic: true, shareToken: 'new-share' })))
	await waitForUi(() => expect(namedButton('Link copied')).toBeDefined())
	expect(text).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/ai/chat/shared/new-share`)
})

test('copy failures stay inline while the menu is open and remain visible if it closes during a request', async () => {
	const request = Promise.withResolvers<void>()
	const copy = mockClipboard()
		.text.mockRejectedValueOnce(new Error('Denied'))
		.mockReturnValueOnce(request.promise)
		.mockResolvedValueOnce(undefined)
	const trigger = await openShareMenu(true)
	await act(async () => namedButton('Copy link').click())
	await waitForUi(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not copy the link')
	)
	expect(toastError).not.toHaveBeenCalled()
	expect(document.querySelector('[role="menu"] [role="alert"]')).toBeNull()
	await reopenMenu(trigger)
	expect(document.querySelector('[role="alert"]')).toBeNull()
	await act(async () => namedButton('Copy link').click())
	await act(async () =>
		document
			.querySelector('[role="menu"]')!
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
	await waitForUi(() => expect(document.querySelector('[role="menu"]')).toBeNull())
	await act(async () => request.reject(new Error('Clipboard blocked')))
	await waitForUi(() => expect(toastError).toHaveBeenCalledExactlyOnceWith('Failed to copy link'))
	await act(async () => trigger.click())
	await act(async () => namedButton('Copy link').click())
	await waitForUi(() => expect(namedButton('Link copied')).toBeDefined())
	expect(copy).toHaveBeenLastCalledWith(`${window.location.origin}/ai/chat/shared/test-share`)
})

test('repeated link copies restart success feedback without clearing a later pending copy', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
	const copy = mockClipboard().text.mockResolvedValue(undefined)
	await openShareMenu(true)
	await act(async () => namedButton('Copy link').click())
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
	expect(namedButton('Copy link')).toBeDefined()
})

async function reopenMenu(trigger: HTMLElement) {
	await act(async () =>
		document
			.querySelector('[role="menu"]')!
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
	await waitForUi(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
	await act(async () =>
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
	)
	await waitForUi(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'))
}

test.each(['copy', 'visibility'] as const)(
	'reopening preserves the pending %s action and its eventual failure',
	async (action) => {
		const copyRequest = Promise.withResolvers<void>()
		const visibilityRequest = Promise.withResolvers<Response>()
		const copy = mockClipboard().text.mockReturnValue(copyRequest.promise)
		auth.serve({ [`${AI}/user/sessions/chat/share`]: () => visibilityRequest.promise })
		const trigger = await openShareMenu(action === 'copy')
		await act(async () => namedButton(action === 'copy' ? 'Copy link' : 'Make public and copy link').click())
		await reopenMenu(trigger)
		const pendingItem = namedButton(action === 'copy' ? 'Copying…' : 'Making public…')
		expect(pendingItem.getAttribute('aria-disabled')).toBe('true')
		await act(async () => pendingItem.click())
		expect(copy.mock.calls).toEqual(action === 'copy' ? [[`${window.location.origin}/ai/chat/shared/test-share`]] : [])
		expect(requestsTo('/user/sessions/chat/share', 'PUT')).toHaveLength(action === 'visibility' ? 1 : 0)
		await act(async () => {
			if (action === 'copy') copyRequest.reject(new Error('Denied'))
			else visibilityRequest.reject(new Error('Offline'))
		})
		await waitForUi(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toBe(
				action === 'copy'
					? 'Could not copy the link. Please try again.'
					: 'Failed to update visibility. Please try again.'
			)
		)
	}
)

test('the real project submenu returns to its parent and closes the whole menu from its mobile controls', async () => {
	client.setQueryData(PROJECTS_KEY, [{ id: 'research', name: 'Research notes' }])
	const trigger = await openShareMenu(false)
	const openSubmenu = async () => {
		await act(async () =>
			namedButton('Move to project').dispatchEvent(
				new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
			)
		)
		await waitForUi(() => expect(namedButton('Research notes')?.textContent).toBe('Research notes'))
	}
	await openSubmenu()
	await act(async () => namedButton('Back to session actions').click())
	await waitForUi(() => expect(document.activeElement).toBe(namedButton('Move to project')))
	expect(trigger.getAttribute('aria-expanded')).toBe('true')
	expect(namedButton('Research notes')).toBeUndefined()
	await openSubmenu()
	await act(async () => namedButton('Close session menus').click())
	await waitForUi(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
	await waitForUi(() => expect(document.activeElement).toBe(trigger))
})
