// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	useWebMobilePushPreference,
	WEB_MOBILE_PUSH_QUERY_KEY,
	WEB_MOBILE_PUSH_SYNC_STORAGE_KEY
} from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'

const mocks = vi.hoisted(() => ({
	getStatus: vi.fn(),
	setEnabled: vi.fn(),
	authorizedFetch: vi.fn(),
	userId: 'user-1' as string | null,
	isAuthenticated: true,
	sessionToken: 'token-1',
	sessionValid: true
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: mocks.authorizedFetch,
		isAuthenticated: mocks.isAuthenticated,
		user: mocks.userId ? { id: mocks.userId } : null
	})
}))

vi.mock('~/auth/authStore', () => ({
	getAuthStoreSnapshot: () => ({ token: mocks.sessionToken, isValid: mocks.sessionValid })
}))

vi.mock('~/containers/LlamaAI/api/mobilePush', () => ({
	getWebMobilePushStatus: mocks.getStatus,
	setWebMobilePushEnabled: mocks.setEnabled
}))

describe('useWebMobilePushPreference', () => {
	let container: HTMLDivElement
	let root: Root
	let queryClient: QueryClient
	let result: ReturnType<typeof useWebMobilePushPreference>

	function Harness() {
		result = useWebMobilePushPreference()
		return null
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		mocks.userId = 'user-1'
		mocks.isAuthenticated = true
		mocks.sessionToken = 'token-1'
		mocks.sessionValid = true
		mocks.getStatus.mockResolvedValue({ available: true, enabled: true })
		mocks.setEnabled.mockImplementation(async (_fetch, enabled: boolean) => ({ available: true, enabled }))
		window.localStorage.clear()
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
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})
	}

	async function waitForPreference(kind: ReturnType<typeof useWebMobilePushPreference>['preference']['kind']) {
		await vi.waitFor(() => expect(result.preference.kind).toBe(kind))
	}

	it('returns loading while the query is pending without data', async () => {
		mocks.getStatus.mockReturnValue(new Promise(() => undefined))

		await renderHook()

		expect(result.preference).toEqual({ kind: 'loading' })
	})

	it('returns error with a retry when the query fails', async () => {
		mocks.getStatus.mockRejectedValueOnce(new Error('Network unavailable'))
		await renderHook()
		await waitForPreference('error')

		expect(result.preference).toMatchObject({ kind: 'error', message: 'Network unavailable' })
		if (result.preference.kind !== 'error') throw new Error('Expected error preference')
		mocks.getStatus.mockResolvedValueOnce({ available: true, enabled: false })
		act(() => result.preference.kind === 'error' && result.preference.retry())

		await vi.waitFor(() => expect(result.preference).toEqual({ kind: 'known', available: true, enabled: false }))
	})

	it('keeps a known preference when a background refetch fails', async () => {
		await renderHook()
		await waitForPreference('known')
		mocks.getStatus.mockRejectedValueOnce(new Error('Refetch unavailable'))

		await act(async () => queryClient.invalidateQueries({ queryKey: WEB_MOBILE_PUSH_QUERY_KEY }))

		expect(queryClient.getQueryState([...WEB_MOBILE_PUSH_QUERY_KEY, 'user-1'])?.status).toBe('error')
		expect(result.preference).toEqual({ kind: 'known', available: true, enabled: true })
	})

	it('keeps available and enabled as independent fields', async () => {
		mocks.getStatus.mockResolvedValue({ available: false, enabled: true })

		await renderHook()
		await waitForPreference('known')

		expect(result.preference).toEqual({ kind: 'known', available: false, enabled: true })
	})

	it('returns signed-out without starting a preference query', async () => {
		mocks.userId = null
		mocks.isAuthenticated = false

		await renderHook()

		expect(result.preference).toEqual({ kind: 'signed-out' })
		expect(mocks.getStatus).not.toHaveBeenCalled()
	})

	it('applies storage updates only for the current user', async () => {
		mocks.getStatus.mockResolvedValue({ available: true, enabled: false })
		await renderHook()
		await vi.waitFor(() => expect(result.preference).toEqual({ kind: 'known', available: true, enabled: false }))

		await act(async () => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: WEB_MOBILE_PUSH_SYNC_STORAGE_KEY,
					newValue: JSON.stringify({
						userId: 'user-2',
						status: { available: true, enabled: true },
						eventId: 'other-user'
					})
				})
			)
		})
		expect(result.preference).toEqual({ kind: 'known', available: true, enabled: false })

		await act(async () => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: WEB_MOBILE_PUSH_SYNC_STORAGE_KEY,
					newValue: JSON.stringify({
						userId: 'user-1',
						status: { available: true, enabled: true },
						eventId: 'current-user'
					})
				})
			)
		})
		await vi.waitFor(() => expect(result.preference).toEqual({ kind: 'known', available: true, enabled: true }))
	})

	it('updates the user-keyed cache and localStorage after setEnabled succeeds', async () => {
		await renderHook()
		await waitForPreference('known')

		await act(async () => result.setEnabled.mutateAsync(false))

		expect(queryClient.getQueryData([...WEB_MOBILE_PUSH_QUERY_KEY, 'user-1'])).toEqual({
			available: true,
			enabled: false
		})
		expect(JSON.parse(window.localStorage.getItem(WEB_MOBILE_PUSH_SYNC_STORAGE_KEY) ?? '{}')).toMatchObject({
			userId: 'user-1',
			status: { available: true, enabled: false }
		})
	})

	it('refetches when the settings-open handler invalidates the preference query', async () => {
		await renderHook()
		await waitForPreference('known')
		expect(mocks.getStatus).toHaveBeenCalledOnce()

		await act(async () => queryClient.invalidateQueries({ queryKey: WEB_MOBILE_PUSH_QUERY_KEY }))

		expect(mocks.getStatus).toHaveBeenCalledTimes(2)
	})

	it('does not apply a mutation result after the request user changes', async () => {
		let resolveMutation: ((status: { available: boolean; enabled: boolean }) => void) | null = null
		mocks.setEnabled.mockReturnValueOnce(new Promise((resolve) => (resolveMutation = resolve)))
		await renderHook()
		await waitForPreference('known')

		let mutation = Promise.resolve<unknown>(undefined)
		act(() => {
			mutation = result.setEnabled.mutateAsync(false)
		})
		mocks.userId = 'user-2'
		await renderHook()
		await waitForPreference('known')
		await act(async () => {
			resolveMutation?.({ available: true, enabled: false })
			await mutation
		})

		expect(queryClient.getQueryData([...WEB_MOBILE_PUSH_QUERY_KEY, 'user-1'])).toEqual({
			available: true,
			enabled: true
		})
		expect(window.localStorage.getItem(WEB_MOBILE_PUSH_SYNC_STORAGE_KEY)).toBeNull()
	})

	it('applies a mutation result after the same user token refreshes', async () => {
		let resolveMutation: ((status: { available: boolean; enabled: boolean }) => void) | null = null
		mocks.setEnabled.mockReturnValueOnce(new Promise((resolve) => (resolveMutation = resolve)))
		await renderHook()
		await waitForPreference('known')

		let mutation = Promise.resolve<unknown>(undefined)
		act(() => {
			mutation = result.setEnabled.mutateAsync(false)
		})
		mocks.sessionToken = 'token-2'
		await act(async () => {
			resolveMutation?.({ available: true, enabled: false })
			await mutation
		})

		expect(queryClient.getQueryData([...WEB_MOBILE_PUSH_QUERY_KEY, 'user-1'])).toEqual({
			available: true,
			enabled: false
		})
		expect(JSON.parse(window.localStorage.getItem(WEB_MOBILE_PUSH_SYNC_STORAGE_KEY) ?? '{}')).toMatchObject({
			userId: 'user-1',
			status: { available: true, enabled: false }
		})
	})

	it('does not apply a mutation result after the auth session becomes invalid', async () => {
		let resolveMutation: ((status: { available: boolean; enabled: boolean }) => void) | null = null
		mocks.setEnabled.mockReturnValueOnce(new Promise((resolve) => (resolveMutation = resolve)))
		await renderHook()
		await waitForPreference('known')

		let mutation = Promise.resolve<unknown>(undefined)
		act(() => {
			mutation = result.setEnabled.mutateAsync(false)
		})
		mocks.sessionValid = false
		await act(async () => {
			resolveMutation?.({ available: true, enabled: false })
			await mutation
		})

		expect(queryClient.getQueryData([...WEB_MOBILE_PUSH_QUERY_KEY, 'user-1'])).toEqual({
			available: true,
			enabled: true
		})
		expect(window.localStorage.getItem(WEB_MOBILE_PUSH_SYNC_STORAGE_KEY)).toBeNull()
	})
})
