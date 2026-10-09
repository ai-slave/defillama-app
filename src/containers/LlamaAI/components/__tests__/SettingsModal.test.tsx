// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { MemoriesResponse, SkillsResponse } from '~/containers/LlamaAI/api/agentHome'
import { SettingsModal } from '~/containers/LlamaAI/components/SettingsModal'
import { AGENT_HOME_MEMORIES_KEY, AGENT_HOME_SKILLS_KEY } from '~/containers/LlamaAI/hooks/useAgentHomeData'
import type { LlamaAISettings, SaveLlamaAISettings } from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import type {
	WebMobilePreference,
	WebMobilePushEnabledMutation
} from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fieldErrorOf } from '~/utils/testing/fieldErrors'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

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

const buttonNamed = (name: string, within: ParentNode = document) =>
	[...within.querySelectorAll<HTMLButtonElement>('button')].find((node) => accessibleName(node) === name)
const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]')
const alertText = (within: ParentNode = document) => within.querySelector('[role="alert"]')?.textContent
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

const SIGNED_OUT: WebMobilePreference = { kind: 'signed-out' }

// The spend cap field, found by its visible label.
function spendCapInput() {
	const label = [...document.querySelectorAll('label')].find((el) => el.textContent === 'Spend cap per message')!
	return document.getElementById(label.htmlFor) as HTMLInputElement
}

