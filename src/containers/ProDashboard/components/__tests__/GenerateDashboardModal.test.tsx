// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { Dashboard } from '../../dashboardTypes'
import { GenerateDashboardModal } from '../GenerateDashboardModal'
const mocks = vi.hoisted(() => ({ creator: vi.fn(), push: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
const session = installSubscriberSession('owner', { resolved: true })
let root: Root
let container: HTMLDivElement
const save = vi.fn()
const close = vi.fn()
const dashboard: Dashboard = { id: 'new', data: { items: [], dashboardName: 'My analysis' }, created: '', updated: '' }
async function render(open = true, mode: 'create' | 'iterate' = 'create', items: Array<DashboardItemConfig> = []) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<GenerateDashboardModal
					isOpen={open}
					onClose={close}
					onGenerate={save}
					mode={mode}
					existingDashboard={{
						dashboardName: 'Existing dashboard',
						visibility: 'private',
						tags: ['research'],
						description: 'Saved description',
						items
					}}
				/>
			</session.Wrapper>
		)
	)
}
async function submit() {
	await act(async () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
}
function draft() {
	document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'My analysis'
	document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!.value =
		'Compare the fees and TVL of Ethereum and Arbitrum'
}
beforeEach(() => {
	vi.clearAllMocks()
	save.mockReset()
	mocks.creator.mockImplementation(
		async () => new Response('data: {"type":"dashboard_complete","dashboardConfig":{"items":[]}}\n\n')
	)
	// The dashboard creator streams its answer; each test decides what the stream says.
	session.serve({ [`${AI_SERVER}/dashboard-creator`]: (_url: URL, init?: RequestInit) => mocks.creator(_url, init) })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
test('generation waits for persistence, retains a failed draft, and navigates only after a successful retry', async () => {
	const pending = Promise.withResolvers<Dashboard>()
	save.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(dashboard)
	await render()
	draft()
	await submit()
	await waitForUi(() => expect(save).toHaveBeenCalledOnce())
	expect(close).not.toHaveBeenCalled()
	expect(mocks.push).not.toHaveBeenCalled()
	expect(document.querySelector('button[type="submit"]')!.getAttribute('aria-disabled')).toBe('true')
	await submit()
	expect(mocks.creator).toHaveBeenCalledOnce()
	await act(async () => pending.reject(new Error('Save unavailable')))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save unavailable'))
	expect(toast.error).not.toHaveBeenCalled()
	expect(document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value).toBe('My analysis')
	await submit()
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/pro/new')
	expect(mocks.creator).toHaveBeenCalledOnce()
	expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0])
})
test.each(['success', 'failure'] as const)(
	'a generation finishing with %s after unmount cannot affect another opening',
	async (outcome) => {
		const pending = Promise.withResolvers<Dashboard>()
		save.mockReturnValueOnce(pending.promise)
		await render()
		draft()
		await submit()
		await waitForUi(() => expect(save).toHaveBeenCalledOnce())
		await render(false)
		await render()
		await act(async () => {
			if (outcome === 'success') pending.resolve(dashboard)
			else pending.reject(new Error('Earlier generation failed'))
		})
		await waitForUi(() => expect(session.client.isMutating()).toBe(0))
		expect(close).not.toHaveBeenCalled()
		expect(mocks.push).not.toHaveBeenCalled()
		expect(document.querySelector('[role="alert"]')).toBeNull()
		expect(vi.mocked(toast.error).mock.calls).toEqual(outcome === 'failure' ? [['Earlier generation failed.']] : [])
	}
)
test.each([
	[
		'a stream error',
		() => new Response('data: {"type":"error","message":"Generation unavailable"}\n\n'),
		'Generation unavailable.'
	],
	[
		'a network failure',
		() => Promise.reject(new TypeError('Failed to fetch')),
		'Could not reach LlamaAI. Check your connection.'
	],
	['a stream without a dashboard', () => new Response(''), 'LlamaAI sent an unexpected response.']
])('%s is explained inline in plain sentences without attempting to save', async (_case, answer, message) => {
	mocks.creator.mockImplementationOnce(answer)
	await render()
	draft()
	await submit()
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	expect(document.querySelector('[role="alert"]')!.textContent).toBe(`${message}Your draft is still here. Try again.`)
	expect(save).not.toHaveBeenCalled()
	expect(close).not.toHaveBeenCalled()
	expect(toast.error).not.toHaveBeenCalled()
})

test('iteration preserves existing metadata, awaits saving, and closes without creation navigation', async () => {
	const response = Promise.withResolvers<Response>()
	mocks.creator.mockReturnValueOnce(response.promise)
	const pending = Promise.withResolvers<void>()
	save.mockReturnValueOnce(pending.promise)
	await render(true, 'iterate')
	document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!.value =
		'Add a fees comparison to this dashboard'
	await submit()
	await waitForUi(() => expect(accessibleName(document.querySelector('button[type="submit"]')!)).toBe('Updating…'))
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Updating dashboard')
	expect(save).not.toHaveBeenCalled()
	await act(async () =>
		response.resolve(new Response('data: {"type":"dashboard_complete","dashboardConfig":{"items":[]}}\n\n'))
	)
	await waitForUi(() => expect(accessibleName(document.querySelector('button[type="submit"]')!)).toBe('Saving…'))
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Saving dashboard')
	expect(save).toHaveBeenCalledOnce()
	expect(JSON.parse(mocks.creator.mock.calls[0][1].body)).toEqual({
		message: 'Add a fees comparison to this dashboard',
		mode: 'iterate',
		existingDashboard: { dashboardName: 'Existing dashboard', items: [] }
	})
	expect(save.mock.calls[0][0]).toEqual({
		dashboardName: 'Existing dashboard',
		visibility: 'private',
		tags: ['research'],
		description: 'Saved description',
		items: []
	})
	expect(close).not.toHaveBeenCalled()
	await act(async () => pending.resolve())
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(mocks.push).not.toHaveBeenCalled()
})

test('an iteration keeps custom data rows out of the request and restores what the model dropped', async () => {
	const section = { id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' } as DashboardItemConfig
	const customData = {
		id: 'custom-1',
		kind: 'custom-data',
		name: 'Desk numbers',
		columns: [{ name: 'date', type: 'date' }],
		rows: [['2024-01-01']],
		chart: { type: 'line' },
		displayMode: 'table'
	} as unknown as DashboardItemConfig
	save.mockResolvedValueOnce(undefined)
	await render(true, 'iterate', [section, customData])
	document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!.value =
		'Add a fees comparison to this dashboard'
	await submit()
	await waitForUi(() => expect(save).toHaveBeenCalledOnce())
	expect(JSON.parse(mocks.creator.mock.calls[0][1].body).existingDashboard.items).toEqual([
		section,
		{
			id: 'custom-1',
			kind: 'custom-data',
			name: 'Desk numbers',
			columns: [{ name: 'date', type: 'date' }],
			chart: { type: 'line' },
			displayMode: 'table'
		}
	])
	expect(save.mock.calls[0][0].items).toEqual([section, customData])
})

test('editing the prompt discards the generated result, hands focus to the prompt and generates again', async () => {
	save.mockRejectedValueOnce(new Error('Save unavailable')).mockResolvedValueOnce(dashboard)
	await render()
	draft()
	await submit()
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save unavailable'))
	expect(document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!.readOnly).toBe(true)
	const edit = [...document.querySelectorAll('button')].find(
		(el) => accessibleName(el) === 'Edit prompt and regenerate'
	)!
	await act(async () => {
		edit.focus()
		edit.click()
	})
	const prompt = document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!
	await waitForUi(() => expect(prompt.readOnly).toBe(false))
	expect(document.activeElement).toBe(prompt)
	prompt.value = 'Compare stablecoin supplies instead of fees and TVL'
	await submit()
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(mocks.creator).toHaveBeenCalledTimes(2)
	expect(JSON.parse(mocks.creator.mock.calls[1][1].body).message).toBe(prompt.value)
})
test('generation finishing after leaving does not start a save in a new opening', async () => {
	const response = Promise.withResolvers<Response>()
	mocks.creator.mockReturnValueOnce(response.promise)
	await render()
	draft()
	await submit()
	await render(false)
	await render()
	await act(async () =>
		response.resolve(new Response('data: {"type":"dashboard_complete","dashboardConfig":{"items":[]}}\n\n'))
	)
	await waitForUi(() => expect(session.client.isMutating()).toBe(0))
	expect(save).not.toHaveBeenCalled()
	expect(close).not.toHaveBeenCalled()
	expect(document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value).toBe('')
})
