// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { NextRouter } from 'next/router'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsRouteIntent } from '~/containers/LlamaAI/hooks/useSettingsRouteIntent'
import { WEB_MOBILE_PUSH_QUERY_KEY } from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'

const mocks = vi.hoisted(() => ({
	authorizedFetch: vi.fn()
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ authorizedFetch: mocks.authorizedFetch })
}))

vi.mock('~/containers/LlamaAI/api/slack', () => ({
	consumeSlackLogin: vi.fn()
}))

vi.mock('react-hot-toast', () => ({
	toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))

describe('useSettingsRouteIntent', () => {
	let container: HTMLDivElement
	let root: Root
	let queryClient: QueryClient

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		window.sessionStorage.clear()
		queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		queryClient.clear()
		container.remove()
	})

	it('invalidates the mobile push preference before opening Settings from a route intent', async () => {
		const replace = vi.fn(async () => true)
		const router = {
			isReady: true,
			pathname: '/ai/chat',
			query: { modal: 'settings', tab: 'app' },
			replace
		} as unknown as NextRouter
		const settingsModalStore = { show: vi.fn() }
		const setInitialIntegrationsState = vi.fn()
		const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

		function Harness() {
			useSettingsRouteIntent({
				router,
				user: { id: 'user-1' },
				settingsModalStore,
				setInitialIntegrationsState
			})
			return null
		}

		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})

		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: WEB_MOBILE_PUSH_QUERY_KEY })
		expect(settingsModalStore.show).toHaveBeenCalledOnce()
		expect(setInitialIntegrationsState).toHaveBeenCalledWith({ tab: 'app', tgloginToken: null })
		expect(replace).toHaveBeenCalledWith({ pathname: '/ai/chat', query: {} }, undefined, {
			shallow: true,
			scroll: false
		})
	})
})
