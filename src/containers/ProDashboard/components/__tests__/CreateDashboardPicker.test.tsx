// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
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
		// The templates and the wizard's chain step read chain categories and dimension rankings; these tests need none of them.
		session.serve({
			...appMetadataFixtures({ chains: { ethereum: { name: 'Ethereum', id: 'ethereum' } } }),
			'https://api.llama.fi/chains2': { categories: [] },
			'https://api.llama.fi/chains2/': { chainsUnique: [] },
			'http://localhost:3000/api/dynamic/adapter-metrics/': { protocols: [] },
			[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] }
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
async function mount(mode = 'From scratch', { toPreview = true } = {}) {
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
	if (mode === 'Comparison' && !toPreview) return
	if (mode === 'Comparison') {
		await click('TVL')
		await click('Next')
	} else {
		await click(mode)
	}
}
async function click(name: string) {
	const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')]
	// Mode cards are named by their title plus description, so a title matches by prefix once no name matches exactly.
	const target =
		buttons.find((button) => accessibleName(button) === name) ??
		buttons.find((button) => accessibleName(button).startsWith(name))!
	await act(async () => {
		target.click()
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
		await click('Create dashboard')
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
		expect(document.querySelector('[role="alert"]')!.textContent).toBe('UnavailableYour choices are still here.')
		expect(name.value).toBe('Keep my draft')
		expect(document.querySelector<HTMLInputElement>('input[value="private"]')!.checked).toBe(true)
		await click('Create dashboard')
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
		await click('Create dashboard')
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

	test.each([
		['From scratch', 'Cancel'],
		['Comparison', 'Close dialog']
	])('%s shows the created dashboard after navigation fails and cannot create it again', async (mode, exit) => {
		const saved = Promise.withResolvers<{ id: string; slug: string }>()
		create.mockReturnValueOnce(saved.promise)
		navigation.push.mockRejectedValueOnce(new Error('Route unavailable'))
		await mount(mode)
		if (mode === 'From scratch') {
			document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Saved dashboard'
		}
		const createButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => accessibleName(button) === 'Create dashboard'
		)!
		await click('Create dashboard')
		expect(accessibleName(createButton)).toBe('Creating…')
		const exitButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => accessibleName(button) === exit
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
		expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Dashboard created')
		expect(document.querySelector('a[href="/pro/created-dashboard/edit"]')?.textContent).toBe('Open dashboard')
		expect(
			[...document.querySelectorAll('button')].some((button) => accessibleName(button) === 'Create dashboard')
		).toBe(false)
		await click('Close')
		expect(store.getState().open).toBe(false)
		await act(async () => store.show())
		// The preset reopens the wizard on its metrics step; Back walks out through the first step.
		if (mode === 'Comparison') for (let step = 0; step < 3; step++) await click('Back')
		await click('From scratch')
		expect(document.querySelector('a[href="/pro/created-dashboard/edit"]')).toBeNull()
		expect(document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value).toBe('')
		expect(create).toHaveBeenCalledOnce()
	})

	test('a comparison step that cannot continue says what it still needs', async () => {
		await mount('Comparison')
		await click('Back')
		await click('TVL')
		const next = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => accessibleName(button) === 'Next'
		)!
		expect(next.disabled).toBe(true)
		expect(document.querySelector('footer')!.textContent).toContain('Pick at least 1 metric')
		await click('TVL')
		expect(next.disabled).toBe(false)
		expect(document.querySelector('footer')!.textContent).not.toContain('Pick at least')
	})

	test('the wizard has one back control, and Back on its first step returns to the dashboard choices', async () => {
		await mount('Comparison')
		const names = () => [...document.querySelectorAll('button')].map((button) => accessibleName(button))
		expect(names()).not.toContain('Back to dashboard choices')
		await click('Back')
		await click('Back')
		await click('Back')
		expect(document.body.textContent).toContain('What would you like to compare?')
		await click('Back')
		await waitFor(() => expect(document.body.textContent).toContain('How would you like to create your dashboard?'))
		await click('From scratch')
		expect(names()).toContain('Back to dashboard choices')
	})

	test('the metrics step counts one available metric in the singular', async () => {
		await mount('Comparison')
		await click('Back')
		// The fixture chain only has TVL, so one metric is available.
		expect(document.body.textContent).toContain('1 metric available')
	})

	test('the metrics step offers a retry when metric availability fails to load, and recovers', async () => {
		let available = false
		session.serve({
			'https://api.llama.fi/config/smol/appMetadata-chains.json': () =>
				available
					? Response.json({ ethereum: { name: 'Ethereum', id: 'ethereum' } })
					: new Response('Unavailable', { status: 503 })
		})
		await mount('Comparison', { toPreview: false })
		await waitFor(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toContain(
				'Could not check which metrics the selected chains have.'
			)
		)
		available = true
		await click('Try again')
		await waitFor(() => expect(document.body.textContent).toContain('1 metric available'))
		expect(document.querySelector('[role="alert"]')).toBeNull()
	})

	test('the comparison summary counts one card, one chart and one table in the singular', async () => {
		await mount('Comparison')
		const output = () =>
			[...document.querySelectorAll('span')].find((span) => span.textContent === 'Output')!.nextElementSibling!
				.textContent
		expect(output()).toBe('1 chart + 1 table')
		const metricCard = [...document.querySelectorAll('label')].find((label) => label.textContent === 'TVL')!
		await act(async () => metricCard.querySelector('input')!.click())
		expect(output()).toBe('1 card + 1 chart + 1 table')
	})

	test('navigation completion cannot dismiss a newer picker opening', async () => {
		const route = Promise.withResolvers<boolean>()
		create.mockResolvedValueOnce({ id: 'created' })
		navigation.push.mockReturnValueOnce(route.promise)
		await mount()
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Saved dashboard'
		await click('Create dashboard')
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
		await click('Create dashboard')
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

	test('at the free dashboard limit a refusal says why and offers the upgrade instead of a retry', async () => {
		session.serve({ [`${FEATURES_SERVER}/lite/dashboards`]: { items: [{ id: 'first', name: 'First dashboard' }] } })
		const limit = 'You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.'
		create.mockRejectedValueOnce(new Error(limit))
		await mount()
		// The limit comes from the account's dashboard list, which loads alongside the picker.
		await waitFor(() => expect(localStorage.getItem('lite-dashboards')).toContain('first'))
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Over the limit'
		await click('Create dashboard')
		await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
		const alert = document.querySelector('[role="alert"]')!
		expect(alert.querySelector('span')!.textContent).toBe(limit)
		expect(alert.textContent).not.toContain('Your choices are still here.')
		const upgrade = alert.querySelector('a')!
		expect(upgrade.textContent).toBe('Upgrade to Pro')
		expect(upgrade.getAttribute('href')).toBe('/subscription')
		expect(store.getState().open).toBe(true)
	})

	test('a free account creates a public dashboard it cannot make private', async () => {
		create.mockResolvedValueOnce({ id: 'created', slug: 'free-dashboard' })
		await mount()
		expect(document.querySelector<HTMLInputElement>('input[value="private"]')!.disabled).toBe(true)
		document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Open to everyone'
		await click('Create dashboard')
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
		await click('Create dashboard')
		await waitFor(() => expect(create).toHaveBeenCalledOnce())
		expect(create.mock.calls[0][0]).not.toHaveProperty('teamId')
	})
})
