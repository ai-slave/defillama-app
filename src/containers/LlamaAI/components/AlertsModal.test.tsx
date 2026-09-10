// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ALERTS_QUERY_KEY } from './alerts/queryKeys'
import type { Alert } from './alerts/types'
import { AlertsModal } from './AlertsModal'
const mocks = vi.hoisted(() => ({
	fetchAlerts: vi.fn(),
	setAlertEnabled: vi.fn(),
	fetchAlertExecutions: vi.fn(),
	authorizedFetch: vi.fn(),
	authenticated: true
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: mocks.authorizedFetch,
		isAuthenticated: mocks.authenticated,
		loaders: { userLoading: false },
		user: mocks.authenticated ? { id: 'user' } : null
	})
}))
vi.mock('./alerts/api', () => ({
	...mocks,
	deleteAlert: vi.fn(),
	updateAlert: vi.fn(),
	fetchAlertExecutionDetail: vi.fn()
}))
vi.mock('./CreateAlertModal', () => ({ CreateAlertModal: () => null }))
vi.mock('~/containers/Subscription/SignInModal', () => ({ SignInModal: () => null }))
vi.mock('./markdown/ChatMarkdownRenderer', () => ({ ChatMarkdownRenderer: () => null, SourcesList: () => null }))
vi.mock('~/containers/LlamaAI/hooks/useIntegrationLink', () => ({
	useIntegrationLink: () => ({ state: { status: 'idle' } })
}))
vi.mock('~/containers/LlamaAI/hooks/useSlackIntegrationLink', () => ({ useSlackWorkspaces: () => ({}) }))
vi.mock('~/containers/LlamaAI/hooks/useSlackChannels', () => ({ useSlackChannels: () => ({}) }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
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
let root: Root
let container: HTMLDivElement
let client: QueryClient
function Harness() {
	const store = Ariakit.useDialogStore({ defaultOpen: true })
	return (
		<QueryClientProvider client={client}>
			<AlertsModal dialogStore={store} />
		</QueryClientProvider>
	)
}
beforeEach(() => {
	vi.clearAllMocks()
	mocks.authenticated = true
	mocks.fetchAlerts.mockResolvedValue([alert])
	mocks.fetchAlertExecutions.mockResolvedValue([])
	client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
async function render() {
	await act(async () => root.render(<Harness />))
}
async function settle(assertion: () => void) {
	await act(async () => {
		await vi.waitFor(assertion)
	})
}
function toggle() {
	return document.querySelector<HTMLInputElement>('[role="switch"]')!
}

test('a failed refresh retains alerts and exposes retry', async () => {
	client.setQueryData([ALERTS_QUERY_KEY, 'user'], [alert])
	mocks.fetchAlerts.mockRejectedValue(new Error('Offline'))
	await render()
	await settle(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load alerts"))
	expect(document.body.textContent).toContain('Weekly yields')
	mocks.fetchAlerts.mockResolvedValue([alert])
	await act(async () => document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
	await settle(() => expect(document.querySelector('[role="alert"]')).toBeNull())
})

test('pending toggles block repeats, even after opening edit, and roll back on failure', async () => {
	let reject!: (error: Error) => void
	mocks.setAlertEnabled.mockImplementation(
		() =>
			new Promise((_resolve, fail) => {
				reject = fail
			})
	)
	await render()
	await settle(() => expect(toggle()).not.toBeNull())
	await act(async () => toggle().click())
	await settle(() => expect(toggle().getAttribute('aria-disabled')).toBe('true'))
	expect(toggle().getAttribute('aria-busy')).toBe('true')
	await act(async () => {
		document.querySelector<HTMLButtonElement>('button[aria-label="Edit"]')!.click()
		toggle().click()
	})
	expect(mocks.setAlertEnabled).toHaveBeenCalledTimes(1)
	await act(async () => reject(new Error('Toggle failed')))
	await settle(() => expect(toggle().checked).toBe(true))
	expect(toggle().getAttribute('aria-disabled')).not.toBe('true')
	expect(document.body.textContent).toContain('Toggle failed')
})

test('sign-in does not also show the empty alert creation state', async () => {
	mocks.authenticated = false
	await render()
	expect(document.body.textContent).toContain('Sign in to use alerts')
	expect(document.querySelector('[role="status"]')).toBeNull()
	expect(mocks.fetchAlerts).not.toHaveBeenCalled()
	expect(document.body.textContent).not.toContain('Create your first')
})
