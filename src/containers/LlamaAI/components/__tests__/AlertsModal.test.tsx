// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast, { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { pickOption } from '~/utils/testing/pickOption'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ALERTS_QUERY_KEY } from '../alerts/queryKeys'
import type { Alert } from '../alerts/types'
import { AlertsModal } from '../AlertsModal'

// Heavy children whose output these tests do not read.
vi.mock('../CreateAlertModal', () => ({ CreateAlertModal: () => null }))
vi.mock('../markdown/ChatMarkdownRenderer', () => ({ ChatMarkdownRenderer: () => null, SourcesList: () => null }))
// The editor's schedule and Slack pickers are Selects, which read the router.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/ai/chat' }) }))

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
let dialogStore: Ariakit.DialogStore

function Harness() {
	const store = Ariakit.useDialogStore({ defaultOpen: true })
	dialogStore = store
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
	// react-hot-toast keeps toasts in a module store that outlives the Toaster.
	toast.remove()
})

async function render() {
	await act(async () => root.render(<Harness />))
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
		await waitForUi(() => expect(document.body.textContent).toContain('Next run in 3h'))
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
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load alerts"))
	expect(document.body.textContent).toContain('Weekly yields')
	online = true
	await act(async () => document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).toBeNull())
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
	await waitForUi(() => expect(toggle()).not.toBeNull())
	await act(async () => toggle().click())
	await waitForUi(() => expect(toggle().getAttribute('aria-disabled')).toBe('true'))
	expect(toggle().getAttribute('aria-busy')).toBe('true')
	await act(async () => {
		document.querySelector<HTMLButtonElement>('button[aria-label="Edit Weekly yields"]')!.click()
		toggle().click()
	})
	const patches = alertRequests().filter((request) => request.init?.method === 'PATCH')
	expect(patches.map((request) => JSON.parse(request.init!.body as string))).toEqual([{ enabled: false }])
	await act(async () => pending.resolve(new Response('nope', { status: 500 })))
	await waitForUi(() => expect(toggle().checked).toBe(true))
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
	await waitForUi(() => expect(checked()).toEqual(['true', 'true']))
	const first = toggle()
	await act(async () => {
		first.focus()
		first.click()
	})
	await waitForUi(() => {
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
	await waitForUi(() => expect(checked()).toEqual(['true', 'false']))
	expect(first.getAttribute('aria-label')).toBe('First report enabled')
	expect(first.getAttribute('aria-disabled')).not.toBe('true')
	expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't update the alert. Try again.")
	await act(async () => first.click())
	await act(async () => patches[1].resolve(Response.json({})))
	await waitForUi(() => expect(first.getAttribute('aria-checked')).toBe('false'))
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
	await waitForUi(() => expect(checked()).toEqual(['true', 'true']))
	const [firstSwitch, secondSwitch] = document.querySelectorAll<HTMLElement>('[role="switch"]')
	await act(async () => firstSwitch.click())
	await act(async () => secondSwitch.click())
	await waitForUi(() => expect(checked()).toEqual(['false', 'false']))
	const reads = listReads()
	await act(async () => first.resolve(new Response('nope', { status: 500 })))
	await waitForUi(() => expect(checked()).toEqual(['true', 'false']))
	expect(listReads()).toBe(reads)
	list = reports.map((item) => (item.id === '1' ? { ...item, enabled: false } : item))
	await act(async () => second.resolve(Response.json({})))
	await waitForUi(() => expect(listReads()).toBe(reads + 1))
	expect(checked()).toEqual(['true', 'false'])
})

function buttonNamed(scope: ParentNode, name: string) {
	return [...scope.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)!
}

