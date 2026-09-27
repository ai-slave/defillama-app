// @vitest-environment happy-dom

import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'

const { writeText, nativeShare, toastError } = vi.hoisted(() => ({
	writeText: vi.fn(),
	nativeShare: vi.fn(),
	toastError: vi.fn()
}))
// The toast library is the app's notification boundary; its calls are what a user would see.
vi.mock('react-hot-toast', () => ({ toast: { error: toastError } }))

import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { ShareModal } from '../ShareModal'

const session = installSubscriberSession('reader')
const SHARE = 'https://ai.llama.fi/user/sessions/'
const shareRequests = () => session.requests.filter((request) => request.url.pathname.endsWith('/share'))
const fail = (message: string) => () => {
	throw new Error(message)
}

const shareResponse = (shareToken = 'tok-1') => new Response(JSON.stringify({ shareToken, isPublic: true }))
let container: HTMLDivElement
let root: Root

async function render(open: boolean, sessionId: string | null = 's1', messageId?: string) {
	await act(async () =>
		root.render(
			<StrictMode>
				<session.Wrapper>
					<ShareModal open={open} setOpen={vi.fn()} sessionId={sessionId} messageId={messageId} />
				</session.Wrapper>
			</StrictMode>
		)
	)
}
function button(name: string) {
	const result = [...document.querySelectorAll('button')].find(
		(el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name
	)
	expect(result, `button ${name}`).not.toBeUndefined()
	return result!
}
const settle = async () => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}
async function expectText(text: string) {
	await act(async () => {
		await waitForUi(() => expect(document.body.textContent).toContain(text))
	})
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.resetAllMocks()
	session.client.setDefaultOptions({ queries: { retry: false } })
	writeText.mockResolvedValue(undefined)
	nativeShare.mockResolvedValue(undefined)
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
	Object.defineProperty(navigator, 'share', { value: nativeShare, configurable: true })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

test('opening shares once in Strict Mode and copies the message link', async () => {
	session.serve({ [SHARE]: () => shareResponse() })
	await render(true, 's1', 'm1')
	await expectText('Share link copied to clipboard')
	expect(shareRequests().map((request) => request.url.pathname)).toEqual(['/user/sessions/s1/share'])
	expect(JSON.parse(shareRequests()[0].init!.body as string)).toEqual({ forcePublic: true })
	expect(writeText.mock.calls).toEqual([['http://localhost:3000/ai/chat/shared/tok-1#msg-m1']])
	expect(document.querySelector('input')?.value).toBe('http://localhost:3000/ai/chat/shared/tok-1#msg-m1')
})

test('retry keeps its focus through creation, clipboard failure and successful manual copy', async () => {
	session.serveInOrder(SHARE, [fail('Sharing is unavailable')])
	await render(true)
	await expectText('Sharing is unavailable')
	const request = Promise.withResolvers<Response>()
	session.serveInOrder(SHARE, [() => request.promise])
	const retry = button('Retry')
	await act(async () => {
		retry.focus()
		retry.click()
	})
	await settle()
	expect(document.activeElement).toBe(retry)
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Creating share link…')
	expect(toastError.mock.calls).toEqual([])
	expect(retry.getAttribute('aria-disabled')).toBe('true')
	await act(async () => retry.click())
	expect(shareRequests()).toHaveLength(2)
	writeText.mockRejectedValueOnce(new Error('Denied'))
	await act(async () => request.resolve(shareResponse()))
	await expectText('Couldn’t copy the link.')
	expect(document.activeElement).toBe(retry)
	expect(button('Copy link')).toBe(retry)
	expect(document.querySelector('input')?.value).toBe('http://localhost:3000/ai/chat/shared/tok-1')
	await act(async () => retry.click())
	await expectText('Share link copied to clipboard')
	expect(document.activeElement).toBe(retry)
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(writeText.mock.calls).toEqual([
		['http://localhost:3000/ai/chat/shared/tok-1'],
		['http://localhost:3000/ai/chat/shared/tok-1']
	])
})

test.each(['close', 'change target'])('%s before a response prevents old automatic copying', async (action) => {
	const oldRequest = Promise.withResolvers<Response>()
	session.serveInOrder(SHARE, [() => oldRequest.promise])
	await render(true)
	await expectText('Creating share link…')
	if (action === 'close') await render(false)
	else {
		session.serveInOrder(SHARE, [() => shareResponse('tok-2')])
		await render(true, 's2')
		await expectText('Share link copied to clipboard')
	}
	await act(async () => oldRequest.resolve(shareResponse('tok-old')))
	await settle()
	expect(writeText.mock.calls).toEqual(action === 'close' ? [] : [['http://localhost:3000/ai/chat/shared/tok-2']])
	if (action === 'close') {
		session.serveInOrder(SHARE, [() => shareResponse('tok-2')])
		await render(true, 's2')
		await expectText('Share link copied to clipboard')
	}
	expect(document.querySelector('input')?.value).toBe('http://localhost:3000/ai/chat/shared/tok-2')
	expect(writeText.mock.calls).toEqual([['http://localhost:3000/ai/chat/shared/tok-2']])
})

test('a late clipboard failure cannot replace the feedback in a reopened dialog', async () => {
	const clipboard = Promise.withResolvers<void>()
	writeText.mockReturnValueOnce(clipboard.promise)
	session.serve({ [SHARE]: () => shareResponse() })
	await render(true)
	await expectText('Copying share link…')
	await render(false)
	await render(true)
	await expectText('Share link copied to clipboard')
	await act(async () => clipboard.reject(new Error('Denied')))
	await settle()
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Share link copied to clipboard')
	expect(toastError.mock.calls).toEqual([['Couldn’t copy the share link.']])
})

test('clipboard unavailability guides manual copying instead of retrying', async () => {
	Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
	session.serve({ [SHARE]: () => shareResponse() })
	await render(true)
	await expectText('Clipboard access is unavailable here.')
	expect(document.querySelector('[role="alert"]')?.textContent).toBe(
		'Clipboard access is unavailable here. Copy the link from the field above.'
	)
	expect(button('Copy link').getAttribute('aria-disabled')).toBe('true')
	expect(document.querySelector('input')?.value).toBe('http://localhost:3000/ai/chat/shared/tok-1')
	await act(async () => document.querySelector('input')!.focus())
	const input = document.querySelector('input')!
	expect(input.value.slice(input.selectionStart!, input.selectionEnd!)).toBe(
		'http://localhost:3000/ai/chat/shared/tok-1'
	)
})

test('an unsaved conversation explains itself and offers no doomed retry', async () => {
	await render(true, null)
	await expectText('Sharing is available once the conversation is saved.')
	expect(shareRequests()).toEqual([])
	expect(writeText.mock.calls).toEqual([])
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(document.querySelector('input')).toBeNull()
	session.serveInOrder(SHARE, [() => shareResponse()])
	await render(true, 'saved-session')
	await expectText('Share link copied to clipboard')
	expect(shareRequests().map((request) => request.url.pathname)).toEqual(['/user/sessions/saved-session/share'])
	expect(writeText.mock.calls).toEqual([['http://localhost:3000/ai/chat/shared/tok-1']])
})

test('native sharing distinguishes cancellation from failure and permits retry', async () => {
	session.serve({ [SHARE]: () => shareResponse() })
	await render(true)
	await expectText('Share link copied to clipboard')
	nativeShare.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
	await act(async () => button('Share…').click())
	await settle()
	expect(document.querySelector('[role="alert"]')).toBeNull()
	nativeShare.mockRejectedValueOnce(new Error('Unavailable'))
	await act(async () => button('Share…').click())
	await expectText('Couldn’t share the link.')
	await act(async () => button('Share…').click())
	await settle()
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(nativeShare.mock.calls[2]).toEqual([
		{
			title: 'LlamaAI conversation',
			text: 'Check out this conversation from LlamaAI',
			url: 'http://localhost:3000/ai/chat/shared/tok-1'
		}
	])
})

test('failed creation after dismissal reports once and reopening permits a fresh attempt', async () => {
	const request = Promise.withResolvers<Response>()
	session.serveInOrder(SHARE, [() => request.promise])
	await render(true)
	await expectText('Creating share link…')
	await render(false)
	await act(async () => request.reject(new Error('Sharing is unavailable')))
	expect(toastError.mock.calls).toEqual([['Sharing is unavailable']])
	session.serve({ [SHARE]: () => shareResponse() })
	await render(true)
	await expectText('Share link copied to clipboard')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(writeText.mock.calls).toEqual([['http://localhost:3000/ai/chat/shared/tok-1']])
})
