// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ALERTS_QUERY_KEY } from '../alerts/queryKeys'
import type { Alert } from '../alerts/types'
import { AlertsModal } from '../AlertsModal'

// Heavy children whose output these tests do not read.
vi.mock('../CreateAlertModal', () => ({ CreateAlertModal: () => null }))
vi.mock('../markdown/ChatMarkdownRenderer', () => ({ ChatMarkdownRenderer: () => null, SourcesList: () => null }))

const session = installSubscriberSession('user')
const ALERTS_URL = 'https://ai.llama.fi/alerts'
const alert: Alert = {
	id: 'alert',
	title: 'Weekly yields',
	original_query: 'Show yields',
	schedule_expression: 'Daily at 09:00 UTC',
	next_run_at: '2026-09-10T09:00:00Z',
	last_run_at: null,
	last_run_status: null,
	enabled: true,
	run_count: 1,
	created_at: '2026-09-09T09:00:00Z'
}
const alertRequests = () => session.requests.filter((request) => request.url.href.startsWith(ALERTS_URL))
let root: Root
let container: HTMLDivElement

function Harness() {
	const store = Ariakit.useDialogStore({ defaultOpen: true })
	return (
		<session.Wrapper>
			<AlertsModal dialogStore={store} />
		</session.Wrapper>
	)
}