test('a failed delete keeps the alert and says so in the confirmation, also while its retry runs; a retry that succeeds removes it', async () => {
	let deleteStatus = 500
	const retry = Promise.withResolvers<void>()
	session.serve({
		[ALERTS_URL]: () => Response.json({ alerts: deleteStatus === 500 ? [alert] : [] }),
		[`${ALERTS_URL}/alert`]: async (_url: URL, init?: RequestInit) => {
			if (init?.method !== 'DELETE') return Response.json(alert)
			if (deleteStatus !== 500) await retry.promise
			return new Response(null, { status: deleteStatus })
		}
	})
	await render()
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	const confirmDelete = () => [...document.querySelectorAll('button')].findLast((b) => accessibleName(b) === 'Delete')!
	await act(async () => buttonNamed(document, 'Delete Weekly yields').click())
	await act(async () => confirmDelete().click())
	await waitForUi(() =>
		expect(document.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toBe(
			"Couldn't delete the alert. Try again."
		)
	)
	expect(document.querySelector('h3')?.textContent).toBe('Weekly yields')
	deleteStatus = 204
	await act(async () => confirmDelete().click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Deleting…'))
	expect(document.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toBe(
		"Couldn't delete the alert. Try again."
	)
	await act(async () => retry.resolve())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
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
	await waitForUi(() => expect(document.body.textContent).toContain('My BTC alert'))
	await act(async () => buttonNamed(document, 'Edit My BTC alert').click())
	const name = [...document.querySelectorAll('input')].find((input) => input.value === 'My BTC alert')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, '')
		name.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => buttonNamed(document, 'Save').click())
	await waitForUi(() => expect(alertRequests().filter((request) => request.init?.method === 'PATCH')).toHaveLength(1))
	const patch = alertRequests().find((request) => request.init?.method === 'PATCH')!
	expect(JSON.parse(patch.init!.body as string)).toMatchObject({ title: 'BITCOIN above $100,000' })
	expect(name.placeholder).toBe('BITCOIN above $100,000')
})

async function press(button: HTMLElement) {
	await act(async () => {
		button.focus()
		button.click()
	})
}
// The dialog's first control, where its net puts focus that has nowhere better to go.
const closeButton = () => buttonNamed(document, 'Close dialog')

test('deleting an alert moves focus to the next alert', async () => {
	let list = reports
	session.serve({
		[ALERTS_URL]: () => Response.json({ alerts: list }),
		[`${ALERTS_URL}/0`]: () => {
			list = [reports[1]]
			return new Response(null, { status: 204 })
		}
	})
	await render()
	await waitForUi(() => expect(checked()).toEqual(['true', 'true']))
	await press(buttonNamed(document, 'Delete First report'))
	await press([...document.querySelectorAll('button')].findLast((b) => accessibleName(b) === 'Delete')!)
	await waitForUi(() => expect(document.querySelectorAll('h3')).toHaveLength(1))
	await waitForUi(() => expect(document.activeElement).toBe(toggle()))
	expect(document.querySelector('h3')?.textContent).toBe('Second report')
})

test.each(['Save', 'Cancel'])('closing the alert editor with %s returns focus to Edit', async (action) => {
	session.serve({
		[ALERTS_URL]: { alerts: [alert] },
		[`${ALERTS_URL}/alert`]: () => Response.json({})
	})
	await render()
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(buttonNamed(document, 'Edit Weekly yields'))
	await press(buttonNamed(document, action))
	await waitForUi(() => expect(document.querySelector('form')).toBeNull())
	expect(document.activeElement).toBe(buttonNamed(document, 'Edit Weekly yields'))
})

test('a failed alert save keeps its error while the retry runs', async () => {
	let saves = 0
	const retry = Promise.withResolvers<Response>()
	session.serve({
		[ALERTS_URL]: { alerts: [alert] },
		[`${ALERTS_URL}/alert`]: () => (++saves === 1 ? new Response(null, { status: 500 }) : retry.promise)
	})
	await render()
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(buttonNamed(document, 'Edit Weekly yields'))
	await press(buttonNamed(document, 'Save'))
	await waitForUi(() => expect(document.body.textContent).toContain("Couldn't save the alert. Try again."))
	await press(buttonNamed(document, 'Save'))
	await waitForUi(() => expect(saves).toBe(2))
	expect(document.body.textContent).toContain("Couldn't save the alert. Try again.")
	await act(async () => retry.resolve(Response.json({})))
	await waitForUi(() => expect(document.querySelector('form')).toBeNull())
})

test('re-arming a fired price alert moves focus to the editor it opens', async () => {
	const fired: Alert = {
		...alert,
		enabled: false,
		trigger: { type: 'price', token_nk: 'coingecko:bitcoin', op: 'above', value: 100_000, recurring: false }
	}
	session.serve({
		[ALERTS_URL]: { alerts: [fired] },
		[`${ALERTS_URL}/alert`]: () => new Promise<Response>(() => {})
	})
	await render()
	await waitForUi(() => expect(buttonNamed(document, 'Re-arm')).toBeDefined())
	await press(buttonNamed(document, 'Re-arm'))
	expect(document.activeElement).toBe(document.querySelector('input[name="title"]'))
	await waitForUi(() => expect(buttonNamed(document, 'Re-arm')).toBeUndefined())
	expect(document.activeElement).toBe(document.querySelector('input[name="title"]'))
})

test('re-arming from the actions menu moves focus to the editor instead of back to the menu button', async () => {
	const fired: Alert = {
		...alert,
		enabled: false,
		trigger: { type: 'price', token_nk: 'coingecko:bitcoin', op: 'above', value: 100_000, recurring: false }
	}
	session.serve({
		[ALERTS_URL]: { alerts: [fired] },
		[`${ALERTS_URL}/alert`]: () => new Promise<Response>(() => {})
	})
	await render()
	await waitForUi(() => expect(buttonNamed(document, `Actions for alert ${fired.title}`)).toBeDefined())
	await press(buttonNamed(document, `Actions for alert ${fired.title}`))
	await waitForUi(() => expect(document.querySelector('[role="menuitem"]')).not.toBeNull())
	const rearm = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
		(item) => item.textContent === 'Re-arm alert'
	)!
	await press(rearm)

	await waitForUi(() => expect(document.querySelector('[role="menu"]')).toBeNull())
	expect(document.activeElement).toBe(document.querySelector('input[name="title"]'))
})

