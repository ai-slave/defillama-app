// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { MemoriesResponse, SkillsResponse } from '~/containers/LlamaAI/api/agentHome'
import { SettingsModal } from '~/containers/LlamaAI/components/SettingsModal'
import { AGENT_HOME_MEMORIES_KEY, AGENT_HOME_SKILLS_KEY } from '~/containers/LlamaAI/hooks/useAgentHomeData'
import type { LlamaAISettings, LlamaAISettingsActions } from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import type {
	WebMobilePreference,
	WebMobilePushEnabledMutation
} from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'

const session = installSubscriberSession('reader')
const AGENT_HOME = 'https://ai.llama.fi/agent-home'
const emptyMemories: MemoriesResponse = { available: true, user: [], memory: [], limits: { user: 1000, memory: 1000 } }
const emptySkills: SkillsResponse = { available: true, active: [], archived: [] }
const offline = () => new Response('offline', { status: 503 })

beforeEach(() => {
	// The lab tab exists only in dark mode; these tests run in light mode.
	document.documentElement.classList.remove('dark')
	document.documentElement.classList.add('light')
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	session.serve({
		[`${AGENT_HOME}/memories`]: emptyMemories,
		[`${AGENT_HOME}/skills`]: emptySkills,
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '3',
			toppedUpBalance: '7',
			freeLimit: '5',
			freeSpent: '2'
		}
	})
})

const settle = (assertion: () => void) =>
	act(async () => {
		await vi.waitFor(assertion)
	})
const agentHomeRequests = (path: string, method = 'GET') =>
	session.requests.filter(
		(request) => request.url.href === `${AGENT_HOME}${path}` && (request.init?.method ?? 'GET') === method
	).length

const settings: LlamaAISettings = {
	customInstructions: 'Saved instructions',
	enableMemory: true,
	enablePremiumTools: true,
	hackerMode: false,
	model: '',
	effort: '',
	enableSoundNotifications: true,
	enterToSend: true,
	advancedProvenance: false,
	showBalanceInSidebar: false,
	spendCapPerMessage: 0.5
}

