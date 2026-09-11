// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { MemoriesResponse, SkillsResponse } from '~/containers/LlamaAI/api/agentHome'
import { SettingsModal } from '~/containers/LlamaAI/components/SettingsModal'
import type { LlamaAISettings, LlamaAISettingsActions } from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import type {
	WebMobilePreference,
	WebMobilePushEnabledMutation
} from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'

const home = vi.hoisted(() => ({
	memories: {
		data: undefined as MemoriesResponse | undefined,
		error: null as Error | null,
		isLoading: false,
		isFetching: false,
		refetch: vi.fn()
	},
	skills: {
		data: undefined as SkillsResponse | undefined,
		error: null as Error | null,
		isLoading: false,
		isFetching: false,
		refetch: vi.fn()
	},
	deleteMemoryMutation: {
		error: null as Error | null,
		isPending: false,
		variables: undefined as string | undefined,
		mutate: vi.fn()
	},
	clearMemoriesMutation: {
		error: null as Error | null,
		isPending: false,
		variables: undefined as string | undefined,
		mutate: vi.fn()
	},
	archiveSkillMutation: {
		error: null as Error | null,
		isPending: false,
		variables: undefined as string | undefined,
		mutate: vi.fn()
	},
	restoreSkillMutation: {
		error: null as Error | null,
		isPending: false,
		variables: undefined as string | undefined,
		mutate: vi.fn()
	}
}))
// A hook composing query results hands back a new object each render, and react-query replaces a
// result object when its state changes. Mutating one in place instead leaves every identity untouched,
// which a memo cannot see -- so writes go through `set`, which replaces the slice it touches.
vi.mock('~/containers/LlamaAI/hooks/useAgentHomeData', () => ({ useAgentHomeData: () => ({ ...home }) }))

function set<K extends keyof typeof home>(slice: K, patch: Partial<(typeof home)[K]>): void {
	home[slice] = { ...home[slice], ...patch }
}

vi.mock('~/contexts/LocalStorage', () => ({
	useDarkModeManager: () => [false, vi.fn()],
	useLlamaAINotifyBannerDismissed: () => [false, vi.fn()]
}))

vi.mock('~/ui/Icon', () => ({
	Icon: ({ name }: { name: string }) => <svg data-icon={name} />
}))

vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))

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
			<SettingsModal
				dialogStore={dialogStore}
				settings={currentSettings}
				actions={actions}
				mobileNotificationPreference={mobileNotificationPreference}
				setMobileNotificationEnabled={setMobileNotifications}
			/>
		)
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		set('memories', { data: undefined, error: null, isFetching: false })
		set('skills', { data: undefined, error: null, isFetching: false })
		for (const mutation of [
			home.deleteMemoryMutation,
			home.clearMemoriesMutation,
			home.archiveSkillMutation,
			home.restoreSkillMutation
		]) {
			mutation.error = null
			mutation.isPending = false
			mutation.variables = undefined
		}
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
		set('memories', { error: new Error('Offline') })
		set('skills', { error: new Error('Offline') })
		await openMemory()
		expect(document.body.textContent).toContain("Couldn't load memories.")
		expect(document.body.textContent).toContain("Couldn't load skills.")
		expect(document.body.textContent).not.toContain('Nothing remembered yet.')
		expect(document.body.textContent).not.toContain('No skills yet.')
		const retries = document.querySelectorAll<HTMLButtonElement>('[role="alert"] button')
		await act(async () => {
			retries[0].click()
			retries[1].click()
		})
		expect(home.memories.refetch).toHaveBeenCalledTimes(1)
		expect(home.skills.refetch).toHaveBeenCalledTimes(1)
		set('memories', { isFetching: true })
		await act(async () => root.render(<Harness currentSettings={{ ...settings }} />))
		expect(document.querySelector<HTMLButtonElement>('[role="alert"] button')!.disabled).toBe(true)
	})
	test('failed refresh retains cached memories and skills, and a failed deletion retries its original target', async () => {
		set('memories', {
			data: {
				available: true,
				user: [{ id: 'memory-1', text: 'Prefer concise answers', chars: 22 }],
				memory: [],
				limits: { user: 1000, memory: 1000 }
			}
		})
		set('skills', {
			data: {
				available: true,
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
				],
				archived: []
			}
		})
		set('memories', { error: new Error('Offline') })
		set('skills', { error: new Error('Offline') })
		set('deleteMemoryMutation', { error: new Error('Delete failed'), variables: 'memory-1' })
		await openMemory()
		expect(document.body.textContent).toContain('Prefer concise answers')
		expect(document.body.textContent).toContain('Saved workflow')
		const error = [...document.querySelectorAll<HTMLElement>('[role="alert"]')].find((el) =>
			el.textContent?.includes("Couldn't delete")
		)!
		await act(async () => error.querySelector('button')!.click())
		expect(home.deleteMemoryMutation.mutate).toHaveBeenCalledExactlyOnceWith('memory-1')
		set('deleteMemoryMutation', { isPending: true })
		await act(async () => root.render(<Harness currentSettings={{ ...settings }} />))
		const deletion = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(el) => el.textContent === 'Delete'
		)!
		expect(deletion.disabled).toBe(true)
	})
	test('a successfully loaded empty workspace still shows its empty states', async () => {
		await openMemory()
		expect(document.body.textContent).toContain('Nothing remembered yet.')
		expect(document.body.textContent).toContain('No skills yet.')
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
		expect(document.querySelector('button[aria-label="Mobile notifications"]')).toBeNull()
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

	function Harness({ initialState }: { initialState?: { tab?: string; tgloginToken?: string } | null }) {
		const dialogStore = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<SettingsModal
				dialogStore={dialogStore}
				settings={settings}
				actions={actions}
				initialState={initialState as never}
				setMobileNotificationEnabled={
					{ mutateAsync: vi.fn(), isPending: false, error: null } as unknown as WebMobilePushEnabledMutation
				}
			/>
		)
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
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

	const render = async (initialState?: { tab?: string; tgloginToken?: string } | null) =>
		act(async () => root.render(<Harness initialState={initialState} />))

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

	// The lab tab exists only in dark mode, and this suite mocks dark mode off.
	test('falls back from a requested lab tab outside dark mode', async () => {
		await render({ tab: 'lab' })
		expect(openTabId()).toBe(tab('Persona').id)
	})
})