describe('SettingsModal instructions', () => {
	let container: HTMLDivElement
	let root: Root
	let dialogStore: Ariakit.DialogStore
	let saveSettings: ReturnType<typeof vi.fn<SaveLlamaAISettings>>
	let mutateMobileNotifications: ReturnType<
		typeof vi.fn<(enabled: boolean) => Promise<{ available: boolean; enabled: boolean }>>
	>
	let setMobileNotifications: WebMobilePushEnabledMutation

	function Harness({
		currentSettings = settings,
		mobileNotificationPreference = SIGNED_OUT
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
					saveSettings={saveSettings}
					availableModels={[]}
					availableEfforts={[]}
					telegramStatus={null}
					isSettingsLoading={false}
					initialState={null}
					onInitialStateConsumed={() => {}}
					mobileNotificationPreference={mobileNotificationPreference}
					setMobileNotificationEnabled={setMobileNotifications}
				/>
			</session.Wrapper>
		)
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		saveSettings = vi.fn(async () => true)
		mutateMobileNotifications = vi.fn(async (enabled: boolean) => ({ available: true, enabled }))
		setMobileNotifications = {
			mutateAsync: mutateMobileNotifications,
			isPending: false,
			error: null
		} as WebMobilePushEnabledMutation
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
		await waitForUi(() => expect(document.body.textContent).toContain("Couldn't load skills."))
		expect(document.body.textContent).toContain("Couldn't load memories.")
		expect(document.body.textContent).not.toContain('Nothing remembered yet.')
		expect(document.body.textContent).not.toContain('No skills yet.')
		memoriesOnline = true
		const [memoriesRetry, skillsRetry] = document.querySelectorAll<HTMLButtonElement>('[role="alert"] button')
		await act(async () => {
			memoriesRetry.click()
			skillsRetry.click()
		})
		await waitForUi(() => expect(document.body.textContent).toContain('Nothing remembered yet.'))
		await waitForUi(() => expect(document.body.textContent).toContain("Couldn't load skills."))
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
		await waitForUi(() => expect(document.body.textContent).toContain("Couldn't load memories."))
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
		await waitForUi(() => expect(loadError().querySelector('button')!.getAttribute('aria-busy')).toBe('true'))
		await act(async () => memoriesRefresh.resolve(offline()))
		// Deleting asks first, and the confirmation owns the request: its error, its retry of the same memory, its pending.
		await act(async () => buttonNamed('Delete')!.click())
		await waitForUi(() => expect(confirmation()?.textContent).toContain('Delete this memory?'))
		expect(agentHomeRequests('/memories/memory-1', 'DELETE')).toBe(0)
		await act(async () => buttonNamed('Delete', confirmation()!)!.click())
		await waitForUi(() => expect(alertText(confirmation()!)).toBe("Couldn't delete this memory. Try again."))
		await act(async () => buttonNamed('Delete', confirmation()!)!.click())
		await waitForUi(() => expect(buttonNamed('Deleting…', confirmation()!)).toBeDefined())
		expect(agentHomeRequests('/memories/memory-1', 'DELETE')).toBe(2)
		await act(async () => retriedDelete.resolve(Response.json({ deleted: true })))
		await waitForUi(() => expect(confirmation()).toBeNull())
	})
	test('a successfully loaded empty workspace still shows its empty states', async () => {
		await openMemory()
		await waitForUi(() => expect(document.body.textContent).toContain('No skills yet.'))
		expect(document.body.textContent).toContain('Nothing remembered yet.')
		expect(document.querySelector('[role="alert"]')).toBeNull()
	})
	const research = {
		name: 'Research',
		description: 'Saved workflow',
		source: 'user' as const,
		createdBy: 'user' as const,
		useCount: 1,
		pinned: false,
		lastUsedAt: null,
		referencedSkills: []
	}
	// The dialog's first control, where its net puts focus that has nowhere better to go.
	const closeButton = () => buttonNamed('Close dialog')
	const deleteButtons = () =>
		[...document.querySelectorAll<HTMLButtonElement>('[role="tabpanel"] button')].filter(
			(b) => b.textContent === 'Delete'
		)
	async function press(button: HTMLElement) {
		await act(async () => {
			button.focus()
			button.click()
		})
	}
	test('a retry that clears the memories notice leaves focus in the dialog', async () => {
		session.client.setQueryData(AGENT_HOME_MEMORIES_KEY, {
			...emptyMemories,
			user: [{ id: 'memory-1', text: 'Prefer concise answers', chars: 22 }]
		})
		let online = false
		session.serve({ [`${AGENT_HOME}/memories`]: () => (online ? Response.json(emptyMemories) : offline()) })
		await openMemory()
		await waitForUi(() => expect(alertText()).toContain("Couldn't load memories."))
		online = true
		await press(buttonNamed('Try again')!)
		await waitForUi(() => expect(document.querySelector('[role="alert"]')).toBeNull())
		await waitForUi(() => expect(document.activeElement).toBe(closeButton()))
	})
	test('cancelling a memory deletion returns focus to Delete; deleting hands it to the next entry, the last to the dialog', async () => {
		const deleted = new Set<string>()
		const entries = [
			{ id: 'memory-1', text: 'Prefer concise answers', chars: 22 },
			{ id: 'memory-2', text: 'Trades on Arbitrum', chars: 18 }
		]
		session.serve({
			[`${AGENT_HOME}/memories`]: () =>
				Response.json({ ...emptyMemories, user: entries.filter((entry) => !deleted.has(entry.id)) }),
			[`${AGENT_HOME}/memories/memory-1`]: () => {
				deleted.add('memory-1')
				return Response.json({ deleted: true })
			},
			[`${AGENT_HOME}/memories/memory-2`]: () => {
				deleted.add('memory-2')
				return Response.json({ deleted: true })
			}
		})
		await openMemory()
		await waitForUi(() => expect(deleteButtons()).toHaveLength(2))
		const [first, second] = deleteButtons()
		await press(first)
		await waitForUi(() => expect(confirmation()?.textContent).toContain('Delete this memory?'))
		// Cancel keeps the row, so focus goes back to its Delete.
		await act(async () => buttonNamed('Cancel', confirmation()!)!.click())
		await waitForUi(() => expect(document.activeElement).toBe(first))
		await press(first)
		await waitForUi(() => expect(confirmation()?.textContent).toContain('Delete this memory?'))
		await act(async () => buttonNamed('Delete', confirmation()!)!.click())
		await waitForUi(() => expect(document.body.textContent).not.toContain('Prefer concise answers'))
		await waitForUi(() => expect(document.activeElement).toBe(second))
		// The last entry has no neighbour left.
		await press(second)
		await waitForUi(() => expect(confirmation()?.textContent).toContain('Delete this memory?'))
		await act(async () => buttonNamed('Delete', confirmation()!)!.click())
		await waitForUi(() => expect(document.body.textContent).toContain('Nothing remembered yet.'))
		await waitForUi(() => expect(document.activeElement).toBe(closeButton()))
	})
	test('archiving a skill hands focus to the next skill once it moves to Archived', async () => {
		const notes = { ...research, name: 'Notes' }
		const archive = Promise.withResolvers<Response>()
		let archived = false
		session.serve({
			[`${AGENT_HOME}/skills`]: () =>
				Response.json(
					archived
						? { ...emptySkills, active: [notes], archived: [research] }
						: { ...emptySkills, active: [research, notes] }
				),
			[`${AGENT_HOME}/skills/Research`]: () => archive.promise
		})
		await openMemory()
		await waitForUi(() => expect(document.body.textContent).toContain('Notes'))
		const [first, next] = [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Archive')
		await press(first)
		// The next skill's Archive waits while this one archives, and stays focusable for the handoff.
		await waitForUi(() => expect(first.getAttribute('aria-busy')).toBe('true'))
		expect(next.getAttribute('aria-disabled')).toBe('true')
		archived = true
		await act(async () => archive.resolve(Response.json({ message: 'archived' })))
		await waitForUi(() => expect(document.body.textContent).toContain('Archived (1)'))
		await waitForUi(() => expect(document.activeElement).toBe(next))
	})
	test('retrying a failed archive keeps its error on screen while the retry runs', async () => {
		const archives: Array<() => Response | Promise<Response>> = [offline, () => new Promise<Response>(() => {})]
		session.serve({
			[`${AGENT_HOME}/skills`]: () => Response.json({ ...emptySkills, active: [research] }),
			[`${AGENT_HOME}/skills/Research`]: () => archives.shift()!()
		})
		await openMemory()
		await waitForUi(() => expect(buttonNamed('Archive')).toBeDefined())
		await press(buttonNamed('Archive')!)
		await waitForUi(() => expect(buttonNamed('Try again')).toBeDefined())
		const retry = buttonNamed('Try again')!
		await press(retry)

		await waitForUi(() => expect(retry.getAttribute('aria-busy')).toBe('true'))
		expect(retry.closest('[role="alert"]')?.textContent).toContain("Couldn't archive this skill.")
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
		expect(buttonNamed('Close dialog', dialog)).toBeDefined()
	})

	test('derives the character count from the controlled draft', async () => {
		await act(async () => change('Short'))

		expect(document.body.textContent).toContain('5/5000')
	})

	test('saves once when blur and dialog close happen together', async () => {
		let resolveSave: ((accepted: boolean) => void) | null = null
		saveSettings.mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveSave = resolve)))
		await act(async () => change('Updated instructions'))
		await act(async () => {
			textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
			dialogStore.hide()
		})

		expect(saveSettings).toHaveBeenCalledTimes(1)
		expect(saveSettings).toHaveBeenCalledWith({ customInstructions: 'Updated instructions' })
		await act(async () => resolveSave?.(true))
	})

	test('submits a newer draft before an earlier save settles', async () => {
		let resolveFirstSave: ((accepted: boolean) => void) | null = null
		saveSettings.mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveFirstSave = resolve)))
		await act(async () => change('First draft'))
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		await act(async () => change('Latest draft'))
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		expect(saveSettings).toHaveBeenCalledTimes(2)
		expect(saveSettings).toHaveBeenLastCalledWith({ customInstructions: 'Latest draft' })
		await act(async () => resolveFirstSave?.(true))
	})

	test('saves the latest draft when the dialog closes without blur', async () => {
		await act(async () => change('Escape-safe instructions'))
		await act(async () => {
			dialogStore.hide()
			await Promise.resolve()
		})

		expect(saveSettings).toHaveBeenCalledTimes(1)
		expect(saveSettings).toHaveBeenCalledWith({ customInstructions: 'Escape-safe instructions' })
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
		saveSettings.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
		await act(async () => change('Retry me'))
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		expect(saveSettings).toHaveBeenCalledTimes(1)
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		expect(saveSettings).toHaveBeenCalledTimes(2)
	})

	test('clearing a draft that leaves nothing to clear returns focus to the field', async () => {
		await act(async () => root.render(<Harness currentSettings={{ ...settings, customInstructions: '' }} />))
		await act(async () => change('Typed, never saved'))
		await press(buttonNamed('Clear')!)
		expect(buttonNamed('Clear')).toBeUndefined()
		expect(document.activeElement).toBe(textarea())
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
		await act(async () => buttonNamed('Clear', confirmation()!)!.click())

		expect(saveSettings).toHaveBeenCalledTimes(1)
		expect(saveSettings).toHaveBeenCalledWith({ customInstructions: '' })
	})

	test('clearing saved instructions asks first, and Cancel keeps them', async () => {
		await press(buttonNamed('Clear')!)
		expect(confirmation()?.textContent).toContain('Clear your instructions?')
		await act(async () => buttonNamed('Cancel', confirmation()!)!.click())
		await waitForUi(() => expect(confirmation()).toBeNull())
		expect(textarea().value).toBe('Saved instructions')
		expect(saveSettings).not.toHaveBeenCalled()
		await press(buttonNamed('Clear')!)
		await act(async () => buttonNamed('Clear', confirmation()!)!.click())
		expect(saveSettings).toHaveBeenCalledExactlyOnceWith({ customInstructions: '' })
		await waitForUi(() => expect(document.activeElement).toBe(textarea()))
	})

	test('keeps the submitted draft when reopened before props catch up', async () => {
		let resolveSave: ((accepted: boolean) => void) | null = null
		saveSettings.mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveSave = resolve)))
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

	test('the mobile notification row that replaces a retried error takes focus', async () => {
		await act(async () =>
			root.render(
				<Harness mobileNotificationPreference={{ kind: 'error', message: 'Network unavailable', retry: () => {} }} />
			)
		)
		await act(async () =>
			[...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
				.find((tab) => tab.textContent === 'App')!
				.click()
		)
		await press(buttonNamed('Try again')!)
		await act(async () =>
			root.render(<Harness mobileNotificationPreference={{ kind: 'known', available: true, enabled: false }} />)
		)
		expect(document.activeElement?.getAttribute('role')).toBe('switch')
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Mobile notifications')
	})

	test('a refused setting save says so inside the dialog', async () => {
		saveSettings.mockResolvedValue(false)
		await act(async () => buttonNamed('App')!.click())
		await act(async () => document.querySelector<HTMLInputElement>('[aria-label="Enter to send"]')!.click())

		await waitForUi(() => expect(alertText()).toBe("Couldn't save that setting. Try again."))
		expect(document.querySelector('[role="alert"]')!.closest('[role="dialog"]')).not.toBeNull()
	})

	test('a save refused after closing and reopening still says so in the reopened dialog', async () => {
		const pendingSave = Promise.withResolvers<boolean>()
		saveSettings.mockImplementation(() => pendingSave.promise)
		await act(async () => buttonNamed('App')!.click())
		await act(async () => document.querySelector<HTMLInputElement>('[aria-label="Enter to send"]')!.click())
		await act(async () => dialogStore.hide())
		await act(async () => dialogStore.show())
		await act(async () => buttonNamed('App')!.click())

		await act(async () => pendingSave.resolve(false))
		await waitForUi(() => expect(alertText()).toBe("Couldn't save that setting. Try again."))
	})

	test('Save shows its progress, and a refused save keeps the dialog open with its error', async () => {
		const firstSave = Promise.withResolvers<boolean>()
		saveSettings.mockImplementationOnce(() => firstSave.promise).mockResolvedValueOnce(false)
		await act(async () => change('Answer in bullet points'))
		await act(async () => buttonNamed('Save')!.click())
		expect(buttonNamed('Saving…')).toBeDefined()

		await act(async () => firstSave.resolve(false))
		expect(alertText()).toBe("Couldn't save your instructions. Try again.")
		expect(buttonNamed('Save')).toBeDefined()

		await act(async () => {
			textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
		})
		await waitForUi(() => expect(saveSettings).toHaveBeenCalledTimes(2))
		expect(dialogStore.getState().open).toBe(true)
		expect(alertText()).toBe("Couldn't save your instructions. Try again.")
	})

	test('a retried instructions save keeps its error on screen until the retry lands', async () => {
		const retry = Promise.withResolvers<boolean>()
		saveSettings.mockResolvedValueOnce(false).mockImplementationOnce(() => retry.promise)
		await act(async () => change('Answer in bullet points'))
		await act(async () => buttonNamed('Save')!.click())
		await waitForUi(() => expect(alertText()).toBe("Couldn't save your instructions. Try again."))

		await act(async () => buttonNamed('Save')!.click())
		expect(buttonNamed('Saving…')).toBeDefined()
		expect(alertText()).toBe("Couldn't save your instructions. Try again.")

		await act(async () => retry.resolve(true))
		await waitForUi(() => expect(alertText()).toBeUndefined())
	})

	test('Clear all asks first, keeps its progress and error in the confirmation, and closes once cleared', async () => {
		const entry = { id: 'memory-1', text: 'Prefers ETH pairs', chars: 17 }
		let cleared = false
		const retriedClear = Promise.withResolvers<Response>()
		let clears = 0
		session.serve({
			[`${AGENT_HOME}/memories`]: () => Response.json({ ...emptyMemories, user: cleared ? [] : [entry] }),
			[`${AGENT_HOME}/memories?target=user`]: () => (++clears === 1 ? offline() : retriedClear.promise)
		})
		await openMemory()
		await waitForUi(() => expect(document.body.textContent).toContain('Prefers ETH pairs'))

		await press(buttonNamed('Clear all')!)
		await waitForUi(() => expect(confirmation()?.textContent).toContain('Clear everything about you?'))
		expect(agentHomeRequests('/memories?target=user', 'DELETE')).toBe(0)

		await act(async () => buttonNamed('Clear all', confirmation()!)!.click())
		await waitForUi(() => expect(alertText(confirmation()!)).toBe("Couldn't clear these memories. Try again."))
		await act(async () => buttonNamed('Clear all', confirmation()!)!.click())
		await waitForUi(() => expect(buttonNamed('Clearing…', confirmation()!)).toBeDefined())

		cleared = true
		await act(async () => retriedClear.resolve(Response.json({ cleared: 1 })))
		await waitForUi(() => expect(confirmation()).toBeNull())
		expect(document.body.textContent).toContain('Nothing remembered yet.')
		expect(agentHomeRequests('/memories?target=user', 'DELETE')).toBe(2)
		// A cleared list leaves no row to hand focus to.
		await waitForUi(() => expect(document.activeElement).toBe(closeButton()))
	})

	test('a saved draft stays until settings report it, and the field then follows later refreshes', async () => {
		await act(async () => change('Lead with numbers'))
		await act(async () => buttonNamed('Save')!.click())
		// The settings prop reports a save a task later; the field keeps the saved text meanwhile.
		expect(textarea().value).toBe('Lead with numbers')
		expect(buttonNamed('Save')).toBeUndefined()

		await act(async () =>
			root.render(<Harness currentSettings={{ ...settings, customInstructions: 'Lead with numbers' }} />)
		)
		await act(async () =>
			root.render(<Harness currentSettings={{ ...settings, customInstructions: 'Set on another device' }} />)
		)
		expect(textarea().value).toBe('Set on another device')
	})

	test('an older save of the same text never clears a newer draft', async () => {
		const resolvers: Array<(accepted: boolean) => void> = []
		saveSettings.mockImplementation(() => new Promise<boolean>((resolve) => resolvers.push(resolve)))
		await act(async () => change('Lead with numbers'))
		await act(async () => buttonNamed('Save')!.click())
		await act(async () => change('Lead with charts'))
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		// The reader goes back to the first text and keeps editing without submitting it.
		await act(async () => change('Lead with numbers'))

		await act(async () => resolvers[0](true))
		await act(async () =>
			root.render(<Harness currentSettings={{ ...settings, customInstructions: 'Lead with numbers' }} />)
		)
		await act(async () => resolvers[1](true))
		await act(async () =>
			root.render(<Harness currentSettings={{ ...settings, customInstructions: 'Lead with charts' }} />)
		)

		expect(saveSettings.mock.calls).toEqual([
			[{ customInstructions: 'Lead with numbers' }],
			[{ customInstructions: 'Lead with charts' }]
		])
		expect(textarea().value).toBe('Lead with numbers')
		expect(buttonNamed('Save')).toBeDefined()
	})

	test('the spend cap follows a settings refresh until the reader types one', async () => {
		await act(async () => buttonNamed('Capabilities')!.click())
		const input = () => spendCapInput()
		await act(async () => root.render(<Harness currentSettings={{ ...settings, spendCapPerMessage: 0.75 }} />))
		expect(input().value).toBe('0.75')

		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), '1.2')
			input().dispatchEvent(new Event('input', { bubbles: true }))
		})
		await act(async () => root.render(<Harness currentSettings={{ ...settings, spendCapPerMessage: 0.9 }} />))
		expect(input().value).toBe('1.2')
	})

	test('a refused spend cap keeps what was typed, says why under the field, and saves nothing', async () => {
		await act(async () => buttonNamed('Capabilities')!.click())
		const input = spendCapInput()
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '-1')
			input.dispatchEvent(new Event('input', { bubbles: true }))
			input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
		})
		expect(input.value).toBe('-1')
		expect(fieldErrorOf(input)).toBe('Enter an amount of $0 or more.')
		expect(saveSettings).not.toHaveBeenCalled()
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '1')
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(input.getAttribute('aria-invalid')).toBeNull()
	})

	test('restores the spend cap after a failed save', async () => {
		saveSettings.mockResolvedValue(false)
		const capabilitiesTab = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Capabilities'
		)
		await act(async () => capabilitiesTab?.click())
		const input = spendCapInput()
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set

		await act(async () => {
			setValue?.call(input, '1.25')
			input.dispatchEvent(new Event('input', { bubbles: true }))
			input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
			await Promise.resolve()
		})

		expect(input.value).toBe('0.50')
		expect(alertText()).toBe("Couldn't save your spend cap. Try again.")
	})
})

