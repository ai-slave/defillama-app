// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
	LLAMA_AI_ENABLE_MEMORY_KEY,
	LLAMA_AI_SETTINGS_QUERY_KEY,
	type SettingsQueryResult,
	useLlamaAISettings
} from './useLlamaAISettings'

const mocks = vi.hoisted(() => ({
	authorizedFetch: vi.fn(),
	storage: new Map<string, string>()
}))

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: mocks.authorizedFetch,
		isAuthenticated: true,
		user: { id: 'user-1', flags: {} }
	})
}))

vi.mock('~/contexts/localStorageStore', () => ({
	useStorageItem: (key: string, fallback: string | null) => mocks.storage.get(key) ?? fallback,
	setStorageItem: (key: string, value: string) => mocks.storage.set(key, value),
	removeStorageItem: (key: string) => mocks.storage.delete(key)
}))

describe('useLlamaAISettings', () => {
	let container: HTMLDivElement
	let root: Root
	let queryClient: QueryClient
	let settingsHook: ReturnType<typeof useLlamaAISettings>

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.authorizedFetch.mockReset()
		mocks.storage.clear()
		queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		queryClient.clear()
		container.remove()
	})

	async function renderHook() {
		function Harness() {
			settingsHook = useLlamaAISettings()
			return null
		}

		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})
	}

	test('serializes saves across remount and keeps the preceding accepted value', async () => {
		let resolveFirstSave: ((response: Response) => void) | null = null
		let putCount = 0
		mocks.authorizedFetch.mockImplementation((_url: string, init?: RequestInit) => {
			if (init?.method !== 'PUT') {
				return Promise.resolve(
					new Response(JSON.stringify({ settings: { enableMemory: true } }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
				)
			}

			putCount += 1
			if (putCount === 1) return new Promise<Response>((resolve) => (resolveFirstSave = resolve))
			return Promise.resolve(new Response(null, { status: 500 }))
		})
		await renderHook()

		let firstSave: Promise<boolean>
		let secondSave: Promise<boolean>
		await act(async () => {
			firstSave = settingsHook.actions.setEnableMemory(false)
			await Promise.resolve()
			root.unmount()
		})
		root = createRoot(container)
		await renderHook()
		await act(async () => {
			secondSave = settingsHook.actions.setEnableMemory(true)
			await Promise.resolve()
		})
		expect(putCount).toBe(1)

		await act(async () => resolveFirstSave?.(new Response(null, { status: 200 })))
		await expect(firstSave!).resolves.toBe(true)
		await expect(secondSave!).resolves.toBe(false)

		const cached = queryClient.getQueryData<SettingsQueryResult>([...LLAMA_AI_SETTINGS_QUERY_KEY, 'user-1'])
		expect(cached?.settings?.enableMemory).toBe(false)
		expect(mocks.storage.get(LLAMA_AI_ENABLE_MEMORY_KEY)).toBe('false')
		expect(toast.error).toHaveBeenCalledWith('Could not save AI settings. Please try again.')
	})

	test('ignores a settings query that predates a successful save', async () => {
		let resolveSettingsQuery: ((response: Response) => void) | null = null
		mocks.authorizedFetch.mockImplementation((_url: string, init?: RequestInit) => {
			if (init?.method === 'PUT') return Promise.resolve(new Response(null, { status: 200 }))
			return new Promise<Response>((resolve) => (resolveSettingsQuery = resolve))
		})
		await renderHook()

		await expect(settingsHook.actions.setCustomInstructions('New instructions')).resolves.toBe(true)
		const saved = queryClient.getQueryData<SettingsQueryResult>([...LLAMA_AI_SETTINGS_QUERY_KEY, 'user-1'])
		expect(saved?.settings?.customInstructions).toBe('New instructions')

		await act(async () => {
			resolveSettingsQuery?.(
				new Response(JSON.stringify({ settings: { customInstructions: 'Old instructions' } }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			await Promise.resolve()
		})

		const cached = queryClient.getQueryData<SettingsQueryResult>([...LLAMA_AI_SETTINGS_QUERY_KEY, 'user-1'])
		expect(cached?.settings?.customInstructions).toBe('New instructions')
	})
})
