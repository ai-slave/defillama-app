// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { subscriptionStatusQueryKey } from '~/auth/subscriptionStatus'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { useIsSqlAllowed } from '../useIsSqlAllowed'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))

const session = installSubscriberSession('u1', { resolved: true })
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	// A failed subscription read retries twice, 250ms then 500ms later, before the hook sees the error. Fake timers run
	// those waits, and the zero-delay timers React Query notifies with, at once.
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	session.client.setQueryData(subscriptionStatusQueryKey('u1'), {
		status: 'active',
		type: 'api',
		expires_at: '2100-01-01'
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	vi.useRealTimers()
	await act(async () => root.unmount())
	container.remove()
})

function Access() {
	const access = useIsSqlAllowed()
	return <p>{access.isUnknown ? 'unknown' : access.isAllowed ? 'allowed' : 'not allowed'}</p>
}

async function failNextRead() {
	session.serve({ '/subscription/status': fixtureStatus(503, { message: 'Unavailable' }) })
	await act(async () => {
		void session.client.refetchQueries({ queryKey: subscriptionStatusQueryKey('u1') })
		await vi.runAllTimersAsync()
	})
}

test('a failed refresh of a known API plan keeps SQL access', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Access />
			</session.Wrapper>
		)
	)
	expect(container.textContent).toBe('allowed')
	await failNextRead()
	expect(container.textContent).toBe('allowed')
})

test('a subscription that never loaded leaves SQL access unknown', async () => {
	session.client.removeQueries({ queryKey: subscriptionStatusQueryKey('u1') })
	session.serve({ '/subscription/status': fixtureStatus(503, { message: 'Unavailable' }) })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Access />
			</session.Wrapper>
		)
	)
	await act(() => vi.runAllTimersAsync())
	await waitForUi(() => expect(container.textContent).toBe('unknown'))
})