test('a run opened from history keeps focus while it loads, on its detail, and back on its row', async () => {
	const detail = Promise.withResolvers<Response>()
	const run = { id: 'run', executed_at: '2026-09-10T09:00:00Z', status: 'success', duration_ms: 1200, chart_count: 0 }
	session.serve({
		[ALERTS_URL]: { alerts: [alert] },
		[`${ALERTS_URL}/alert/executions`]: { executions: [run] },
		[`${ALERTS_URL}/alert/executions/run`]: () => detail.promise
	})
	await render()
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(buttonNamed(document, 'View history of Weekly yields'))
	await waitForUi(() => expect(document.getElementById('alert-run-run')).not.toBeNull())
	const row = document.getElementById('alert-run-run')!
	await press(row)
	await waitForUi(() => expect(row.getAttribute('aria-disabled')).toBe('true'))
	expect(row.hasAttribute('disabled')).toBe(false)
	expect(document.activeElement).toBe(row)
	await act(async () =>
		detail.resolve(
			Response.json({ ...run, alertTitle: alert.title, generated_summary: 'All good', generated_charts: [] })
		)
	)
	await waitForUi(() => expect(document.activeElement).toBe(buttonNamed(document, 'Back to history')))
	await press(buttonNamed(document, 'Back to history'))
	expect(document.activeElement).toBe(document.getElementById('alert-run-run'))
})

test('a pause that fails after the Alerts dialog closes says so in a toast', async () => {
	const patch = Promise.withResolvers<Response>()
	session.serve({
		[ALERTS_URL]: { alerts: [alert] },
		[`${ALERTS_URL}/alert`]: (_url: URL, init?: RequestInit) =>
			init?.method === 'PATCH' ? patch.promise : Response.json(alert)
	})
	await render()
	await waitForUi(() => expect(toggle()).not.toBeNull())
	await act(async () => toggle().click())
	await waitForUi(() => expect(toggle().getAttribute('aria-busy')).toBe('true'))
	await act(async () => dialogStore.hide())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	const toasts = createRoot(document.body.appendChild(document.createElement('div')))
	await act(async () => toasts.render(<Toaster />))
	await act(async () => patch.resolve(new Response('nope', { status: 500 })))
	await waitForUi(() => expect(document.body.textContent).toContain("Couldn't pause “Weekly yields”. Try again."))
	await act(async () => toasts.unmount())
})

test('an edit that fails after the Alerts dialog closes says so in a toast', async () => {
	const patch = Promise.withResolvers<Response>()
	session.serve({
		[ALERTS_URL]: { alerts: [alert] },
		[`${ALERTS_URL}/alert`]: (_url: URL, init?: RequestInit) =>
			init?.method === 'PATCH' ? patch.promise : Response.json(alert)
	})
	await render()
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(buttonNamed(document, 'Edit Weekly yields'))
	await press(buttonNamed(document, 'Save'))
	await waitForUi(() => expect(alertRequests().some((request) => request.init?.method === 'PATCH')).toBe(true))
	await act(async () => dialogStore.hide())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	const toasts = createRoot(document.body.appendChild(document.createElement('div')))
	await act(async () => toasts.render(<Toaster />))
	await act(async () => patch.resolve(new Response('nope', { status: 500 })))
	await waitForUi(() =>
		expect(document.body.textContent).toContain("Couldn't save your changes to “Weekly yields”. Try again.")
	)
	await act(async () => toasts.unmount())
})

test('a retry that clears the list notice leaves focus in the dialog', async () => {
	let online = false
	session.serve({
		[ALERTS_URL]: () => (online ? Response.json({ alerts: [alert] }) : new Response('offline', { status: 503 }))
	})
	session.client.setQueryData([ALERTS_QUERY_KEY, 'user'], [alert])
	await render()
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load alerts"))
	online = true
	await press(buttonNamed(document, 'Try again'))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(closeButton()))
})

