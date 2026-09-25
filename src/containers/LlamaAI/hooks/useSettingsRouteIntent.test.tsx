// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { NextRouter } from 'next/router'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useSettingsRouteIntent } from '~/containers/LlamaAI/hooks/useSettingsRouteIntent'
import { WEB_MOBILE_PUSH_QUERY_KEY } from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'

describe('useSettingsRouteIntent', () => {
	let container: HTMLDivElement
	let root: Root
	let queryClient: QueryClient
	const replace = vi.fn(async () => true)
	const show = vi.fn()
	const setInitialIntegrationsState = vi.fn()
	const routerAt = (query: Record<string, string>) =>
		({ isReady: true, pathname: '/ai/chat', query, replace }) as unknown as NextRouter
	const intentRoute = routerAt({ modal: 'settings', tab: 'app' })

	function Harness({ user, router }: { user: unknown; router: NextRouter }) {
		useSettingsRouteIntent({ router, user, settingsModalStore: { show }, setInitialIntegrationsState })
		return null
	}

	async function render(user: unknown, router = intentRoute) {
		await act(async () =>
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness user={user} router={router} />
				</QueryClientProvider>
			)
		)
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		replace.mockClear()
		show.mockClear()
		setInitialIntegrationsState.mockClear()
		window.sessionStorage.clear()
		queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		queryClient.setQueryData(WEB_MOBILE_PUSH_QUERY_KEY, { enabled: false })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		queryClient.clear()
		container.remove()
	})

	test('opens Settings on the requested tab with a fresh push preference and cleans the URL', async () => {
		await render({ id: 'user-1' })

		expect(show).toHaveBeenCalledOnce()
		expect(setInitialIntegrationsState).toHaveBeenCalledWith({ tab: 'app', tgloginToken: null })
		expect(queryClient.getQueryState(WEB_MOBILE_PUSH_QUERY_KEY)?.isInvalidated).toBe(true)
		expect(replace).toHaveBeenCalledWith({ pathname: '/ai/chat', query: {} }, undefined, {
			shallow: true,
			scroll: false
		})
	})

	test('keeps a signed-out intent until the reader signs in, then opens Settings', async () => {
		await render(null)
		expect(show).not.toHaveBeenCalled()
		expect(replace).toHaveBeenCalledOnce()

		// The URL no longer carries the intent once it was cleaned.
		await render({ id: 'user-1' }, routerAt({}))

		expect(show).toHaveBeenCalledOnce()
		expect(setInitialIntegrationsState).toHaveBeenCalledWith(expect.objectContaining({ tab: 'app' }))
	})
})
