// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { LlamaAIShell } from './LlamaAIShell'

// Heavy page chrome stubs; the test asserts only the site search hotkey the shell mounts itself.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('~/containers/LlamaAI', () => ({ AgenticChat: () => null }))
vi.mock('~/containers/LlamaAI/components/status/LlamaAIAnimationPreloads', () => ({
	LlamaAIAnimationPreloads: () => null
}))
vi.mock('next/router', () => ({
	useRouter: () => ({
		isReady: true,
		pathname: '/ai/chat/[[...sessionId]]',
		asPath: '/ai/chat',
		query: {},
		push: vi.fn()
	})
}))
vi.mock('~/utils/async', () => ({ fetchJson: () => new Promise(() => {}) }))

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
})

const siteSearchDialog = () =>
	[...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
		(dialog) => dialog.querySelector('input[placeholder="Search..."]') && !dialog.hidden
	)

/**
 * LlamaAI pages drop the site search bar so chat and terminal share one chrome, but ⌘K is how people
 * jump to a protocol or chain from anywhere on DefiLlama, so it must still open the site search.
 */
test('⌘K opens the site search on LlamaAI pages', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<AuthProvider>
					<LlamaAIShell>{null}</LlamaAIShell>
				</AuthProvider>
			</QueryClientProvider>
		)
	)
	expect(siteSearchDialog()).toBeUndefined()

	const hotkey = new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, cancelable: true })
	await act(async () => window.dispatchEvent(hotkey))

	expect(hotkey.defaultPrevented).toBe(true)
	expect(siteSearchDialog()).toBeDefined()
})
