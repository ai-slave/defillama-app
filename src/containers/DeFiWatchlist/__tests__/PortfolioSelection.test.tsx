// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DefiWatchlistContainer } from '../index'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/watchlist', query: {} }) }))

type Session = ReturnType<typeof installSubscriberSession>

const savedPreferences = { id: 'preference', active: true, settings: {}, frequency: 'weekly' }
// The features server answers 500 when there is nothing to delete or the account has no subscription.
const refusedDelete = fixtureStatus(500, { error: 'Failed to delete portfolio "Research"' })

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
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

const deletePortfolioButton = () =>
	document.querySelector<HTMLButtonElement>('button[title="Delete current portfolio"]')
const portfolioToolbar = () => document.querySelector('h1')!.parentElement!.textContent

const waitFor = (assertion: () => void) => waitForUi(assertion, { timeout: 1000 })

function servePreferences(session: Session, preferences: typeof savedPreferences | null, onDelete: () => Response) {
	session.serve({
		'/watchlist/preferences': (_url: URL, init?: RequestInit) =>
			init?.method === 'DELETE' ? onDelete() : { preferences }
	})
}

async function createPortfolio(session: Session, name: string) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Toaster />
				<DefiWatchlistContainer protocolOptions={[]} chainOptions={[]} />
			</session.Wrapper>
		)
	)
	await act(async () => button('New')!.click())
	await waitFor(() => expect(document.querySelector('input[name="name"]')).not.toBeNull())
	await act(async () => {
		const input = document.querySelector<HTMLInputElement>('input[name="name"]')!
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => button('Create')!.click())
	await waitFor(() => expect(portfolioToolbar()).toContain(name))
}

async function deletePortfolio() {
	await waitFor(() => expect(deletePortfolioButton()!.disabled).toBe(false))
	await act(async () => deletePortfolioButton()!.click())
}

const preferenceDeletes = (session: Session) =>
	session.requests
		.filter(({ url, init }) => url.pathname === '/watchlist/preferences' && init?.method === 'DELETE')
		.map(({ url }) => url.searchParams.get('portfolioName'))

describe('signed out', () => {
	const session = installSubscriberSession('user', { account: 'signed-out' })

	test('deleting a portfolio removes it without an error', async () => {
		await createPortfolio(session, 'Research')
		await deletePortfolio()

		await waitFor(() => expect(portfolioToolbar()).not.toContain('Research'))
		expect(document.body.textContent).not.toContain('Not authenticated')
	})
})

describe('subscriber', () => {
	const session = installSubscriberSession('user', { resolved: true })

	test('deleting a portfolio without saved notifications removes it without an error', async () => {
		servePreferences(session, null, refusedDelete)
		await createPortfolio(session, 'Research')
		await deletePortfolio()

		await waitFor(() => expect(portfolioToolbar()).not.toContain('Research'))
		expect(preferenceDeletes(session)).toEqual([])
		expect(document.body.textContent).not.toContain('Failed to delete')
	})

	test('deleting a portfolio with saved notifications deletes them on the server', async () => {
		servePreferences(session, savedPreferences, () => new Response(null, { status: 204 }))
		await createPortfolio(session, 'Research')
		await deletePortfolio()

		await waitFor(() => expect(document.body.textContent).toContain('Notification preferences deleted'))
		expect(portfolioToolbar()).not.toContain('Research')
		expect(preferenceDeletes(session)).toEqual(['Research'])
	})

	test('the portfolio cannot be deleted until its saved notifications load', async () => {
		const load = Promise.withResolvers<void>()
		session.serve({
			'/watchlist/preferences': (_url: URL, init?: RequestInit) =>
				init?.method === 'DELETE'
					? new Response(null, { status: 204 })
					: load.promise.then(() => Response.json({ preferences: savedPreferences }))
		})
		await createPortfolio(session, 'Research')

		expect(deletePortfolioButton()!.disabled).toBe(true)
		await act(async () => load.resolve())
		await deletePortfolio()

		await waitFor(() => expect(portfolioToolbar()).not.toContain('Research'))
		expect(preferenceDeletes(session)).toEqual(['Research'])
	})

	test('a failed notification delete keeps the portfolio so the delete can be retried', async () => {
		let deletes = 0
		servePreferences(session, savedPreferences, () =>
			++deletes === 1 ? new Response('Temporary failure', { status: 503 }) : new Response(null, { status: 204 })
		)
		await createPortfolio(session, 'Research')
		await deletePortfolio()

		await waitFor(() => expect(document.body.textContent).toContain('Temporary failure'))
		expect(portfolioToolbar()).toContain('Research')

		await deletePortfolio()
		await waitFor(() => expect(portfolioToolbar()).not.toContain('Research'))
		expect(preferenceDeletes(session)).toEqual(['Research', 'Research'])
	})
})

