// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import {
	useWebMobilePushPreference,
	WEB_MOBILE_PUSH_QUERY_KEY,
	WEB_MOBILE_PUSH_SYNC_STORAGE_KEY
} from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'

const session = installSubscriberSession('user-1')
const STATUS_URL = `${AI_SERVER}/mobile-push/web-notifications`
const tokenFor = (id: string, n = 1) => `e30.${btoa(JSON.stringify({ id, n, exp: 4_102_444_800 }))}.signature`
const recordFor = (id: string) => ({
	id,
	email: `${id}@example.com`,
	collectionId: '_pb_users_auth_',
	collectionName: 'users',
	verified: true
})

type Status = { available: boolean; enabled: boolean }

describe('useWebMobilePushPreference', () => {
	let container: HTMLDivElement
	let root: Root
	let result: ReturnType<typeof useWebMobilePushPreference>
	let serverStatus: Status | 'fail' | 'hang'
	let holdPut: ((status: Status) => void) | null
	let putHeld: boolean
	const statusReads = () =>
		session.requests.filter((r) => r.url.href === STATUS_URL && (r.init?.method ?? 'GET') === 'GET').length

	function Harness() {
		result = useWebMobilePushPreference()
		return null
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		serverStatus = { available: true, enabled: true }
		holdPut = null
		putHeld = false
		session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
		session.serve({
			'/api/collections/users/auth-refresh': (_url: URL, init?: RequestInit) => {
				const token = new Headers(init?.headers).get('Authorization')!.replace(/^Bearer /, '')
				return { token, record: recordFor(JSON.parse(atob(token.split('.')[1]!)).id) }
			},
			[STATUS_URL]: (_url: URL, init?: RequestInit) => {
				if (init?.method === 'PUT') {
					const { enabled } = JSON.parse(init.body as string) as { enabled: boolean }
					const status = { available: true, enabled }
					// The server keeps what it accepted, so a later read agrees with the toggle.
					if (!putHeld) return (serverStatus = status)
					return new Promise<Response>(
						(resolve) =>
							(holdPut = (next) => {
								serverStatus = next
								resolve(Response.json(next))
							})
					)
				}
				if (serverStatus === 'hang') return new Promise<never>(() => {})
				if (serverStatus === 'fail') return Response.json({ error: 'Network unavailable' }, { status: 400 })
				return serverStatus
			}
		})
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	async function renderHook() {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<Harness />
				</session.Wrapper>
			)
		)
	}

	async function waitForPreference(preference: ReturnType<typeof useWebMobilePushPreference>['preference']) {
		await vi.waitFor(() => expect(result.preference).toEqual(preference))
	}

	const ENABLED = { kind: 'known', available: true, enabled: true } as const
	const DISABLED = { kind: 'known', available: true, enabled: false } as const

	/** Starts a toggle whose server response the test releases, and returns how to finish it. */
	async function startHeldToggle() {
		putHeld = true
		let mutation!: Promise<unknown>
		await act(async () => {
			mutation = result.setEnabled.mutateAsync(false).catch(() => undefined)
		})
		await vi.waitFor(() => expect(holdPut).not.toBeNull())
		return async () =>
			act(async () => {
				holdPut!({ available: true, enabled: false })
				await mutation
			})
	}

	test('reports loading while the first status request is in flight', async () => {
		serverStatus = 'hang'
		await renderHook()

		expect(result.preference).toEqual({ kind: 'loading' })
	})

	test('reports an error with a retry that recovers', async () => {
		serverStatus = 'fail'
		await renderHook()
		await vi.waitFor(() => expect(result.preference.kind).toBe('error'))
		expect(result.preference).toMatchObject({ kind: 'error', message: 'Network unavailable' })

		serverStatus = { available: true, enabled: false }
		await act(async () => result.preference.kind === 'error' && result.preference.retry())

		await waitForPreference(DISABLED)
	})

	test('keeps a known preference when a background refetch fails', async () => {
		await renderHook()
		await waitForPreference(ENABLED)
		serverStatus = 'fail'

		await act(async () => session.client.invalidateQueries({ queryKey: WEB_MOBILE_PUSH_QUERY_KEY }))
		await vi.waitFor(() => expect(statusReads()).toBe(2))

		expect(result.preference).toEqual(ENABLED)
	})

	test('keeps available and enabled as independent fields', async () => {
		serverStatus = { available: false, enabled: true }
		await renderHook()

		await vi.waitFor(() => expect(result.preference).toEqual({ kind: 'known', available: false, enabled: true }))
	})

	test('reports signed-out without requesting a status', async () => {
		pb.authStore.clear()
		await renderHook()

		expect(result.preference).toEqual({ kind: 'signed-out' })
		expect(statusReads()).toBe(0)
	})

	test('applies another tab’s broadcast only for the current user', async () => {
		serverStatus = { available: true, enabled: false }
		await renderHook()
		await waitForPreference(DISABLED)
		const broadcast = (userId: string) =>
			act(async () =>
				window.dispatchEvent(
					new StorageEvent('storage', {
						key: WEB_MOBILE_PUSH_SYNC_STORAGE_KEY,
						newValue: JSON.stringify({ userId, status: { available: true, enabled: true }, eventId: userId })
					})
				)
			)

		await broadcast('user-2')
		expect(result.preference).toEqual(DISABLED)

		await broadcast('user-1')
		await waitForPreference(ENABLED)
	})

	test('shows and broadcasts the saved status after a toggle succeeds', async () => {
		await renderHook()
		await waitForPreference(ENABLED)

		await act(async () => result.setEnabled.mutateAsync(false))

		await waitForPreference(DISABLED)
		expect(JSON.parse(localStorage.getItem(WEB_MOBILE_PUSH_SYNC_STORAGE_KEY)!)).toMatchObject({
			userId: 'user-1',
			status: { available: true, enabled: false }
		})
	})

	test('drops a toggle result that lands after a different account signed in', async () => {
		await renderHook()
		await waitForPreference(ENABLED)
		const finish = await startHeldToggle()

		await act(async () => pb.authStore.save(tokenFor('user-2'), recordFor('user-2')))
		await waitForPreference(ENABLED)
		await finish()

		expect(session.client.getQueryData([...WEB_MOBILE_PUSH_QUERY_KEY, 'user-1'])).toEqual({
			available: true,
			enabled: true
		})
		expect(localStorage.getItem(WEB_MOBILE_PUSH_SYNC_STORAGE_KEY)).toBeNull()
	})

	test('applies a toggle result after the same account’s token refreshes', async () => {
		await renderHook()
		await waitForPreference(ENABLED)
		const finish = await startHeldToggle()

		await act(async () => pb.authStore.save(tokenFor('user-1', 2), recordFor('user-1')))
		await finish()

		await waitForPreference(DISABLED)
		expect(JSON.parse(localStorage.getItem(WEB_MOBILE_PUSH_SYNC_STORAGE_KEY)!)).toMatchObject({ userId: 'user-1' })
	})

	test('drops a toggle result that lands after the session ended', async () => {
		await renderHook()
		await waitForPreference(ENABLED)
		const finish = await startHeldToggle()

		await act(async () => pb.authStore.clear())
		await finish()

		expect(session.client.getQueryData([...WEB_MOBILE_PUSH_QUERY_KEY, 'user-1'])).toEqual({
			available: true,
			enabled: true
		})
		expect(localStorage.getItem(WEB_MOBILE_PUSH_SYNC_STORAGE_KEY)).toBeNull()
	})
})
