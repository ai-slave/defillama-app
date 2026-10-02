// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Nav } from '../index'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/yields', asPath: '/yields', query: {}, push: vi.fn() })
}))

const session = installSubscriberSession('owner', { resolved: true })

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

// The desktop sidebar; the phone menu renders the same section inside its dialog.
const sidebar = () => container.querySelector<HTMLElement>('.desktop-nav-shell')!
const dashboardsSection = () => sidebar().querySelector<HTMLElement>('[data-nav-dashboards]')
const retry = () => [...dashboardsSection()!.querySelectorAll('button')].find((el) => el.textContent === 'Try again')!

async function renderNav() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Nav />
			</session.Wrapper>
		)
	)
}

test('a failed dashboards list says so in the sidebar; a slow retry keeps its focused button until the list loads', async () => {
	session.serve({ '/lite/dashboards': fixtureStatus(500, { message: 'Server error' }) })
	await renderNav()

	await waitForUi(() =>
		expect(dashboardsSection()?.querySelector('[role="alert"]')?.textContent).toBe(
			"Couldn't load your dashboards.Try again"
		)
	)

	// The retry takes a moment, so the test sees the sidebar while it waits.
	session.serve({
		'/lite/dashboards': () =>
			new Promise((resolve) =>
				setTimeout(() => resolve(Response.json({ items: [{ id: 'one', name: 'Research', slug: 'research' }] })), 200)
			)
	})
	const button = retry()
	await act(async () => {
		button.focus()
		button.click()
	})

	await waitForUi(() => expect(button.getAttribute('aria-busy')).toBe('true'))
	expect(dashboardsSection()!.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load your dashboards.")
	expect(document.activeElement).toBe(button)
	await waitForUi(() => expect(dashboardsSection()!.querySelector('[role="alert"]')).toBeNull())
	expect(dashboardsSection()!.querySelector('a')?.getAttribute('href')).toBe('/pro/research')
	await waitForUi(() => expect(document.activeElement).toBe(dashboardsSection()!.querySelector('a')))
})

test('a failed refresh keeps the saved dashboards listed above its error', async () => {
	localStorage.setItem('lite-dashboards', JSON.stringify([{ id: 'saved', name: 'Saved research' }]))
	session.serve({ '/lite/dashboards': fixtureStatus(500, { message: 'Server error' }) })
	await renderNav()

	await waitForUi(() =>
		expect(dashboardsSection()?.querySelector('[role="alert"]')?.textContent).toBe(
			"Couldn't refresh your dashboards.Try again"
		)
	)
	expect(dashboardsSection()!.querySelector('a')?.getAttribute('href')).toBe('/pro/saved')
})
