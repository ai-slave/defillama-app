// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fieldErrorOf } from '~/utils/testing/fieldErrors'
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
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((element) => accessibleName(element) === name)
}

const waitFor = (assertion: () => void) => waitForUi(assertion, { timeout: 1000 })

async function renderCard() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Toaster />
				<PortfolioNotifications selectedPortfolio="QA" filteredProtocols={[{ slug: 'aave' }]} />
			</session.Wrapper>
		)
	)
}

test('Disable shows a failure, releases the control, and succeeds on retry', async () => {
	await renderCard()
	await waitFor(() => expect(button('Disable')?.disabled).toBe(false))

	await act(async () => button('Disable')!.click())
	await waitFor(() => expect(button('Updating…')?.getAttribute('aria-busy')).toBe('true'))

	await act(async () => writes[0]!.resolve(new Response('Temporary failure', { status: 503 })))
	await waitFor(() => expect(document.body.textContent).toContain('Temporary failure'))
	expect(button('Disable')?.disabled).toBe(false)

	await act(async () => button('Disable')!.click())
	await waitFor(() => expect(writes).toHaveLength(2))
	await act(async () => writes[1]!.resolve(new Response(null, { status: 204 })))
	await waitFor(() => expect(document.body.textContent).toContain('Notification preferences disabled'))
})

test('a Disable that fails after leaving the page still says so', async () => {
	await renderCard()
	await waitFor(() => expect(button('Disable')?.disabled).toBe(false))
	await act(async () => button('Disable')!.click())
	await waitFor(() => expect(writes).toHaveLength(1))

	// Navigating away unmounts the card; the app's toaster stays.
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Toaster />
			</session.Wrapper>
		)
	)
	await act(async () => writes[0]!.resolve(new Response('Temporary failure', { status: 503 })))
	await waitFor(() => expect(document.body.textContent).toContain('Temporary failure'))
})

test('Delete asks first, shows a failure in the confirmation, and deletes on retry', async () => {
	await renderCard()
	await waitFor(() => expect(button('Delete')?.disabled).toBe(false))

	await act(async () => button('Delete')!.click())
	const confirm = () => document.querySelector('[role="alertdialog"]')
	expect(confirm()?.textContent).toContain('Delete email notifications?')
	expect(writes).toHaveLength(0)

	const confirmDelete = () =>
		[...confirm()!.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === 'Delete')!
	await act(async () => confirmDelete().click())
	await waitFor(() => expect(writes).toHaveLength(1))
	await act(async () => writes[0]!.resolve(new Response('Temporary failure', { status: 503 })))
	await waitFor(() => expect(confirm()?.querySelector('[role="alert"]')?.textContent).toContain('Temporary failure'))

	await act(async () => confirmDelete().click())
	await waitFor(() => expect(writes).toHaveLength(2))
	await act(async () => writes[1]!.resolve(new Response(null, { status: 204 })))
	await waitFor(() => expect(confirm()).toBeNull())
	await waitFor(() => expect(document.body.textContent).toContain('Notification preferences deleted'))
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

test('a failed settings save keeps its error on screen while the retry saves', async () => {
	await renderCard()
	await waitFor(() => expect(button('Update settings')?.disabled).toBe(false))
	await act(async () => button('Update settings')!.click())
	const dialog = () => document.querySelector('[role="dialog"]')
	await waitFor(() => expect(dialog()).not.toBeNull())
	const save = () =>
		[...dialog()!.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].find((el) => el.closest('form'))!

	await act(async () => save().click())
	await waitFor(() => expect(writes).toHaveLength(1))
	await act(async () => writes[0]!.resolve(new Response('Temporary failure', { status: 503 })))
	await waitFor(() => expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe('Temporary failure'))

	await act(async () => save().click())
	await waitFor(() => expect(writes).toHaveLength(2))
	await waitFor(() => expect(save().getAttribute('aria-busy')).toBe('true'))
	expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe('Temporary failure')
	await act(async () => writes[1]!.resolve(Response.json({ preferences })))
	await waitFor(() => expect(document.body.textContent).toContain('Notification preferences saved'))
})

test('saving with no metric picked says so under the metrics and focuses the first one, without a write', async () => {
	await renderCard()
	await waitFor(() => expect(button('Update settings')?.disabled).toBe(false))
	await act(async () => button('Update settings')!.click())
	const dialog = () => document.querySelector('[role="dialog"]')!
	await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
	const boxes = () => [...dialog().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
	const picked = boxes().find((box) => box.checked)!
	await act(async () => picked.click())
	const group = picked.closest('[role="group"]')!
	expect(fieldErrorOf(group)).toBeNull()

	const save = [...dialog().querySelectorAll<HTMLButtonElement>('button[type="submit"]')].find((el) =>
		el.closest('form')
	)!
	await act(async () => save.click())
	expect(fieldErrorOf(group)).toBe('Choose at least one protocol or chain metric.')
	expect(document.activeElement).toBe(boxes()[0])
	expect(writes).toHaveLength(0)
	await act(async () => picked.click())
	expect(fieldErrorOf(group)).toBeNull()
})