beforeEach(() => {
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	session.serve({
		[`${ALERTS_URL}/alert/executions`]: { executions: [] },
		'https://ai.llama.fi/telegram/status': { link: { state: 'unlinked' }, pending: null },
		'https://ai.llama.fi/slack/status': { links: [], pending: null },
		'https://ai.llama.fi/slack/workspaces': { workspaces: [] }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render() {
	await act(async () => root.render(<Harness />))
}
async function settle(assertion: () => void) {
	await act(async () => {
		await waitForUi(assertion)
	})
}
function toggle() {
	return document.querySelector<HTMLInputElement>('[role="switch"]')!
}

test('the next run label counts down while the modal stays open, then reads soon once overdue', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
	vi.setSystemTime(new Date('2026-09-10T06:00:00Z'))
	session.serve({ [ALERTS_URL]: { alerts: [alert] } })
	session.client.setQueryData([ALERTS_QUERY_KEY, 'user'], [alert])
	try {
		await render()
		await settle(() => expect(document.body.textContent).toContain('Next run in 3h'))
		await act(async () => vi.advanceTimersByTime(2 * 60 * 60 * 1000))
		expect(document.body.textContent).toContain('Next run in 1h')
		await act(async () => vi.advanceTimersByTime(90 * 60 * 1000))
		expect(document.body.textContent).toContain('Next run soon')
	} finally {
		vi.useRealTimers()
	}
})

test('a failed refresh retains alerts and exposes retry', async () => {
	let online = false
	session.serve({
		[ALERTS_URL]: () => (online ? Response.json({ alerts: [alert] }) : new Response('offline', { status: 503 }))
	})
	session.client.setQueryData([ALERTS_QUERY_KEY, 'user'], [alert])
	await render()
	await settle(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load alerts"))
	expect(document.body.textContent).toContain('Weekly yields')
	online = true
	await act(async () => document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
	await settle(() => expect(document.querySelector('[role="alert"]')).toBeNull())
	expect(document.body.textContent).toContain('Weekly yields')
})

test('pending toggles block repeats, even after opening edit, and roll back on failure', async () => {
	const pending = Promise.withResolvers<Response>()
	session.serve({
		[ALERTS_URL]: { alerts: [alert] },
		[`${ALERTS_URL}/alert`]: (_url: URL, init?: RequestInit) =>
			init?.method === 'PATCH' ? pending.promise : Response.json(alert)
	})
	await render()
	await settle(() => expect(toggle()).not.toBeNull())
	await act(async () => toggle().click())
	await settle(() => expect(toggle().getAttribute('aria-disabled')).toBe('true'))
	expect(toggle().getAttribute('aria-busy')).toBe('true')
	await act(async () => {
		document.querySelector<HTMLButtonElement>('button[aria-label="Edit"]')!.click()
		toggle().click()
	})
	const patches = alertRequests().filter((request) => request.init?.method === 'PATCH')
	expect(patches.map((request) => JSON.parse(request.init!.body as string))).toEqual([{ enabled: false }])
	await act(async () => pending.resolve(new Response('nope', { status: 500 })))
	await settle(() => expect(toggle().checked).toBe(true))
	expect(toggle().getAttribute('aria-disabled')).not.toBe('true')
	expect(document.body.textContent).toContain("Couldn't update the alert. Try again.")
})

test('signed out, the modal asks to sign in without an empty alert state or an alerts request', async () => {
	pb.authStore.clear()
	await render()
	expect(document.body.textContent).toContain('Sign in to use alerts')
	expect(document.querySelector('[role="status"]')).toBeNull()
	expect(document.body.textContent).not.toContain('Create your first')
	expect(alertRequests()).toEqual([])
})

const reports: Array<Alert> = ['First report', 'Second report'].map((title, i) => ({
	...alert,
	id: String(i),
	title,
	original_query: title
}))
const listReads = () => alertRequests().filter((request) => request.url.href === ALERTS_URL).length
const checked = () => [...document.querySelectorAll('[role="switch"]')].map((el) => el.getAttribute('aria-checked'))

test('a failed toggle preserves other alert changes and allows retry without duplicate requests', async () => {
	let list: Promise<Response> | Array<Alert> = reports
	const patches = [Promise.withResolvers<Response>(), Promise.withResolvers<Response>()]
	let patchCount = 0
	session.serve({
		[ALERTS_URL]: () => (Array.isArray(list) ? Response.json({ alerts: list }) : list),
		[`${ALERTS_URL}/0`]: () => patches[patchCount++].promise
	})
	await render()
	await settle(() => expect(checked()).toEqual(['true', 'true']))
	const first = toggle()
	await act(async () => {
		first.focus()
		first.click()
	})
	await settle(() => {
		expect(first.getAttribute('aria-disabled')).toBe('true')
		expect(first.getAttribute('aria-checked')).toBe('false')
	})
	expect(document.activeElement).toBe(first)
	await act(async () => first.click())
	expect(patchCount).toBe(1)
	// A separate alert changes while the first request is outstanding. Hold the
	// reconciliation fetch so it cannot conceal an incorrect whole-list rollback.
	list = new Promise<Response>(() => {})
	await act(async () =>
		session.client.setQueryData<Array<Alert>>([ALERTS_QUERY_KEY, 'user'], (current) =>
			current!.map((item) => (item.id === '1' ? { ...item, enabled: false } : item))
		)
	)
	await act(async () => patches[0].resolve(new Response('nope', { status: 500 })))
	await settle(() => expect(checked()).toEqual(['true', 'false']))
	expect(first.getAttribute('aria-label')).toBe('Alert enabled')
	expect(first.getAttribute('aria-disabled')).not.toBe('true')
	expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't update the alert. Try again.")
	await act(async () => first.click())
	await act(async () => patches[1].resolve(Response.json({})))
	await settle(() => expect(first.getAttribute('aria-checked')).toBe('false'))
	expect(patchCount).toBe(2)
})

test('finishing one toggle does not refetch over another pending row', async () => {
	let list = reports
	const first = Promise.withResolvers<Response>()
	const second = Promise.withResolvers<Response>()
	session.serve({
		[ALERTS_URL]: () => Response.json({ alerts: list }),
		[`${ALERTS_URL}/0`]: () => first.promise,
		[`${ALERTS_URL}/1`]: () => second.promise
	})
	await render()
	await settle(() => expect(checked()).toEqual(['true', 'true']))
	const [firstSwitch, secondSwitch] = document.querySelectorAll<HTMLElement>('[role="switch"]')
	await act(async () => firstSwitch.click())
	await act(async () => secondSwitch.click())
	await settle(() => expect(checked()).toEqual(['false', 'false']))
	const reads = listReads()
	await act(async () => first.resolve(new Response('nope', { status: 500 })))
	await settle(() => expect(checked()).toEqual(['true', 'false']))
	expect(listReads()).toBe(reads)
	list = reports.map((item) => (item.id === '1' ? { ...item, enabled: false } : item))
	await act(async () => second.resolve(Response.json({})))
	await settle(() => expect(listReads()).toBe(reads + 1))
	expect(checked()).toEqual(['true', 'false'])
})

function buttonNamed(scope: ParentNode, name: string) {
	return [...scope.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)!
}

test('a failed delete keeps the alert and says so in the confirmation; a retry that succeeds removes it', async () => {
	let deleteStatus = 500
	session.serve({
		[ALERTS_URL]: () => Response.json({ alerts: deleteStatus === 500 ? [alert] : [] }),
		[`${ALERTS_URL}/alert`]: (_url: URL, init?: RequestInit) =>
			init?.method === 'DELETE' ? new Response(null, { status: deleteStatus }) : Response.json(alert)
	})
	await render()
	await settle(() => expect(document.body.textContent).toContain('Weekly yields'))
	const confirmDelete = () => [...document.querySelectorAll('button')].findLast((b) => accessibleName(b) === 'Delete')!
	await act(async () => buttonNamed(document, 'Delete').click())
	await act(async () => confirmDelete().click())
	await settle(() =>
		expect(document.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toBe(
			"Couldn't delete the alert. Try again."
		)
	)
	expect(document.querySelector('h3')?.textContent).toBe('Weekly yields')
	deleteStatus = 204
	await act(async () => confirmDelete().click())
	await settle(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	expect(document.body.textContent).not.toContain('Weekly yields')
})

test('a price alert saved with its name cleared takes the name a new alert of that price would get', async () => {
	const priceAlert: Alert = {
		...alert,
		title: 'My BTC alert',
		trigger: { type: 'price', token_nk: 'coingecko:bitcoin', op: 'above', value: 100_000, recurring: false }
	}
	session.serve({
		[ALERTS_URL]: { alerts: [priceAlert] },
		[`${ALERTS_URL}/alert`]: () => Response.json({})
	})
	await render()
	await settle(() => expect(document.body.textContent).toContain('My BTC alert'))
	await act(async () => buttonNamed(document, 'Edit').click())
	const name = [...document.querySelectorAll('input')].find((input) => input.value === 'My BTC alert')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, '')
		name.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => buttonNamed(document, 'Save').click())
	await settle(() => expect(alertRequests().filter((request) => request.init?.method === 'PATCH')).toHaveLength(1))
	const patch = alertRequests().find((request) => request.init?.method === 'PATCH')!
	expect(JSON.parse(patch.init!.body as string)).toMatchObject({ title: 'BITCOIN above $100,000' })
	expect(name.placeholder).toBe('BITCOIN above $100,000')
})