describe('subscriber whose notification read fails', () => {
	const session = installSubscriberSession('user', { resolved: true })

	test('a failed notification read keeps the portfolio and offers a retry, then deletes on the server', async () => {
		let readsFail = true
		session.serve({
			'/watchlist/preferences': (url: URL, init?: RequestInit) =>
				init?.method === 'DELETE'
					? new Response(null, { status: 204 })
					: readsFail && url.searchParams.get('portfolioName') === 'Research'
						? new Response('Service unavailable', { status: 503 })
						: { preferences: savedPreferences }
		})
		await createPortfolio(session, 'Research')
		// The read has settled once Delete is enabled or the page says why it is not.
		await waitFor(() =>
			expect(!deletePortfolioButton()!.disabled || document.querySelector('[role="alert"]') != null).toBe(true)
		)
		await act(async () => deletePortfolioButton()!.click())

		// Another observer mounting may read again, so the failure can show twice before it stays.
		await waitFor(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toBe(
				"Couldn't load the email notifications for the \"Research\" portfolio, so they can't be changed and the portfolio can't be deleted yet.Try again"
			)
		)
		expect(portfolioToolbar()).toContain('Research')
		expect(preferenceDeletes(session)).toEqual([])

		readsFail = false
		await act(async () => button('Try again')!.click())
		await deletePortfolio()
		await waitFor(() => expect(portfolioToolbar()).not.toContain('Research'))
		expect(preferenceDeletes(session)).toEqual(['Research'])
		expect(document.querySelector('[role="alert"]')).toBeNull()
	})
})

describe('subscriber whose subscription check fails', () => {
	const session = installSubscriberSession('user')

	// The subscription read retries twice (250ms, then 500ms) before it settles as failed.
	test(
		'deleting a portfolio with saved notifications still deletes them on the server',
		{ timeout: 3000 },
		async () => {
			session.serve({ '/subscription/status': fixtureStatus(503, { error: 'Unavailable' }) })
			servePreferences(session, savedPreferences, () => new Response(null, { status: 204 }))
			await createPortfolio(session, 'Research')
			await waitForUi(() => expect(deletePortfolioButton()!.disabled).toBe(false), { timeout: 2000 })
			await act(async () => deletePortfolioButton()!.click())

			await waitFor(() => expect(portfolioToolbar()).not.toContain('Research'))
			expect(preferenceDeletes(session)).toEqual(['Research'])
		}
	)
})

describe('lapsed subscriber', () => {
	const session = installSubscriberSession('user', { account: 'free', resolved: true })

	test('deleting a portfolio with saved notifications removes it without an error', async () => {
		servePreferences(session, savedPreferences, refusedDelete)
		await createPortfolio(session, 'Research')
		await deletePortfolio()

		await waitFor(() => expect(portfolioToolbar()).not.toContain('Research'))
		expect(preferenceDeletes(session)).toEqual([])
		expect(document.body.textContent).not.toContain('Failed to delete')
	})
})
