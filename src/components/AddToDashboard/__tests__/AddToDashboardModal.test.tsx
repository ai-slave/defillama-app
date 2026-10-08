// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast, { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import type { YieldsChartConfig } from '~/containers/ProDashboard/types'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { LlamaAIChartInput } from '../addToDashboardContract'
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

const errorTexts = () => [...dialog().querySelectorAll('.text-error')].map((element) => element.textContent)
const saveRequests = () => session.requests.filter((request) => request.url.pathname.endsWith('/pro-dashboard/save'))

test('a submit without a dashboard or a new name says what is missing under it and saves nothing', async () => {
	await renderModal()
	const submit = button('Add to dashboard')
	expect(submit.getAttribute('aria-disabled')).toBeNull()
	expect(errorTexts()).toEqual([])
	await act(async () => submit.click())
	expect(errorTexts()).toEqual(['Choose a dashboard or create a new one.'])
	expect(document.activeElement).toBe(button('Create new dashboard'))

	await act(async () => button('Create new dashboard').click())
	const name = dialog().querySelector<HTMLInputElement>('input[name="newDashboardName"]')!
	// The new name field is a new question: it opens quiet, and the next submit asks for it.
	expect(errorTexts()).toEqual([])
	await act(async () => submit.click())
	expect(errorTexts()).toEqual(['Enter a name for the new dashboard.'])
	expect(document.activeElement).toBe(name)
	expect(name.getAttribute('aria-invalid')).toBe('true')
	await type(name, 'Research')
	expect(errorTexts()).toEqual([])
	expect(saveRequests()).toHaveLength(0)
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
	expect(button('Create new dashboard')).toBeDefined()
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

test('a failed dashboard list with nothing saved says so instead of claiming there are no dashboards, and keeps saying so through a slow retry', async () => {
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

	// A slow retry keeps the failure and its focused button instead of swapping them for the list's loading state.
	session.serve({
		'/lite/dashboards': () =>
			new Promise((resolve) =>
				setTimeout(() => resolve(Response.json({ items: [{ id: 'one', name: 'Research' }] })), 200)
			)
	})
	const retry = button('Try again')
	await act(async () => {
		retry.focus()
		retry.click()
	})
	await waitForUi(() => expect(retry.getAttribute('aria-busy')).toBe('true'))
	expect(dialog().querySelector('[role="alert"]')?.textContent).toContain("Couldn't load your dashboards.")
	expect(dialog().textContent).not.toContain('Loading dashboards')
	expect(document.activeElement).toBe(retry)
	await waitForUi(() => expect(dialog().textContent).toContain('Research'))
})

const premiumChart: LlamaAIChartInput = {
	chartId: 'chart-1',
	title: 'Premium fees',
	artifactRef: {
		artifactId: 'artifact-1',
		versionId: 'version-1',
		status: 'live',
		containsPremium: true,
		estimatedMaxCostUsd: 0.005
	}
}
const ceilingRequired = fixtureStatus(409, { error: 'Premium dashboard refresh requires a confirmed maximum cost' })

function OpenedFromButton() {
	const dialogStore = Ariakit.useDialogStore()
	return (
		<>
			<Ariakit.DialogDisclosure store={dialogStore}>Add chart</Ariakit.DialogDisclosure>
			<AddToDashboardModal dialogStore={dialogStore} chartConfig={null} llamaAIChart={premiumChart} />
		</>
	)
}

const dialogByTitle = (title: string) =>
	[...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
		(el) => el.querySelector('h2')?.textContent === title
	)
const anyButton = (text: string) => [...document.querySelectorAll('button')].find((el) => el.textContent === text)!
const activations = () =>
	session.requests.filter((request) => request.url.pathname.endsWith('/activate')).map((request) => request.init!.body)

async function addPremiumChartToNewDashboard(activation: Array<unknown>) {
	session.serve({
		'/lite/dashboards': { items: [] },
		'/api/private/pro-dashboard/save': (_url: URL, init?: RequestInit) => ({
			id: 'created',
			data: JSON.parse(String(init!.body)).data,
			created: '',
			updated: ''
		})
	})
	session.serveInOrder(`${AI_SERVER}/chart-artifacts/dashboards/created/activate`, activation)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<OpenedFromButton />
				<Toaster />
			</session.Wrapper>
		)
	)
	const opener = anyButton('Add chart')
	await act(async () => {
		opener.focus()
		opener.click()
	})
	await waitForUi(() => expect(dialog().textContent).toContain('No dashboards yet'))
	await act(async () => button('Create new dashboard').click())
	await type(dialog().querySelector<HTMLInputElement>('input[name="newDashboardName"]')!, 'Research')
	await act(async () => button('Add to dashboard').click())
	await waitForUi(() => expect(dialogByTitle('Enable daily refresh?')).toBeDefined())
	return opener
}

