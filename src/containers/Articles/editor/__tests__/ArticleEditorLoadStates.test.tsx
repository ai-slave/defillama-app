// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ArticleEditorClient } from '../ArticleEditorClient'

const router = vi.hoisted(() => ({
	query: {},
	asPath: '/research/new',
	isReady: true,
	replace: vi.fn(),
	events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() }
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
const session = installSubscriberSession('article-editor')

const createUrl = `${FEATURES_SERVER}/articles`
const createRequests = () =>
	session.requests.filter((request) => request.url.href === createUrl && request.init?.method === 'POST')

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	router.replace.mockReset()
	session.client.setDefaultOptions({ queries: { retry: false } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function mount(articleId?: string) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AppMetadataProvider>
					<ArticleEditorClient articleId={articleId} />
				</AppMetadataProvider>
			</session.Wrapper>
		)
	)
}

async function settle(ms = 50) {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms))
	})
}

function alertText() {
	return container.querySelector('[role="alert"]')?.textContent
}

test('a failed draft create is attempted once, shows the error inline, and Try again sends one more', async () => {
	session.serve({ [createUrl]: fixtureStatus(500, { error: 'Drafts are unavailable' }) })
	await mount()
	await waitForUi(() => expect(createRequests()).not.toHaveLength(0))
	// Renders after the failure must not start another create.
	await settle()
	expect(createRequests()).toHaveLength(1)
	expect(alertText()).toContain('Drafts are unavailable')

	const retry = [...container.querySelectorAll('button')].find((el) => el.textContent === 'Try again')!
	await act(async () => retry.click())
	await waitForUi(() => expect(alertText()).toContain('Drafts are unavailable'))
	await settle()
	expect(createRequests()).toHaveLength(2)
	expect(router.replace).not.toHaveBeenCalled()
})

test('Try again waits in its own button while the retry runs, with the error still shown', async () => {
	session.serveInOrder(createUrl, [
		fixtureStatus(500, { error: 'Drafts are unavailable' }),
		() => new Promise<Response>(() => {})
	])
	await mount()
	await waitForUi(() => expect(alertText()).toContain('Drafts are unavailable'))

	const retry = [...container.querySelectorAll('button')].find((el) => el.textContent === 'Try again')!
	await act(async () => retry.click())
	await waitForUi(() => expect(createRequests()).toHaveLength(2))
	const busy = container.querySelector('button[aria-busy="true"]')
	expect(busy?.textContent).toContain('Retrying…')
	expect(alertText()).toContain('Drafts are unavailable')
})

test('a successful draft create opens the new draft', async () => {
	session.serve({ [createUrl]: { article: { id: 'new-draft' } } })
	await mount()
	await waitForUi(() => expect(router.replace).toHaveBeenCalledWith('/research/edit/new-draft'))
	expect(createRequests()).toHaveLength(1)
})

test('an article that fails to load shows the error instead of a blank editor', async () => {
	session.serve({ [`${FEATURES_SERVER}/articles/broken/edit`]: fixtureStatus(500, { error: 'Research is down' }) })
	await mount('broken')
	await waitForUi(() => expect(alertText()).toBe("Couldn't load this research. Research is down"))
	expect(container.querySelector('[role="textbox"][aria-label="Article body"]')).toBeNull()
})

test('a missing article reads as not found, with a way back and no retry', async () => {
	session.serve({ [`${FEATURES_SERVER}/articles/missing/edit`]: fixtureStatus(404, { error: 'Article not found' }) })
	await mount('missing')
	await waitForUi(() => expect(container.querySelector('h1')?.textContent).toBe('Research not found'))
	const back = [...container.querySelectorAll('a')].find((el) => accessibleName(el) === 'Back to my research')
	expect(back?.getAttribute('href')).toBe('/research/mine')
	expect([...container.querySelectorAll('button')].some((el) => accessibleName(el) === 'Try again')).toBe(false)
	expect(alertText()).toBeUndefined()
	expect(container.querySelector('[role="textbox"][aria-label="Article body"]')).toBeNull()
})

test('Try again on an article that failed to load keeps the error on screen while the read runs again', async () => {
	session.serveInOrder(`${FEATURES_SERVER}/articles/missing/edit`, [
		fixtureStatus(500, { error: 'Research is down' }),
		() => new Promise<Response>(() => {})
	])
	await mount('missing')
	await waitForUi(() => expect(alertText()).toBe("Couldn't load this research. Research is down"))

	const retry = [...container.querySelectorAll('button')].find((el) => accessibleName(el) === 'Try again')!
	await act(async () => retry.click())
	await waitForUi(() => expect(container.querySelector('button[aria-busy="true"]')).not.toBeNull())
	expect(alertTexts(container)).toHaveLength(1)
	expect(container.querySelector('[role="textbox"][aria-label="Article body"]')).toBeNull()
})

test('the save shortcut on an article that failed to load does not create a new draft', async () => {
	session.serve({ [`${FEATURES_SERVER}/articles/missing/edit`]: fixtureStatus(404, { error: 'Article not found' }) })
	await mount('missing')
	await waitForUi(() => expect(container.querySelector('h1')?.textContent).toBe('Research not found'))
	await act(async () =>
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
	)
	await settle()
	expect(createRequests()).toHaveLength(0)
	expect(router.replace).not.toHaveBeenCalled()
})
