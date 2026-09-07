// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { authorizedFetch, writeText } = vi.hoisted(() => ({ authorizedFetch: vi.fn(), writeText: vi.fn() }))

vi.mock('~/auth', () => ({ useAuthContext: () => ({ authorizedFetch }) }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ShareModal } from '../ShareModal'

function shareResponse() {
	return { ok: true, status: 200, json: async () => ({ shareToken: 'tok-1', isPublic: true }) }
}

describe('the share dialog copies its link', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	function render(open: boolean) {
		return act(async () => {
			root.render(
				<QueryClientProvider client={client}>
					<ShareModal open={open} setOpen={vi.fn()} sessionId="s1" />
				</QueryClientProvider>
			)
		})
	}

	const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))))
	const retryButton = () =>
		Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.includes('Retry'))

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
		client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		document.body.innerHTML = ''
	})

	test('opening it copies the new link', async () => {
		authorizedFetch.mockResolvedValue(shareResponse())
		await render(true)
		await settle()
		expect(writeText).toHaveBeenCalledWith('http://localhost:3000/ai/chat/shared/tok-1')
	})

	test('retrying after a failure copies the link too', async () => {
		authorizedFetch.mockRejectedValueOnce(new Error('offline'))
		await render(true)
		await settle()
		expect(writeText).not.toHaveBeenCalled()

		authorizedFetch.mockResolvedValue(shareResponse())
		await act(async () => retryButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		await settle()
		expect(writeText).toHaveBeenCalledWith('http://localhost:3000/ai/chat/shared/tok-1')
	})
})