describe('SettingsModal instructions', () => {
	let container: HTMLDivElement
	let root: Root
	let dialogStore: Ariakit.DialogStore
	let setCustomInstructions: ReturnType<typeof vi.fn<(value: string) => Promise<boolean>>>
	let mutateMobileNotifications: ReturnType<
		typeof vi.fn<(enabled: boolean) => Promise<{ available: boolean; enabled: boolean }>>
	>
	let setMobileNotifications: WebMobilePushEnabledMutation
	let actions: LlamaAISettingsActions

	function Harness({
		currentSettings = settings,
		mobileNotificationPreference
	}: {
		currentSettings?: LlamaAISettings
		mobileNotificationPreference?: WebMobilePreference
	}) {
		dialogStore = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<session.Wrapper>
				<SettingsModal
					dialogStore={dialogStore}
					settings={currentSettings}
					actions={actions}
					mobileNotificationPreference={mobileNotificationPreference}
					setMobileNotificationEnabled={setMobileNotifications}
				/>
			</session.Wrapper>
		)
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		setCustomInstructions = vi.fn(async () => true)
		mutateMobileNotifications = vi.fn(async (enabled: boolean) => ({ available: true, enabled }))
		setMobileNotifications = {
			mutateAsync: mutateMobileNotifications,
			isPending: false,
			error: null
		} as WebMobilePushEnabledMutation
		actions = {
			setCustomInstructions,
			setEnableMemory: vi.fn(async () => true),
			setEnablePremiumTools: vi.fn(async () => true),
			setHackerMode: vi.fn(async () => true),
			setModel: vi.fn(async () => true),
			setEffort: vi.fn(async () => true),
			setEnableSoundNotifications: vi.fn(async () => true),
			setEnterToSend: vi.fn(async () => true),
			setAdvancedProvenance: vi.fn(async () => true),
			setShowBalanceInSidebar: vi.fn(async () => true),
			setSpendCapPerMessage: vi.fn(async () => true)
		}
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<Harness />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	function textarea() {
		return document.querySelector('#llamaai-custom-instructions') as HTMLTextAreaElement
	}

	function change(value: string) {
		const input = textarea()
		const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
		setValue?.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	}

	async function openMemory() {
		await act(async () =>
			[...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
				.find((tab) => tab.textContent === 'Memory')!
				.click()
		)
	}
	test('memory and skills errors offer retry without claiming an empty workspace', async () => {
		let memoriesOnline = false
		session.serve({
			[`${AGENT_HOME}/memories`]: () => (memoriesOnline ? Response.json(emptyMemories) : offline()),
			[`${AGENT_HOME}/skills`]: offline
		})
		await openMemory()
		await settle(() => expect(document.body.textContent).toContain("Couldn't load skills."))
		expect(document.body.textContent).toContain("Couldn't load memories.")
		expect(document.body.textContent).not.toContain('Nothing remembered yet.')
		expect(document.body.textContent).not.toContain('No skills yet.')
		memoriesOnline = true
		const [memoriesRetry, skillsRetry] = document.querySelectorAll<HTMLButtonElement>('[role="alert"] button')
		await act(async () => {
			memoriesRetry.click()
			skillsRetry.click()
		})
		await settle(() => expect(document.body.textContent).toContain('Nothing remembered yet.'))
		await settle(() => expect(document.body.textContent).toContain("Couldn't load skills."))
		expect(agentHomeRequests('/memories')).toBe(2)
		expect(agentHomeRequests('/skills')).toBe(2)
	})
	test('failed refresh retains cached memories and skills, and a failed deletion retries its original target', async () => {
		session.client.setQueryData(AGENT_HOME_MEMORIES_KEY, {
			...emptyMemories,
			user: [{ id: 'memory-1', text: 'Prefer concise answers', chars: 22 }]
		})
		session.client.setQueryData(AGENT_HOME_SKILLS_KEY, {
			...emptySkills,
			active: [
				{
					name: 'Research',
					description: 'Saved workflow',
					source: 'user',
					createdBy: 'user',
					useCount: 1,
					pinned: false,
					lastUsedAt: null,
					referencedSkills: []
				}
			]
		})
		const retriedDelete = Promise.withResolvers<Response>()
		let deletes = 0
		session.serve({
			[`${AGENT_HOME}/memories`]: offline,
			[`${AGENT_HOME}/skills`]: offline,
			[`${AGENT_HOME}/memories/memory-1`]: () => (++deletes === 1 ? offline() : retriedDelete.promise)
		})
		await openMemory()
		await settle(() => expect(document.body.textContent).toContain("Couldn't load memories."))
		expect(document.body.textContent).toContain('Prefer concise answers')
		expect(document.body.textContent).toContain('Saved workflow')
		// With cached data the error stays up during a retry, and its button cannot start another.
		const memoriesRefresh = Promise.withResolvers<Response>()
		session.serve({ [`${AGENT_HOME}/memories`]: () => memoriesRefresh.promise })
		const loadError = () =>
			[...document.querySelectorAll<HTMLElement>('[role="alert"]')].find((el) =>
				el.textContent?.includes("Couldn't load memories")
			)!
		await act(async () => loadError().querySelector('button')!.click())
		await settle(() => expect(loadError().querySelector('button')!.disabled).toBe(true))
		await act(async () => memoriesRefresh.resolve(offline()))
		const deletion = () =>
			[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent === 'Delete')!
		await act(async () => deletion().click())
		const deleteError = () =>
			[...document.querySelectorAll<HTMLElement>('[role="alert"]')].find((el) =>
				el.textContent?.includes("Couldn't delete")
			)
		await settle(() => expect(deleteError()).toBeDefined())
		await act(async () => deleteError()!.querySelector('button')!.click())
		await settle(() => expect(agentHomeRequests('/memories/memory-1', 'DELETE')).toBe(2))
		await settle(() => expect(deletion().disabled).toBe(true))
		await act(async () => retriedDelete.resolve(Response.json({ deleted: true })))
	})
	test('a successfully loaded empty workspace still shows its empty states', async () => {
		await openMemory()
		await settle(() => expect(document.body.textContent).toContain('No skills yet.'))
		expect(document.body.textContent).toContain('Nothing remembered yet.')
		expect(document.querySelector('[role="alert"]')).toBeNull()
	})
	test('section arrows move focus without activating; switching back retains the instruction draft', async () => {
		await act(async () => change('Keep this draft'))
		const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
		const persona = tabs.find((tab) => tab.textContent === 'Persona')!
		const app = tabs.find((tab) => tab.textContent === 'App')!
		await act(async () => {
			persona.focus()
			persona.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
			await new Promise((resolve) => setTimeout(resolve, 30))
		})
		expect(document.activeElement).toBe(app)
		expect(persona.getAttribute('aria-selected')).toBe('true')
		expect(textarea().value).toBe('Keep this draft')
		await act(async () => app.click())
		expect(textarea()).toBeNull()
		expect(document.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(app.id)
		await act(async () => persona.click())
		expect(textarea().value).toBe('Keep this draft')
		const dialog = document.querySelector('[role="dialog"]')!
		expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Settings')
		expect(document.querySelector('[aria-label="Close settings"]')).not.toBeNull()
	})

	test('derives the character count from the controlled draft', async () => {
		await act(async () => change('Short'))

		expect(document.body.textContent).toContain('5/5000')
	})

	test('saves once when blur and dialog close happen together', async () => {
		let resolveSave: ((accepted: boolean) => void) | null = null
		setCustomInstructions.mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveSave = resolve)))
		await act(async () => change('Updated instructions'))
		await act(async () => {
			textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
			dialogStore.hide()
		})

		expect(setCustomInstructions).toHaveBeenCalledTimes(1)
		expect(setCustomInstructions).toHaveBeenCalledWith('Updated instructions')
		await act(async () => resolveSave?.(true))
	})

	test('submits a newer draft before an earlier save settles', async () => {
		let resolveFirstSave: ((accepted: boolean) => void) | null = null
		setCustomInstructions.mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveFirstSave = resolve)))
		await act(async () => change('First draft'))
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		await act(async () => change('Latest draft'))
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		expect(setCustomInstructions).toHaveBeenCalledTimes(2)
		expect(setCustomInstructions).toHaveBeenLastCalledWith('Latest draft')
		await act(async () => resolveFirstSave?.(true))
	})

	test('saves the latest draft when the dialog closes without blur', async () => {
		await act(async () => change('Escape-safe instructions'))
		await act(async () => {
			dialogStore.hide()
			await Promise.resolve()
		})

		expect(setCustomInstructions).toHaveBeenCalledTimes(1)
		expect(setCustomInstructions).toHaveBeenCalledWith('Escape-safe instructions')
	})

	test('does not replace a dirty draft with a settings refresh', async () => {
		await act(async () => change('Local draft'))
		await act(async () =>
			root.render(<Harness currentSettings={{ ...settings, customInstructions: 'Server refresh' }} />)
		)

		expect(textarea().value).toBe('Local draft')
	})

	test('adopts a settings refresh when the draft is clean', async () => {
		await act(async () =>
			root.render(<Harness currentSettings={{ ...settings, customInstructions: 'Server refresh' }} />)
		)

		expect(textarea().value).toBe('Server refresh')
	})

	test('keeps a failed save dirty and retries it', async () => {
		setCustomInstructions.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
		await act(async () => change('Retry me'))
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		expect(setCustomInstructions).toHaveBeenCalledTimes(1)
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		expect(setCustomInstructions).toHaveBeenCalledTimes(2)
	})

	test('clears without first saving the focused draft', async () => {
		await act(async () => {
			textarea().focus()
			change('Discard this draft')
		})
		const clearButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Clear')
		expect(clearButton).toBeDefined()

		await act(async () => {
			clearButton?.focus()
			clearButton?.click()
		})

		expect(setCustomInstructions).toHaveBeenCalledTimes(1)
		expect(setCustomInstructions).toHaveBeenCalledWith('')
	})

	test('keeps the submitted draft when reopened before props catch up', async () => {
		let resolveSave: ((accepted: boolean) => void) | null = null
		setCustomInstructions.mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveSave = resolve)))
		await act(async () => change('Locally submitted'))
		await act(async () => dialogStore.hide())
		await act(async () => dialogStore.show())

		expect(textarea().value).toBe('Locally submitted')
		await act(async () => resolveSave?.(true))
	})

	test('shows the mobile notification toggle only for a ready preference', async () => {
		await act(async () =>
			root.render(<Harness mobileNotificationPreference={{ kind: 'known', available: true, enabled: false }} />)
		)
		const appTab = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'App'
		)
		await act(async () => appTab?.click())

		const findMobileToggle = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>('input[role="switch"]')).find((input) =>
				input.closest('label')?.textContent?.includes('Mobile notifications')
			)
		const mobileToggle = findMobileToggle()
		expect(mobileToggle).toBeDefined()
		await act(async () => mobileToggle?.click())
		expect(mutateMobileNotifications).toHaveBeenCalledWith(true)

		await act(async () =>
			root.render(<Harness mobileNotificationPreference={{ kind: 'known', available: false, enabled: true }} />)
		)
		expect(findMobileToggle()).toBeUndefined()
	})

	test('shows a disabled loading row while the preference query is pending', async () => {
		await act(async () => root.render(<Harness mobileNotificationPreference={{ kind: 'loading' }} />))
		const appTab = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'App'
		)
		await act(async () => appTab?.click())

		expect(document.querySelector('[role="status"]')?.textContent).toContain(
			'Loading your mobile notification preference'
		)
		const mobileToggle = Array.from(document.querySelectorAll('input[role="switch"]')).find((input) =>
			input.closest('label')?.textContent?.includes('Mobile notifications')
		)
		expect(mobileToggle).toBeUndefined()
	})

	test('shows an inline retry when the preference query fails', async () => {
		const retry = vi.fn()
		await act(async () =>
			root.render(<Harness mobileNotificationPreference={{ kind: 'error', message: 'Network unavailable', retry }} />)
		)
		const appTab = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'App'
		)
		await act(async () => appTab?.click())

		const alert = document.querySelector('[role="alert"]')
		expect(alert?.textContent).toContain("Couldn't load mobile notifications")
		expect(document.querySelector('button[aria-label="Mobile notifications"]')).toBeNull()
		const retryButton = Array.from(alert?.querySelectorAll('button') ?? []).find(
			(button) => button.textContent === 'Try again'
		)
		await act(async () => retryButton?.click())
		expect(retry).toHaveBeenCalledOnce()
	})

	test('restores the spend cap after a failed save', async () => {
		actions.setSpendCapPerMessage = vi.fn(async () => false)
		const capabilitiesTab = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Capabilities'
		)
		await act(async () => capabilitiesTab?.click())
		const input = document.querySelector('#llamaai-spend-cap') as HTMLInputElement
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set

		await act(async () => {
			setValue?.call(input, '1.25')
			input.dispatchEvent(new Event('input', { bubbles: true }))
			input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
			await Promise.resolve()
		})

		expect(input.value).toBe('0.50')
	})
})

