// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { PortfolioNotifications } from '../index'

const session = installSubscriberSession('user')

const preferences = {
	id: 'preference',
	active: true,
	settings: { protocols: { aave: ['tvl'] } },
	frequency: 'weekly'
}

let root: Root
let container: HTMLDivElement
let writes: Array<PromiseWithResolvers<Response>>

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	writes = []
	// Writes stay pending until the test settles them, so the pending state is observable.
	const write = () => {
		const next = Promise.withResolvers<Response>()
		writes.push(next)
		return next.promise
	}
	session.serve({
		'/watchlist/preferences': (_url: URL, init?: RequestInit) =>
			(init?.method ?? 'GET') === 'GET' ? { preferences } : write(),
		'/watchlist/status': write
	})
	vi.spyOn(console, 'error').mockImplementation(() => {})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(element) => element.textContent?.trim() === name
	)
}

const waitFor = (assertion: () => void) => vi.waitFor(assertion, { timeout: 1000 })

test.each([
	['Disable', 'Disabling...', 'Notification preferences disabled'],
	['Delete', 'Deleting...', 'Notification preferences deleted']
])('%s shows a failure, releases the control, and succeeds on retry', async (action, pending, success) => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Toaster />
				<PortfolioNotifications selectedPortfolio="QA" filteredProtocols={[{ slug: 'aave' }]} />
			</session.Wrapper>
		)
	)
	await waitFor(() => expect(button(action)?.disabled).toBe(false))

	await act(async () => button(action)!.click())
	await waitFor(() => expect(button(pending)?.disabled).toBe(true))

	await act(async () => writes[0]!.resolve(new Response('Temporary failure', { status: 503 })))
	await waitFor(() => expect(document.body.textContent).toContain('Temporary failure'))
	expect(button(action)?.disabled).toBe(false)

	await act(async () => button(action)!.click())
	await waitFor(() => expect(writes).toHaveLength(2))
	await act(async () => writes[1]!.resolve(new Response(null, { status: 204 })))
	await waitFor(() => expect(document.body.textContent).toContain(success))
})
