// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast, { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { YieldsChartConfig } from '~/containers/ProDashboard/types'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AddToDashboardModal } from '../AddToDashboardModal'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/yields', query: {}, push: vi.fn() }) }))

const session = installSubscriberSession('owner', { resolved: true })

const chart: YieldsChartConfig = {
	id: 'pool',
	kind: 'yields',
	poolConfigId: 'pool',
	poolName: 'USDC pool',
	project: 'aave',
	chain: 'Ethereum'
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	toast.remove()
	container.remove()
})

let store: Ariakit.DialogStore
function OpenModal() {
	const dialogStore = Ariakit.useDialogStore({ defaultOpen: true })
	store = dialogStore
	return <AddToDashboardModal dialogStore={dialogStore} chartConfig={chart} />
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const button = (text: string) => [...dialog().querySelectorAll('button')].find((el) => el.textContent === text)!

async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function renderModal() {
	session.serve({
		'/lite/dashboards': { items: [] },
		'/api/private/pro-dashboard/save': fixtureStatus(500, { message: 'Dashboard limit reached' })
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<OpenModal />
				<Toaster />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(dialog().textContent).toContain('No dashboards yet'))
}

const footerText = () => dialog().querySelector('footer')?.textContent

test('submit says why it is disabled until a dashboard is picked or named', async () => {
	await renderModal()
	const submit = button('Add to dashboard')
	expect(submit.disabled).toBe(true)
	expect(footerText()).toBe('Pick a dashboard or create a new oneCancelAdd to dashboard')

	await act(async () => button('Create new dashboard').click())
	expect(footerText()).toBe('Enter a name for the new dashboardCancelAdd to dashboard')
	await type(dialog().querySelector<HTMLInputElement>('input[name="newDashboardName"]')!, 'Research')
	expect(submit.disabled).toBe(false)
	expect(footerText()).toBe('CancelAdd to dashboard')
})

test('Create new dashboard hands focus to the name field that replaces it', async () => {
	await renderModal()
	const create = button('Create new dashboard')
	await act(async () => {
		create.focus()
		create.click()
	})
	expect(document.activeElement).toBe(dialog().querySelector('input[name="newDashboardName"]'))
})

test('each opening starts without the last search or new dashboard draft', async () => {
	await renderModal()
	await type(dialog().querySelector<HTMLInputElement>('input[placeholder="Search dashboards…"]')!, 'zzz')
	await waitForUi(() => expect(dialog().textContent).toContain('No matches found'))
	await act(async () => button('Create new dashboard').click())
	await type(dialog().querySelector<HTMLInputElement>('input[name="newDashboardName"]')!, 'Research')
	await act(async () => store.hide())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	await act(async () => store.show())
	await waitForUi(() => expect(dialog().textContent).toContain('No dashboards yet'))
	expect(dialog().querySelector('input[name="newDashboardName"]')).toBeNull()
	expect(footerText()).toBe('Pick a dashboard or create a new oneCancelAdd to dashboard')
})

test('a failed create shows its error inside the open dialog, not as a toast', async () => {
	await renderModal()
	await act(async () => button('Create new dashboard').click())
	await type(dialog().querySelector<HTMLInputElement>('input[name="newDashboardName"]')!, 'Research')
	await act(async () => button('Add to dashboard').click())

	await waitForUi(() => expect(dialog().querySelector('[role="alert"]')?.textContent).toBe('Dashboard limit reached'))
	const toasts = [...document.querySelectorAll('[role="status"]')].map((el) => el.textContent)
	expect(toasts).not.toContain('Dashboard limit reached')
})

test('a failed dashboard list keeps the saved dashboards, and its retry loads the current list', async () => {
	localStorage.setItem('lite-dashboards', JSON.stringify([{ id: 'saved', name: 'Saved research' }]))
	session.serve({ '/lite/dashboards': fixtureStatus(500, { message: 'Server error' }) })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<OpenModal />
			</session.Wrapper>
		)
	)

	await waitForUi(() =>
		expect(dialog().querySelector('[role="alert"]')?.textContent).toBe("Couldn't refresh your dashboards.Try again")
	)
	expect(dialog().textContent).toContain('Saved research')
	expect(localStorage.getItem('lite-dashboards')).toBe(JSON.stringify([{ id: 'saved', name: 'Saved research' }]))

	session.serve({
		'/lite/dashboards': {
			items: [
				{ id: 'saved', name: 'Saved research' },
				{ id: 'second', name: 'Second research' }
			]
		}
	})
	await act(async () => {
		button('Try again').focus()
		button('Try again').click()
	})

	await waitForUi(() => expect(dialog().querySelector('[role="alert"]')).toBeNull())
	expect(dialog().textContent).toContain('Second research')
	// The retry button is gone, so the dialog's net hands focus to its first control instead of the page.
	await waitForUi(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog'))
})

test('a failed dashboard list with nothing saved says so instead of claiming there are no dashboards', async () => {
	session.serve({ '/lite/dashboards': fixtureStatus(500, { message: 'Server error' }) })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<OpenModal />
			</session.Wrapper>
		)
	)

	await waitForUi(() =>
		expect(dialog().querySelector('[role="alert"]')?.textContent).toBe("Couldn't load your dashboards.Try again")
	)
	expect(dialog().textContent).not.toContain('No dashboards yet')
})
