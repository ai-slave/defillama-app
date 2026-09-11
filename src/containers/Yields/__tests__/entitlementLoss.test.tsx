// @vitest-environment happy-dom
//
// Losing entitlement must empty the measured surfaces on the NEXT RENDER. React Query's
// `enabled: false` only stops refetching — it keeps handing back whatever is cached — so a gate
// built on `enabled` alone leaves paid data on screen after logout or expiry.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const auth = vi.hoisted(() => ({
	authorizedFetch: vi.fn(),
	hasActiveSubscription: true,
	isAuthenticated: true,
	loaders: { userLoading: false }
}))
vi.mock('~/auth', () => ({ useAuthContext: () => auth }))

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({
	fetchJson,
	handleSimpleFetchResponse: async (res: any) => res
}))

const routerMock = vi.hoisted(() => ({
	isReady: true,
	query: {},
	push: vi.fn(),
	replace: vi.fn(),
	pathname: '/yields'
}))
vi.mock('next/router', () => ({ useRouter: () => routerMock }))

import { usePoolVerifiedProps } from '../poolDetail/useVerifiedProps'
import { useYieldsPaginatedTable } from '../queries.client'
import { useYieldsServerTable } from '../useYieldsServerTable'

const MEASURED = { verified: { apy: { avg_1d: 2.58 } }, verifiedWindows: [], supplyChart: null }

describe('measured data after entitlement loss', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		auth.hasActiveSubscription = true
		auth.isAuthenticated = true
		auth.loaders.userLoading = false
		auth.authorizedFetch.mockReset()
		fetchJson.mockReset()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	/**
	 * React Query settles asynchronously and then notifies subscribers, so the harness has to yield
	 * a macrotask before the captured render reflects the result.
	 */
	const tick = () =>
		act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
	const flush = async () => {
		await tick()
		await tick()
		await tick()
	}

	test('drops the pool page measured props the moment the subscription lapses', async () => {
		auth.authorizedFetch.mockResolvedValue({ json: async () => MEASURED })
		let latest: ReturnType<typeof usePoolVerifiedProps>
		function Harness() {
			latest = usePoolVerifiedProps({ poolId: 'p', range: 'max', locked: true })
			return null
		}
		const render = async () => {
			await act(async () => {
				root.render(
					<QueryClientProvider client={client}>
						<Harness />
					</QueryClientProvider>
				)
			})
		}

		await render()
		await flush()
		expect(latest!.props.verified).not.toBeNull()

		// Subscription lapses. The result is still in the cache under the paid key.
		auth.hasActiveSubscription = false
		await render()
		await flush()

		expect(latest!.props.verified).toBeNull()
		expect(latest!.props.verifiedWindows).toEqual([])
		expect(JSON.stringify(latest!.props)).not.toContain('2.58')
	})

	test('never paints the paid page as a placeholder while switching to the public one', async () => {
		auth.authorizedFetch.mockResolvedValue({ json: async () => ({ rows: [{ id: 'measured' }], total: 1 }) })
		let latest: any
		function Harness() {
			latest = useYieldsPaginatedTable('/public', '?page=1', undefined, '/private')
			return null
		}
		const render = async () => {
			await act(async () => {
				root.render(
					<QueryClientProvider client={client}>
						<Harness />
					</QueryClientProvider>
				)
			})
		}

		await render()
		await flush()
		expect(latest.data?.rows).toEqual([{ id: 'measured' }])

		// Log out, and hold the public request open so only the placeholder could render.
		auth.hasActiveSubscription = false
		fetchJson.mockImplementation(() => new Promise(() => {}))
		await render()
		await flush()

		expect(latest.data).toBeUndefined()
		expect(JSON.stringify(latest.data ?? null)).not.toContain('measured')
	})

	// The server may have seeded the page with the paid rows. Once the client knows access is gone,
	// they must leave before the public request answers, not linger as a placeholder.
	test('drops a paid seed from the server table the moment the subscription lapses', async () => {
		fetchJson.mockImplementation(() => new Promise(() => {}))
		const paidPage = { rows: [{ id: 'measured', verifiedApy: 2.58 }], total: 1, page: 1, pageSize: 50, hasMore: false }
		let latest: ReturnType<typeof useYieldsServerTable<{ id: string }>>
		function Harness() {
			latest = useYieldsServerTable<{ id: string }>({
				endpoint: '/public',
				privateEndpoint: '/private',
				initialSeed: { initialData: paidPage, initialDataUpdatedAt: Date.now(), verifiedAccess: true }
			})
			return null
		}
		const render = async () => {
			await act(async () => {
				root.render(
					<QueryClientProvider client={client}>
						<Harness />
					</QueryClientProvider>
				)
			})
		}

		await render()
		expect(latest!.rows.map((row) => row.id)).toEqual(['measured'])

		auth.hasActiveSubscription = false
		await render()
		await flush()

		expect(latest!.rows).toEqual([])
		expect(latest!.isLoading).toBe(true)
		expect(JSON.stringify(latest!.rows)).not.toContain('2.58')
	})

	test('keeps a paid SSR seed and holds network fetches while entitlement is unknown', async () => {
		auth.loaders.userLoading = true
		const paidPage = { rows: [{ id: 'measured', verifiedApy: 2.58 }], total: 1, page: 1, pageSize: 50, hasMore: false }
		let latest: ReturnType<typeof useYieldsServerTable<{ id: string }>>
		function Harness() {
			latest = useYieldsServerTable<{ id: string }>({
				endpoint: '/public',
				privateEndpoint: '/private',
				initialSeed: { initialData: paidPage, initialDataUpdatedAt: Date.now(), verifiedAccess: true }
			})
			return null
		}
		const render = async () => {
			await act(async () => {
				root.render(
					<QueryClientProvider client={client}>
						<Harness />
					</QueryClientProvider>
				)
			})
		}

		await render()

		expect(latest!.rows.map((row) => row.id)).toEqual(['measured'])
		expect(fetchJson).not.toHaveBeenCalled()
		expect(auth.authorizedFetch).not.toHaveBeenCalled()

		auth.loaders.userLoading = false
		await render()
		await flush()

		expect(latest!.rows.map((row) => row.id)).toEqual(['measured'])
		expect(fetchJson).not.toHaveBeenCalled()
		expect(auth.authorizedFetch).not.toHaveBeenCalled()
	})
})