test('a retry from a failed first load keeps the error and waits in Try again until the alerts load in its place', async () => {
	const retry = Promise.withResolvers<Response>()
	let online = false
	session.serve({
		[ALERTS_URL]: () => (online ? retry.promise : new Response('offline', { status: 503 }))
	})
	await render()
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load alerts"))
	expect(document.body.textContent).not.toContain('Weekly yields')
	online = true
	const tryAgain = buttonNamed(document, 'Try again')
	await press(tryAgain)
	await waitForUi(() => expect(accessibleName(tryAgain)).toBe('Retrying…'))
	expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load alerts")

	await act(async () => retry.resolve(Response.json({ alerts: [alert] })))
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await waitForUi(() => expect(document.activeElement).toBe(closeButton()))
})

test('closing Alerts with a changed alert editor asks first; an untouched editor closes directly', async () => {
	session.serve({ [ALERTS_URL]: { alerts: [alert] } })
	await render()
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(buttonNamed(document, 'Edit Weekly yields'))
	await press(closeButton())
	expect(dialogStore.getState().open).toBe(false)

	await act(async () => dialogStore.show())
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(buttonNamed(document, 'Edit Weekly yields'))
	const name = document.querySelector<HTMLInputElement>('input[name="title"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Daily yields')
		name.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await press(closeButton())
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard alert changes?')
	await press(buttonNamed(document, 'Keep editing'))
	expect(dialogStore.getState().open).toBe(true)
	expect(document.querySelector<HTMLInputElement>('input[name="title"]')!.value).toBe('Daily yields')

	// Discarding closes the dialog; the next opening starts without the dropped edit, so it closes directly.
	await press(closeButton())
	await press(buttonNamed(document, 'Discard'))
	expect(dialogStore.getState().open).toBe(false)
	await act(async () => dialogStore.show())
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(closeButton())
	expect(dialogStore.getState().open).toBe(false)
})

test('a schedule edit survives opening a run from history and coming back, and closing still asks to discard it', async () => {
	const run = { id: 'run', executed_at: '2026-09-10T09:00:00Z', status: 'success', duration_ms: 1200, chart_count: 0 }
	session.serve({
		[ALERTS_URL]: { alerts: [alert] },
		[`${ALERTS_URL}/alert/executions`]: { executions: [run] },
		[`${ALERTS_URL}/alert/executions/run`]: {
			...run,
			alertTitle: alert.title,
			generated_summary: 'All good',
			generated_charts: []
		}
	})
	await render()
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(buttonNamed(document, 'Edit Weekly yields'))
	const frequency = () => document.querySelector<HTMLButtonElement>('[aria-label="Frequency"]')!
	await pickOption(frequency(), 'Weekly')
	await press(buttonNamed(document, 'View history of Weekly yields'))
	await waitForUi(() => expect(document.getElementById('alert-run-run')).not.toBeNull())
	await press(document.getElementById('alert-run-run')!)
	await waitForUi(() => expect(buttonNamed(document, 'Back to history')).toBeDefined())
	await press(buttonNamed(document, 'Back to history'))

	expect(frequency().textContent).toBe('Weekly')
	await press(closeButton())
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard alert changes?')
})

test('saving a Slack alert with no workspace picked focuses the workspace picker, not the delivery channel toggle', async () => {
	session.serve({
		[ALERTS_URL]: { alerts: [{ ...alert, delivery_channel: 'slack', slack_team_id: null, slack_channel_id: null }] },
		'https://ai.llama.fi/slack/workspaces': {
			workspaces: [
				{ team_id: 'T1', team_name: 'Llama Research', default_channel_id: null, revoked: false },
				{ team_id: 'T2', team_name: 'Llama Ops', default_channel_id: null, revoked: false }
			]
		}
	})
	await render()
	await waitForUi(() => expect(document.body.textContent).toContain('Weekly yields'))
	await press(buttonNamed(document, 'Edit Weekly yields'))
	const workspace = await waitForUi(() => {
		const picker = document.querySelector<HTMLButtonElement>('[aria-label="Slack workspace"]')
		expect(picker).not.toBeNull()
		return picker!
	})
	await press(buttonNamed(document, 'Save'))
	expect(document.activeElement).toBe(workspace)
	expect(workspace.getAttribute('aria-invalid')).toBe('true')
	expect(fieldErrorTexts()).toEqual(['Choose a Slack workspace.'])
	expect(alertRequests().some((request) => request.init?.method === 'PATCH' || request.init?.method === 'PUT')).toBe(
		false
	)
})