describe('SettingsModal initial tab', () => {
	let container: HTMLDivElement
	let root: Root
	let saveSettings: ReturnType<typeof vi.fn<SaveLlamaAISettings>>
	let tabDialogStore: Ariakit.DialogStore

	function Harness({
		initialState,
		currentSettings = settings
	}: {
		initialState?: { tab?: string; tgloginToken?: string; topupResult?: 'success' | 'cancelled' } | null
		currentSettings?: LlamaAISettings
	}) {
		const dialogStore = Ariakit.useDialogStore({ defaultOpen: true })
		tabDialogStore = dialogStore
		return (
			<session.Wrapper>
				<SettingsModal
					dialogStore={dialogStore}
					settings={currentSettings}
					saveSettings={saveSettings}
					availableModels={[]}
					availableEfforts={[]}
					telegramStatus={null}
					isSettingsLoading={false}
					initialState={initialState as never}
					onInitialStateConsumed={() => {}}
					mobileNotificationPreference={{ kind: 'signed-out' }}
					setMobileNotificationEnabled={
						{ mutateAsync: vi.fn(), isPending: false, error: null } as unknown as WebMobilePushEnabledMutation
					}
				/>
			</session.Wrapper>
		)
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		saveSettings = vi.fn(async () => true)
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

	test('a Telegram login link opens Integrations on the code field', async () => {
		session.serve({
			'https://ai.llama.fi/telegram/status': { link: { state: 'unlinked' }, pending: null },
			'https://ai.llama.fi/slack/status': { links: [], pending: null }
		})
		await render({ tab: 'integrations', tgloginToken: 'token' })
		await waitForUi(() =>
			expect(document.activeElement).toBe(document.querySelector('input[autocomplete="one-time-code"]'))
		)
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

	test('reopening Settings without a top-up does not check the payment again', async () => {
		await render({ tab: 'balance', topupResult: 'success' })
		await waitForUi(() =>
			expect(document.querySelector('[role="tabpanel"]')?.textContent).toContain('Checking your payment')
		)
		await act(async () => tabDialogStore.hide())

		// The sidebar's Settings button opens it with no state of its own.
		await render(null)
		await act(async () => tabDialogStore.show())
		await waitForUi(() => expect(openTabId()).toBe(tab('Balance').id))
		expect(document.querySelector('[role="tabpanel"]')?.textContent).not.toContain('Checking your payment')
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
		expect(saveSettings).toHaveBeenCalledWith({ showBalanceInSidebar: !saved })
	})
})
