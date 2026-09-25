// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard } from '../dashboardTypes'
import { GenerateDashboardModal } from './GenerateDashboardModal'
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
	await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
	expect(close).not.toHaveBeenCalled()
	expect(mocks.push).not.toHaveBeenCalled()
	expect(document.querySelector('button[type="submit"]')!.getAttribute('aria-disabled')).toBe('true')
	await submit()
	expect(mocks.creator).toHaveBeenCalledOnce()
	await act(async () => pending.reject(new Error('Save unavailable')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save unavailable'))
	expect(toast.error).not.toHaveBeenCalled()
	expect(document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value).toBe('My analysis')
	await submit()
	await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
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
		await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
		await render(false)
		await render()
		await act(async () => {
			if (outcome === 'success') pending.resolve(dashboard)
			else pending.reject(new Error('Earlier generation failed'))
		})
		await vi.waitFor(() => expect(session.client.isMutating()).toBe(0))
		expect(close).not.toHaveBeenCalled()
		expect(mocks.push).not.toHaveBeenCalled()
		expect(document.querySelector('[role="alert"]')).toBeNull()
		expect(vi.mocked(toast.error).mock.calls).toEqual(outcome === 'failure' ? [['Earlier generation failed']] : [])
	}
)
test('a stream error is shown inline without attempting to save', async () => {
	mocks.creator.mockResolvedValueOnce(new Response('data: {"type":"error","message":"Generation unavailable"}\n\n'))
	await render()
	draft()
	await submit()
	await vi.waitFor(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Generation unavailable')
	)
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
	await vi.waitFor(() => expect(document.querySelector('button[type="submit"]')?.textContent).toBe('Updating…'))
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Updating dashboard')
	expect(save).not.toHaveBeenCalled()
	await act(async () =>
		response.resolve(new Response('data: {"type":"dashboard_complete","dashboardConfig":{"items":[]}}\n\n'))
	)
	await vi.waitFor(() => expect(document.querySelector('button[type="submit"]')?.textContent).toBe('Saving…'))
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
	await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
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
	await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
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

test('editing the prompt explicitly discards the generated result before generating another', async () => {
	save.mockRejectedValueOnce(new Error('Save unavailable')).mockResolvedValueOnce(dashboard)
	await render()
	draft()
	await submit()
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save unavailable'))
	expect(document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!.readOnly).toBe(true)
	await act(async () =>
		[...document.querySelectorAll('button')].find((el) => el.textContent === 'Edit prompt and regenerate')!.click()
	)
	const prompt = document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!
	await vi.waitFor(() => expect(prompt.readOnly).toBe(false))
	prompt.value = 'Compare stablecoin supplies instead of fees and TVL'
	await submit()
	await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
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
	await vi.waitFor(() => expect(session.client.isMutating()).toBe(0))
	expect(save).not.toHaveBeenCalled()
	expect(close).not.toHaveBeenCalled()
	expect(document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value).toBe('')
})
