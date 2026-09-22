// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAIShell } from './LlamaAIShell'

const layout = vi.hoisted(() => ({ hideDesktopSearch: undefined as boolean | undefined }))
vi.mock('~/layout', () => ({
	default: ({ children, hideDesktopSearch }: { children: ReactNode; hideDesktopSearch?: boolean }) => {
		layout.hideDesktopSearch = hideDesktopSearch
		return <main>{children}</main>
	}
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: null, loaders: { userLoading: false }, isAuthenticated: false })
}))
vi.mock('~/containers/LlamaAI', () => ({ AgenticChat: () => null }))
vi.mock('~/containers/LlamaAI/components/status/LlamaAIAnimationPreloads', () => ({
	LlamaAIAnimationPreloads: () => null
}))
vi.mock('~/containers/MobileApp/LlamaAIMobileAppGate', () => ({
	LlamaAIMobileAppGate: ({ children }: { children: ReactNode }) => <>{children}</>
}))
vi.mock('~/contexts/LlamaAIRouteState', () => ({
	useLlamaAIRouteState: () => ({ kind: 'chat-new' }),
	LlamaAIRouteProvider: ({ children }: { children: ReactNode }) => <>{children}</>
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
test('LlamaAI hides the site search bar and ⌘K still opens the site search', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<LlamaAIShell>{null}</LlamaAIShell>
			</QueryClientProvider>
		)
	)
	expect(layout.hideDesktopSearch).toBe(true)
	expect(siteSearchDialog()).toBeUndefined()

	const hotkey = new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, cancelable: true })
	await act(async () => window.dispatchEvent(hotkey))

	expect(hotkey.defaultPrevented).toBe(true)
	expect(siteSearchDialog()).toBeDefined()
})
