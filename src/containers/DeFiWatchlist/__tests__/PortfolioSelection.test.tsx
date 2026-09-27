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
		document.querySelector<HTMLInputElement>('input[name="name"]')!.value = name
		button('Save')!.click()
	})
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
