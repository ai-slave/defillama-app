// @vitest-environment happy-dom
//
// Losing entitlement must empty the measured surfaces on the NEXT RENDER. React Query's
// `enabled: false` only stops refetching — it keeps handing back whatever is cached — so a gate
// built on `enabled` alone leaves paid data on screen after logout or expiry.

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { useYieldsPaginatedTable } from '../queries.client'
import { useYieldsServerTable } from '../useYieldsServerTable'

vi.mock('next/router', () => ({
	useRouter: () => ({ isReady: true, query: {}, push: vi.fn(), replace: vi.fn(), pathname: '/yields' })
}))

const session = installSubscriberSession('subscriber-1')

const PAID_PAGE = { rows: [{ id: 'measured', verifiedApy: 2.58 }], total: 1, page: 1, pageSize: 50, hasMore: false }
const never = () => new Promise<never>(() => {})
const requestedPaths = () => session.requests.map((request) => request.url.pathname)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

/** Renders `useHook` inside the real auth provider and returns a reader for its latest result. */
async function mount<T>(useHook: () => T) {
	let latest: T
	function Harness() {
		latest = useHook()
		return null
	}
	await act(async () => {
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	})
	return () => latest
}

const signOut = () => act(async () => pb.authStore.clear())
const settle = (check: () => void) => waitForUi(check, { timeout: 1000, interval: 5 })

describe('measured data after entitlement loss', () => {
	test('the paid page is never painted as a placeholder while the public one loads', async () => {
		// The public request is held open, so only a placeholder could render.
		session.serve({ '/private': { rows: [{ id: 'measured' }], total: 1 }, '/public': never })
		const latest = await mount(() => useYieldsPaginatedTable('/public', '?page=1', undefined, '/private'))
		await settle(() => expect(latest().data?.rows).toEqual([{ id: 'measured' }]))

		await signOut()
		await settle(() => expect(requestedPaths()).toContain('/public'))

		expect(latest().data).toBeUndefined()
	})

	// The server may have seeded the page with the paid rows. Once the client knows access is gone,
	// they must leave before the public request answers, not linger as a placeholder.
	test('a paid server seed leaves the table the moment the reader signs out', async () => {
		session.serve({ '/public': never })
		const latest = await mount(() =>
			useYieldsServerTable<{ id: string }>({
				endpoint: '/public',
				privateEndpoint: '/private',
				initialSeed: { initialData: PAID_PAGE, initialDataUpdatedAt: Date.now(), verifiedAccess: true }
			})
		)
		await settle(() => expect(latest().rows.map((row) => row.id)).toEqual(['measured']))

		await signOut()

		expect(latest().rows).toEqual([])
		expect(latest().isLoading).toBe(true)
	})

	test('while the entitlement lookup is in flight, a paid seed stays and no rows are fetched', async () => {
		let answerStatus!: (response: Response) => void
		session.serve({
			'/subscription/status': () => new Promise<Response>((resolve) => (answerStatus = resolve))
		})
		const latest = await mount(() =>
			useYieldsServerTable<{ id: string }>({
				endpoint: '/public',
				privateEndpoint: '/private',
				initialSeed: { initialData: PAID_PAGE, initialDataUpdatedAt: Date.now(), verifiedAccess: true }
			})
		)
		await settle(() => expect(requestedPaths()).toContain('/subscription/status'))

		expect(latest().rows.map((row) => row.id)).toEqual(['measured'])

		await act(async () =>
			answerStatus(Response.json({ subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } }))
		)
		await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

		// The seed matches the tier that resolved, so it is still fresh and nothing is refetched.
		expect(latest().rows.map((row) => row.id)).toEqual(['measured'])
		expect(requestedPaths().filter((path) => path === '/public' || path === '/private')).toEqual([])
	})
})
