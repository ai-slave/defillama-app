// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { ALERTS_QUERY_KEY } from '../alerts/queryKeys'
import type { Alert } from '../alerts/types'
import { AlertsModal } from '../AlertsModal'

const api = vi.hoisted(() => ({ fetch: vi.fn(), toggle: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: vi.fn(),
		isAuthenticated: true,
		loaders: { userLoading: false },
		user: { id: 'test-user' }
	})
}))
vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/ai/chat' }) }))
vi.mock('../alerts/api', async (original) => ({
	...(await original<typeof import('../alerts/api')>()),
	fetchAlerts: api.fetch,
	setAlertEnabled: api.toggle
}))
vi.mock('../CreateAlertModal', () => ({ CreateAlertModal: () => null }))
vi.mock('~/containers/Subscription/SignInModal', () => ({ SignInModal: () => null }))
vi.mock('../../hooks/useIntegrationLink', () => ({ useIntegrationLink: () => ({ state: { status: 'unlinked' } }) }))
vi.mock('../../hooks/useSlackIntegrationLink', () => ({ useSlackWorkspaces: () => ({ data: { workspaces: [] } }) }))
vi.mock('../../hooks/useSlackChannels', () => ({ useSlackChannels: () => ({ data: { channels: [] } }) }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))

const alerts: Array<Alert> = ['First report', 'Second report'].map((title, i) => ({
	id: String(i),
	title,
	original_query: title,
	schedule_expression: '0 9 * * *',
	next_run_at: '2026-09-08T09:00:00Z',
	last_run_at: null,
	last_run_status: null,
	enabled: true,
	run_count: 0,
	created_at: '2026-09-06T00:00:00Z'
}))
let root: Root
let container: HTMLDivElement
let client: QueryClient
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	vi.resetAllMocks()
})
async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
function switches() {
	return [...document.querySelectorAll<HTMLButtonElement>('[role="switch"]')]
}
test('a failed toggle preserves other alert changes and allows retry without duplicate requests', async () => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
	let reject!: (error: Error) => void
	api.fetch.mockResolvedValue(alerts)
	api.toggle.mockImplementationOnce(
		() =>
			new Promise<boolean>((_resolve, fail) => {
				reject = fail
			})
	)
	function Harness() {
		const store = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<QueryClientProvider client={client}>
				<AlertsModal dialogStore={store} />
			</QueryClientProvider>
		)
	}
	await act(async () => root.render(<Harness />))
	await settle()
	await settle()
	const first = switches()[0]
	await act(async () => {
		first.focus()
		first.click()
	})
	await settle()
	expect(first.getAttribute('aria-disabled')).toBe('true')
	expect(first.getAttribute('aria-checked')).toBe('false')
	expect(document.activeElement).toBe(first)
	await act(async () => first.click())
	expect(api.toggle).toHaveBeenCalledOnce()
	// A separate alert changes while the first request is outstanding. Hold the
	// reconciliation fetch so it cannot conceal an incorrect whole-list rollback.
	api.fetch.mockImplementation(() => new Promise(() => {}))
	await act(async () =>
		client.setQueryData<Array<Alert>>([ALERTS_QUERY_KEY, 'test-user'], (current) =>
			current!.map((item) => (item.id === '1' ? { ...item, enabled: false } : item))
		)
	)
	await act(async () => reject(new Error('Toggle unavailable')))
	await settle()
	expect(switches().map((el) => el.getAttribute('aria-checked'))).toEqual(['true', 'false'])
	expect(first.getAttribute('aria-label')).toBe('Alert enabled')
	expect(first.getAttribute('aria-disabled')).not.toBe('true')
	expect(document.querySelector('[role="alert"]')?.textContent).toBe('Toggle unavailable')
	api.toggle.mockResolvedValueOnce(true)
	await act(async () => first.click())
	await settle()
	expect(first.getAttribute('aria-checked')).toBe('false')
	expect(api.toggle).toHaveBeenCalledTimes(2)
})

test('finishing one toggle does not refetch over another pending row', async () => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
	let failFirst!: (error: Error) => void
	let finishSecond!: (value: boolean) => void
	api.fetch.mockResolvedValue(alerts)
	api.toggle
		.mockImplementationOnce(
			() =>
				new Promise<boolean>((_resolve, reject) => {
					failFirst = reject
				})
		)
		.mockImplementationOnce(
			() =>
				new Promise<boolean>((resolve) => {
					finishSecond = resolve
				})
		)
	function Harness() {
		const store = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<QueryClientProvider client={client}>
				<AlertsModal dialogStore={store} />
			</QueryClientProvider>
		)
	}
	await act(async () => root.render(<Harness />))
	await settle()
	await settle()
	await act(async () => switches()[0].click())
	await settle()
	await act(async () => switches()[1].click())
	await settle()
	const fetchCount = api.fetch.mock.calls.length
	await act(async () => failFirst(new Error('First toggle failed')))
	await settle()
	expect(switches().map((el) => el.getAttribute('aria-checked'))).toEqual(['true', 'false'])
	expect(api.fetch).toHaveBeenCalledTimes(fetchCount)
	api.fetch.mockResolvedValue(alerts.map((item) => (item.id === '1' ? { ...item, enabled: false } : item)))
	await act(async () => finishSecond(false))
	await settle()
	expect(api.fetch).toHaveBeenCalledTimes(fetchCount + 1)
	expect(switches().map((el) => el.getAttribute('aria-checked'))).toEqual(['true', 'false'])
})
