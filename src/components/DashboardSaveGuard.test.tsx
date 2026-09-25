// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getUnsavedDashboardChanges, type DashboardUpdate } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { getDashboardRecovery, type DashboardSaveAttempt } from './dashboardRecovery'
import { DashboardSaveGuard } from './DashboardSaveGuard'

const router = vi.hoisted(() => ({ pathname: '/yields', query: {} as Record<string, string | Array<string>> }))
vi.mock('next/router', () => ({ useRouter: () => router }))

const session = installSubscriberSession('owner')

const request: DashboardUpdate = {
	id: 'draft',
	source: 'autosave',
	data: { dashboardName: 'Research dashboard', items: [], visibility: 'public', tags: [], description: '' },
	changes: { items: [{ id: 'text', kind: 'text', content: 'Keep this' }] }
}

const attempt = (status: DashboardSaveAttempt['status'], userId = 'owner'): DashboardSaveAttempt => ({
	userId,
	status,
	request
})

describe('which drafts the save guard recovers', () => {
	test('a failed autosave gets a notice and arms the leave warning', () => {
		expect(getDashboardRecovery([attempt('error')], 'owner', null)).toEqual({ unsaved: true, notices: [request] })
	})

	test('only autosaves become recoverable drafts: a failed manual save gets no notice or warning', () => {
		const manual: DashboardSaveAttempt = {
			userId: 'owner',
			status: 'error',
			request: { ...request, source: undefined }
		}
		expect(getDashboardRecovery([manual], 'owner', null)).toEqual({ unsaved: false, notices: [] })
	})

	test('another account’s failed draft neither shows nor warns, so switching accounts swaps them', () => {
		const attempts = [attempt('error', 'other')]
		expect(getDashboardRecovery(attempts, 'owner', null)).toEqual({ unsaved: false, notices: [] })
		expect(getDashboardRecovery(attempts, 'other', null)).toEqual({ unsaved: true, notices: [request] })
	})

	test('a newer save in flight hides the notice but keeps the warning; its success clears both', () => {
		expect(getDashboardRecovery([attempt('error'), attempt('pending')], 'owner', null)).toEqual({
			unsaved: true,
			notices: []
		})
		expect(getDashboardRecovery([attempt('error'), attempt('success')], 'owner', null)).toEqual({
			unsaved: false,
			notices: []
		})
	})

	test('the notice is hidden only in that dashboard’s own editor, whether routed by id or by slug', () => {
		const failed = [attempt('error')]
		expect(getDashboardRecovery(failed, 'owner', { routeKey: 'draft', dashboardId: undefined }).notices).toEqual([])
		expect(getDashboardRecovery(failed, 'owner', { routeKey: 'research', dashboardId: 'draft' })).toEqual({
			unsaved: true,
			notices: []
		})
		expect(getDashboardRecovery(failed, 'owner', { routeKey: 'other', dashboardId: 'other' }).notices).toEqual([
			request
		])
	})
})

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	router.pathname = '/yields'
	router.query = {}
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const button = (text: string) => [...document.querySelectorAll('button')].find((el) => el.textContent === text)!
function warns() {
	const event = new Event('beforeunload', { cancelable: true })
	window.dispatchEvent(event)
	return event.defaultPrevented
}

async function failDraft() {
	const client = session.client
	const mutation = client.getMutationCache().build(client, {
		mutationKey: ['pro-dashboard-update', request.id, 'owner'],
		mutationFn: async (_request: DashboardUpdate) => {
			throw new Error('Offline')
		},
		gcTime: Infinity
	})
	await act(async () => mutation.execute(request).catch(() => {}))
}

test('the draft’s own editor shows no notice but still warns before leaving', async () => {
	router.pathname = '/pro/[dashboardId]/[[...mode]]'
	router.query = { dashboardId: 'draft', mode: ['edit'] }
	await failDraft()
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardSaveGuard />
			</session.Wrapper>
		)
	)

	await vi.waitFor(() => expect(warns()).toBe(true), { timeout: 1000 })
	expect(container.textContent).toBe('')
})

test('a failed draft on another page can be reopened, kept, or explicitly discarded', async () => {
	const client = session.client
	await failDraft()
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardSaveGuard />
				<main tabIndex={-1}>Yields page</main>
			</session.Wrapper>
		)
	)

	await vi.waitFor(() => expect(container.querySelector('a')?.getAttribute('href')).toBe('/pro/draft/edit'), {
		timeout: 1000
	})
	expect(warns()).toBe(true)
	const trigger = button('Discard draft…')
	await act(async () => {
		trigger.focus()
		trigger.click()
	})
	await vi.waitFor(() =>
		expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard unsaved dashboard changes?')
	)
	await act(async () => button('Keep draft').click())
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(getUnsavedDashboardChanges(client, 'draft', 'owner')).toEqual(request.changes)
	expect(warns()).toBe(true)

	await act(async () => trigger.click())
	await act(async () => button('Discard draft').click())
	await vi.waitFor(() => expect(container.querySelector('section')).toBeNull())
	expect(getUnsavedDashboardChanges(client, 'draft', 'owner')).toBeUndefined()
	expect(warns()).toBe(false)
	// The notice and its trigger are gone, so focus returns to the page content.
	await vi.waitFor(() => expect(document.activeElement).toBe(container.querySelector('main')))
})
