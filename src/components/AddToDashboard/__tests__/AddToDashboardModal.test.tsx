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

function OpenModal() {
	const dialogStore = Ariakit.useDialogStore({ defaultOpen: true })
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

test('a failed create shows its error inside the open dialog, not as a toast', async () => {
	await renderModal()
	await act(async () => button('Create new dashboard').click())
	await type(dialog().querySelector<HTMLInputElement>('input[name="newDashboardName"]')!, 'Research')
	await act(async () => button('Add to dashboard').click())

	await waitForUi(() => expect(dialog().querySelector('[role="alert"]')?.textContent).toBe('Dashboard limit reached'))
	const toasts = [...document.querySelectorAll('[role="status"]')].map((el) => el.textContent)
	expect(toasts).not.toContain('Dashboard limit reached')
})
