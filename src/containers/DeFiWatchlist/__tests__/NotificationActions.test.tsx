// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
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

const waitFor = (assertion: () => void) => waitForUi(assertion, { timeout: 1000 })

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

test('a failed read offers no setup over the saved preferences, and a retry shows them', async () => {
	let readsFail = true
	session.serve({
		'/watchlist/preferences': () =>
			readsFail ? new Response('Service unavailable', { status: 503 }) : Response.json({ preferences })
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<PortfolioNotifications selectedPortfolio="QA" filteredProtocols={[{ slug: 'aave' }]} />
			</session.Wrapper>
		)
	)
	// The read has settled once setup is offered or the card says why it is not.
	await waitFor(() =>
		expect(button('Set up notifications')?.disabled === false || button('Try again') !== undefined).toBe(true)
	)

	expect(button('Set up notifications')).toBeUndefined()
	expect(document.querySelector('[role="alert"]')?.textContent).toBe(
		"Couldn't load the email notifications for the \"QA\" portfolio, so they can't be changed and the portfolio can't be deleted yet.Try again"
	)

	readsFail = false
	await act(async () => button('Try again')!.click())
	await waitFor(() => expect(document.body.textContent).toContain('Tracking 1 protocol(s) - tvl'))
	expect(document.body.textContent).toContain('Weekly email notifications are active for "QA" portfolio')
	expect(button('Update settings')?.disabled).toBe(false)
	expect(document.querySelector('[role="alert"]')).toBeNull()
})