test('a premium refresh asks over the open dialog, waits in its button, and shows a failed enable inline', async () => {
	const enabling = Promise.withResolvers<Response>()
	const activated = (_url: URL, init?: RequestInit) => ({
		outcomes: JSON.parse(String(init!.body)).expectedItemIds.map((itemId: string) => ({ itemId }))
	})
	await addPremiumChartToNewDashboard([ceilingRequired, () => enabling.promise, activated])
	const confirm = dialogByTitle('Enable daily refresh?')!
	expect(confirm.textContent).toContain(
		'This dashboard uses premium data. Daily refreshes will bill your account up to $0.005 per refresh window.'
	)
	// The add is saved; only the refresh waits for the reader.
	expect(dialogByTitle('Add to dashboard')).toBeDefined()
	expect(document.body.textContent).not.toContain('Dashboard created')

	await act(async () => anyButton('Enable daily refresh').click())
	await waitForUi(() => expect(confirm.querySelector('[aria-busy="true"]')?.textContent).toContain('Enabling…'))
	await act(async () => enabling.resolve(ceilingRequired()))
	await waitForUi(() =>
		expect(confirm.querySelector('[role="alert"]')?.textContent).toBe(
			"Couldn't enable daily refresh. Try again, or skip to keep the current snapshot."
		)
	)
	expect(document.body.textContent).not.toContain('Dashboard created')

	await act(async () => anyButton('Enable daily refresh').click())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	await waitForUi(() => expect(document.body.textContent).toContain('Dashboard created!'))
	// The first request accepts nothing; each confirmed one sends the ceiling the reader saw.
	expect(activations().map((body) => JSON.parse(String(body)).confirmedMaxCostUsd)).toEqual([undefined, 0.005, 0.005])
})

test('skipping the premium refresh keeps the chart as a snapshot and returns focus to the button that opened the dialog', async () => {
	const opener = await addPremiumChartToNewDashboard([ceilingRequired])
	await act(async () => anyButton('Skip').click())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	expect(document.body.textContent).toContain('Dashboard created. Daily refresh was not enabled.')
	expect(activations()).toHaveLength(1)
	await waitForUi(() => expect(document.activeElement).toBe(opener))
})

test('the picked destination reads as pressed, and only one is pressed at a time', async () => {
	session.serve({
		'/lite/dashboards': {
			items: [
				{ id: 'research', name: 'Research' },
				{ id: 'trading', name: 'Trading' }
			]
		}
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<OpenModal />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(button('Trading')).toBeDefined())
	const pressed = () => [button('Research'), button('Trading')].map((el) => el.getAttribute('aria-pressed'))
	expect(pressed()).toEqual(['false', 'false'])

	await act(async () => button('Research').click())
	await waitForUi(() => expect(pressed()).toEqual(['true', 'false']))
	await act(async () => button('Trading').click())
	await waitForUi(() => expect(pressed()).toEqual(['false', 'true']))
	await act(async () => button('Create new dashboard').click())
	await waitForUi(() => expect(pressed()).toEqual(['false', 'false']))
})

test('adding to an existing dashboard saves into it and names it in the toast', async () => {
	session.serve({
		'/lite/dashboards': { items: [{ id: 'research', name: 'Research', slug: 'research' }] },
		'/dashboards/research': {
			id: 'research',
			data: { items: [], dashboardName: 'Research' },
			created: '',
			updated: ''
		},
		'/api/private/pro-dashboard/save': (_url: URL, init?: RequestInit) => ({
			id: 'research',
			data: JSON.parse(String(init!.body)).data,
			created: '',
			updated: ''
		})
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<OpenModal />
				<Toaster />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(button('Research')).toBeDefined())
	await act(async () => button('Research').click())
	await act(async () => button('Add to dashboard').click())

	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	await waitForUi(() => expect(document.body.textContent).toContain('Added to Research! View →'))
	const save = session.requests.find((request) => request.url.pathname.endsWith('/pro-dashboard/save'))!
	expect(save.url.searchParams.get('id')).toBe('research')
	expect(JSON.parse(String(save.init!.body)).data.items).toMatchObject([{ kind: 'yields', poolName: 'USDC pool' }])
})
