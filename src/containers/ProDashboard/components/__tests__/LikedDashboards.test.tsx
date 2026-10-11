// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { LikedDashboards } from '../LikedDashboards'

// A heavy child; these tests read the pager and the status around the cards.
vi.mock('../DashboardCard', () => ({ DashboardCard: () => null }))

const session = installSubscriberSession('user-1')
const dashboard = { id: 'one', data: { dashboardName: 'One', items: [] }, created: '', updated: '' }
const firstPage = { items: [dashboard], page: 1, perPage: 20, totalItems: 21, totalPages: 2 }
const secondPageData = { items: [{ ...dashboard, id: 'two' }], page: 2, perPage: 20, totalItems: 21, totalPages: 2 }

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

// The page's <main> is where focus goes when a control leaves with nothing nearer to take it.
async function renderFirstPage() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<main>
					<LikedDashboards />
				</main>
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(container.textContent).toContain('Page 1 of 2'))
}
const button = (name: string) =>
	[...container.querySelectorAll('button')].find((candidate) => accessibleName(candidate) === name)
async function press(name: string) {
	const target = button(name)!
	await act(async () => {
		target.focus()
		target.click()
	})
	return target
}

test('Next page keeps the pager, and focus on it, while the next page loads', async () => {
	const secondPage = Promise.withResolvers<unknown>()
	session.serve({
		[`${FEATURES_SERVER}/dashboards/liked`]: (url: URL) =>
			url.searchParams.get('page') === '2' ? secondPage.promise : firstPage
	})
	await renderFirstPage()

	const next = await press('Go to next page')
	expect(next.isConnected).toBe(true)
	expect(document.activeElement).toBe(next)

	await act(async () => secondPage.resolve(secondPageData))
	await waitForUi(() => expect(next.getAttribute('aria-disabled')).toBe('true'))
	expect(document.activeElement).toBe(next)
})

test('a failed page shows its error with Try again in place of the cards and pager', async () => {
	let secondPageFails = true
	session.serve({
		[`${FEATURES_SERVER}/dashboards/liked`]: (url: URL) =>
			url.searchParams.get('page') !== '2'
				? firstPage
				: secondPageFails
					? fixtureStatus(500, { message: 'down' })()
					: secondPageData
	})
	await renderFirstPage()

	await press('Go to next page')
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
	expect(button('Go to next page')).toBeUndefined()
	// The pager left with focus, so the page content takes it rather than <body>.
	expect(document.activeElement).toBe(container.querySelector('main'))

	secondPageFails = false
	await press('Try again')
	await waitForUi(() => expect(container.textContent).toContain('Page 2 of 2'))
	expect(alertTexts(container)).toHaveLength(0)
})