describe('SettingsModal initial tab', () => {
	let container: HTMLDivElement
	let root: Root
	let actions: LlamaAISettingsActions

	function Harness({
		initialState,
		currentSettings = settings
	}: {
		initialState?: { tab?: string; tgloginToken?: string; topupResult?: 'success' | 'cancelled' } | null
		currentSettings?: LlamaAISettings
	}) {
		const dialogStore = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<session.Wrapper>
				<SettingsModal
					dialogStore={dialogStore}
					settings={currentSettings}
					actions={actions}
					initialState={initialState as never}
					setMobileNotificationEnabled={
						{ mutateAsync: vi.fn(), isPending: false, error: null } as unknown as WebMobilePushEnabledMutation
					}
				/>
			</session.Wrapper>
		)
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		actions = {
			setCustomInstructions: vi.fn(async () => true),
			setEnableMemory: vi.fn(async () => true),
			setEnablePremiumTools: vi.fn(async () => true),
			setHackerMode: vi.fn(async () => true),
			setModel: vi.fn(async () => true),
			setEffort: vi.fn(async () => true),
			setEnableSoundNotifications: vi.fn(async () => true),
			setEnterToSend: vi.fn(async () => true),
			setAdvancedProvenance: vi.fn(async () => true),
			setShowBalanceInSidebar: vi.fn(async () => true),
			setSpendCapPerMessage: vi.fn(async () => true)
		} as LlamaAISettingsActions
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const render = async (
		initialState?: { tab?: string; tgloginToken?: string; topupResult?: 'success' | 'cancelled' } | null
	) => act(async () => root.render(<Harness initialState={initialState} />))

	const tab = (label: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((node) => node.textContent === label)!

	const openTabId = () => document.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')

	test('opens on the tab the caller asked for', async () => {
		await render({ tab: 'capabilities' })
		expect(openTabId()).toBe(tab('Capabilities').id)
	})

	test('applies a newly requested tab', async () => {
		await render({ tab: 'capabilities' })
		await render({ tab: 'app' })
		expect(openTabId()).toBe(tab('App').id)
	})

	// The request used to be reapplied whenever the selection differed from it, so a caller that kept
	// its request alive pulled the user back to that tab every time they left it.
	test('does not pull the user back to the requested tab', async () => {
		await render({ tab: 'capabilities', tgloginToken: 'keeps-the-request-alive' })
		expect(openTabId()).toBe(tab('Capabilities').id)

		await act(async () => tab('App').click())
		expect(openTabId()).toBe(tab('App').id)
	})

	// The lab tab exists only in dark mode, and these tests run in light mode.
	test('falls back from a requested lab tab outside dark mode', async () => {
		await render({ tab: 'lab' })
		expect(openTabId()).toBe(tab('Persona').id)
	})
	test('Balance follows Memory and keeps return feedback after the route intent is consumed', async () => {
		await render({ tab: 'balance', topupResult: 'cancelled' })
		expect(openTabId()).toBe(tab('Balance').id)
		expect([...document.querySelectorAll('[role="tab"]')].map((node) => node.textContent)).toEqual([
			'Persona',
			'App',
			'Capabilities',
			'Integrations',
			'Memory',
			'Balance'
		])
		await render(null)
		expect(document.querySelector('[role="tabpanel"]')?.textContent).toContain('Payment cancelled')
		expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
		await act(async () => tab('App').click())
		expect(openTabId()).toBe(tab('App').id)
	})

	test.each([false, true])('the Balance sidebar toggle shows saved value %s and flips it', async (saved) => {
		await act(async () =>
			root.render(
				<Harness initialState={{ tab: 'balance' }} currentSettings={{ ...settings, showBalanceInSidebar: saved }} />
			)
		)
		const toggle = document.querySelector<HTMLInputElement>('[aria-label="Show balance in sidebar"]')!
		expect(toggle.checked).toBe(saved)

		await act(async () => toggle.click())
		expect(actions.setShowBalanceInSidebar).toHaveBeenCalledWith(!saved)
	})
})
