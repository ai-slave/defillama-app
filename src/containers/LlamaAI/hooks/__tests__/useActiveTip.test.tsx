// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TipDTO } from '../useLlamaAISettings'
import { useActiveTip } from '../useLlamaAITip'

const mocks = vi.hoisted(() => ({
	userId: 'user-a' as string | null,
	isPending: true,
	serverTip: null as TipDTO | null,
	authorizedFetch: vi.fn()
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: mocks.authorizedFetch,
		isAuthenticated: !!mocks.userId,
		user: mocks.userId ? { id: mocks.userId } : null
	})
}))

vi.mock('~/containers/LlamaAI/hooks/useLlamaAISettings', () => ({
	LLAMA_AI_SETTINGS_QUERY_KEY: ['llamaai', 'settings'],
	useLlamaAISettings: () => ({ tip: mocks.serverTip, queryState: { isPending: mocks.isPending } })
}))

vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))

const tipFor = (id: string): TipDTO => ({ id, variant: 'v', family: 'f' }) as TipDTO

let container: HTMLDivElement
let root: Root
let client: QueryClient
let seen: Array<string | null>
let api: ReturnType<typeof useActiveTip>

function Harness() {
	api = useActiveTip()
	// Recorded after commit, not during render: a render-phase re-seed makes React throw the first
	// render away, and only committed values can reach the screen.
	useLayoutEffect(() => {
		seen.push(api.tip?.id ?? null)
	})
	return null
}

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	window.localStorage.clear()
	mocks.userId = 'user-a'
	mocks.isPending = true
	mocks.serverTip = null
	mocks.authorizedFetch.mockResolvedValue({ ok: true })
	seen = []
	client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})

test('shows the cached tip for the signed-in account while settings load', async () => {
	window.localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	await render()
	expect(seen.at(-1)).toBe('tip-a')
})

// Re-seeding in an effect committed the previous account's tip first, so the panel flashed a tip
// belonging to someone else before correcting itself.
test('never renders the previous account tip after the account changes', async () => {
	window.localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	window.localStorage.setItem('llamaai-last-tip:user-b', JSON.stringify(tipFor('tip-b')))
	await render()
	seen = []

	mocks.userId = 'user-b'
	await render()

	expect(seen).not.toContain('tip-a')
	expect(seen.at(-1)).toBe('tip-b')
})

test('an account with no cached tip clears the previous one', async () => {
	window.localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	await render()
	mocks.userId = 'user-c'
	await render()
	expect(seen.at(-1)).toBeNull()
})

// The opposite edge: the re-seed must not resurrect a tip the user dismissed.
test('a dismissed tip stays cleared across later renders', async () => {
	window.localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	await render()
	await act(async () => api.dismissTip(tipFor('tip-a')))
	expect(seen.at(-1)).toBeNull()
	expect(window.localStorage.getItem('llamaai-last-tip:user-a')).toBeNull()

	await render()
	expect(seen.at(-1)).toBeNull()
})

test('the resolved server tip wins over the cached one', async () => {
	window.localStorage.setItem('llamaai-last-tip:user-a', JSON.stringify(tipFor('tip-a')))
	mocks.isPending = false
	mocks.serverTip = tipFor('tip-server')
	await render()
	expect(seen.at(-1)).toBe('tip-server')
})
