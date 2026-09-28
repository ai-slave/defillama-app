// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { appMetadataFixtures } from '~/utils/testing/appMetadata'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession, type SessionAccount } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AppMetadataProvider } from '../../AppMetadataContext'
import { CreateDashboardPicker } from '../CreateDashboardPicker'
const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => navigation }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
let session: ReturnType<typeof installSubscriberSession>
function signInAs(account: SessionAccount) {
	const installed = installSubscriberSession('u1', { account, resolved: true })
	beforeEach(() => {
		session = installed
		// The templates read chain categories and dimension rankings; these tests need none of them.
		session.serve({
			...appMetadataFixtures({ chains: { ethereum: { name: 'Ethereum', id: 'ethereum' } } }),
			'https://api.llama.fi/chains2/': { chainsUnique: [] },
			'http://localhost:3000/api/dynamic/adapter-metrics/': { protocols: [] }
		})
	})
}
let root: Root
let container: HTMLDivElement
let store: Ariakit.DialogStore
const create = vi.fn()
let team: { id: string; name: string } | null = null
beforeEach(() => {
	team = null
	vi.clearAllMocks()
	navigation.push.mockReset().mockResolvedValue(true)
	create.mockReset()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function mount(mode = 'From Scratch') {
	if (mode === 'Comparison') await import('../ComparisonWizard')
	function Harness() {
		store = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<CreateDashboardPicker
				dialogStore={store}
				onCreate={create}
				comparisonPreset={mode === 'Comparison' ? { comparisonType: 'chains', items: ['Ethereum'] } : null}
				team={team}
			/>
		)
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AppMetadataProvider>
					<DashboardTestProvider>
						<Harness />
					</DashboardTestProvider>
				</AppMetadataProvider>
			</session.Wrapper>
		)
	)
	await waitFor(() =>
		expect(document.body.textContent).toContain(
			mode === 'Comparison' ? 'Select Metrics to Compare' : 'How would you like to create your dashboard?'
		)
	)
	if (mode === 'Comparison') {
		await click('TVL')
		await click('Next')
	} else {
		await click(mode)
	}
}
async function click(name: string) {
	await act(async () => {
		;[...document.querySelectorAll<HTMLButtonElement>('button')]
			.find((button) => button.getAttribute('aria-label') === name || button.textContent?.trim().startsWith(name))!
			.click()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}
async function waitFor(check: () => void) {
	await waitForUi(async () => {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		check()
	})
}
describe('a subscriber', () => {
	signInAs('subscriber')

	test('failed creation retains the name and visibility, blocks duplicate submissions, and retries successfully', async () => {
		let reject!: (error: Error) => void
		create
			.mockImplementationOnce(
				() =>
					new Promise((_, fail) => {
						reject = fail
					})
			)
			.mockResolvedValueOnce({ id: 'created', slug: 'new-dashboard' })
		await mount()
		const name = document.querySelector<HTMLInputElement>('[name="dashboardName"]')!
		name.value = 'Keep my draft'
		await click('Create Dashboard')
		expect(document.querySelector('fieldset')!.disabled).toBe(true)
		await click('Creating…')
		expect(create).toHaveBeenCalledExactlyOnceWith({
			dashboardName: 'Keep my draft',
			visibility: 'private',
			tags: [],
			description: ''
		})
		await act(async () => {
			reject(new Error('Unavailable'))
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
		expect(name.value).toBe('Keep my draft')
		expect(document.querySelector<HTMLInputElement>('input[value="private"]')!.checked).toBe(true)
		await click('Create Dashboard')
		await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
		await waitFor(() => expect(store.getState().open).toBe(false))
		expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/pro/new-dashboard/edit')
		expect(toast.error).not.toHaveBeenCalled()
	})
	test('a creation finishing after dismissal does not close a newly opened picker', async () => {
		let finish!: () => void
		create.mockImplementationOnce(
			() =>
				new Promise<{ id: string }>((resolve) => {
					finish = () => resolve({ id: 'older' })
				})
		)
		await mount()
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Earlier draft'
		await click('Create Dashboard')
		await waitFor(() => expect(create).toHaveBeenCalledOnce())
		await act(async () => store.hide())
		await act(async () => store.show())
		await act(async () => {
			finish()
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(store.getState().open).toBe(true)
		expect(document.querySelector('[role="alert"]')).toBeNull()
		expect(navigation.push).not.toHaveBeenCalled()
	})

	test('a refusal shows why it was refused, not an invitation to retry', async () => {
		const limit = 'You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.'
		create.mockRejectedValueOnce(new Error(limit))
		await mount()
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Over the limit'
		await click('Create Dashboard')
		await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
		const alert = document.querySelector('[role="alert"]')!
		expect(alert.textContent).toContain(limit)
		expect(alert.textContent).not.toContain('please try again')
		expect(store.getState().open).toBe(true)
	})

	test.each([
		['From Scratch', 'Back to dashboard choices'],
		['From Scratch', 'Cancel'],
		['Comparison', 'Back to dashboard choices'],
		['Comparison', 'Close comparison creation']
	])('%s permits %s after navigation fails without allowing another creation', async (mode, exit) => {
		const saved = Promise.withResolvers<{ id: string; slug: string }>()
		create.mockReturnValueOnce(saved.promise)
		navigation.push.mockRejectedValueOnce(new Error('Route unavailable'))
		await mount(mode)
		if (mode === 'From Scratch') {
			document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Saved dashboard'
		}
		const createButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent?.trim() === 'Create Dashboard'
		)!
		await click('Create Dashboard')
		expect(createButton.textContent?.trim()).toBe('Creating…')
		const exitButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.getAttribute('aria-label') === exit || button.textContent?.trim() === exit
		)!
		// happy-dom click() does not enforce disabled ancestor fieldsets.
		await click('Creating…')
		expect(create).toHaveBeenCalledOnce()
		expect(
			exitButton.disabled ||
				exitButton.getAttribute('aria-disabled') === 'true' ||
				exitButton.closest('fieldset[disabled]') !== null
		).toBe(true)
		await act(async () => saved.resolve({ id: 'created', slug: 'created-dashboard' }))
		await waitFor(() => expect(document.querySelector('a[href="/pro/created-dashboard/edit"]')).not.toBeNull())
		expect(toast.error).not.toHaveBeenCalled()
		expect(document.querySelector('a[href="/pro/created-dashboard/edit"]')?.textContent).toBe('Open dashboard')
		expect(createButton.textContent?.trim()).toBe('Created')
		await click('Created')
		expect(create).toHaveBeenCalledOnce()
		expect(exitButton.disabled).toBe(false)
		expect(exitButton.closest('fieldset[disabled]')).toBeNull()
		await click(exit)
		if (exit === 'Back to dashboard choices') {
			await click('From Scratch')
			await click('Close dialog')
		}
		expect(store.getState().open).toBe(false)
		await act(async () => store.show())
		if (mode === 'Comparison') await click('Back to dashboard choices')
		await click('From Scratch')
		expect(document.querySelector('a[href="/pro/created-dashboard/edit"]')).toBeNull()
		expect(document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value).toBe('')
		expect(create).toHaveBeenCalledOnce()
	})

	test('navigation completion cannot dismiss a newer picker opening', async () => {
		const route = Promise.withResolvers<boolean>()
		create.mockResolvedValueOnce({ id: 'created' })
		navigation.push.mockReturnValueOnce(route.promise)
		await mount()
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Saved dashboard'
		await click('Create Dashboard')
		await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce())
		await act(async () => store.hide())
		await act(async () => store.show())
		await act(async () => route.resolve(true))
		expect(store.getState().open).toBe(true)
		expect(document.querySelector('a[href="/pro/created/edit"]')).toBeNull()
	})

	test('a team member can create the blank dashboard inside the team', async () => {
		team = { id: 'team-1', name: 'Growth' }
		create.mockResolvedValueOnce({ id: 'created', slug: 'team-dashboard' })
		await mount()
		expect(document.body.textContent).toContain('Create in')
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Growth metrics'
		await act(async () => document.querySelector<HTMLInputElement>('input[value="team"]')!.click())
		await click('Create Dashboard')
		await waitFor(() => expect(create).toHaveBeenCalledOnce())
		expect(create).toHaveBeenCalledWith({
			dashboardName: 'Growth metrics',
			visibility: 'private',
			tags: [],
			description: '',
			teamId: 'team-1'
		})
	})

	test('without a team the form has no owner choice', async () => {
		await mount()
		expect(document.body.textContent).not.toContain('Create in')
		expect(document.querySelector('input[value="team"]')).toBeNull()
	})
})

describe('a free account', () => {
	signInAs('free')

	test('a free account creates a public dashboard it cannot make private', async () => {
		create.mockResolvedValueOnce({ id: 'created', slug: 'free-dashboard' })
		await mount()
		expect(document.querySelector<HTMLInputElement>('input[value="private"]')!.disabled).toBe(true)
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Open to everyone'
		await click('Create Dashboard')
		expect(create).toHaveBeenCalledExactlyOnceWith({
			dashboardName: 'Open to everyone',
			visibility: 'public',
			tags: [],
			description: ''
		})
		await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/pro/free-dashboard/edit'))
	})

	test('without a subscription the team option is disabled and no teamId is sent', async () => {
		team = { id: 'team-1', name: 'Growth' }
		create.mockResolvedValueOnce({ id: 'created', slug: 'personal' })
		await mount()
		expect(document.querySelector<HTMLInputElement>('input[value="team"]')!.disabled).toBe(true)
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Personal'
		await click('Create Dashboard')
		await waitFor(() => expect(create).toHaveBeenCalledOnce())
		expect(create.mock.calls[0][0]).not.toHaveProperty('teamId')
	})
})
