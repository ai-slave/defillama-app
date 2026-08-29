// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsModal } from '~/containers/LlamaAI/components/SettingsModal'
import type { LlamaAISettings, LlamaAISettingsActions } from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import type {
	WebMobilePreference,
	WebMobilePushEnabledMutation
} from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'

vi.mock('~/containers/LlamaAI/hooks/useAgentHomeData', () => ({
	useAgentHomeData: () => ({})
}))

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

	it('derives the character count from the controlled draft', async () => {
		await act(async () => change('Short'))

		expect(document.body.textContent).toContain('5/500')
	})

	it('saves once when blur and dialog close happen together', async () => {
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

	it('submits a newer draft before an earlier save settles', async () => {
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

	it('saves the latest draft when the dialog closes without blur', async () => {
		await act(async () => change('Escape-safe instructions'))
		await act(async () => {
			dialogStore.hide()
			await Promise.resolve()
		})

		expect(setCustomInstructions).toHaveBeenCalledTimes(1)
		expect(setCustomInstructions).toHaveBeenCalledWith('Escape-safe instructions')
	})

	it('does not replace a dirty draft with a settings refresh', async () => {
		await act(async () => change('Local draft'))
		await act(async () =>
			root.render(<Harness currentSettings={{ ...settings, customInstructions: 'Server refresh' }} />)
		)

		expect(textarea().value).toBe('Local draft')
	})

	it('adopts a settings refresh when the draft is clean', async () => {
		await act(async () =>
			root.render(<Harness currentSettings={{ ...settings, customInstructions: 'Server refresh' }} />)
		)

		expect(textarea().value).toBe('Server refresh')
	})

	it('keeps a failed save dirty and retries it', async () => {
		setCustomInstructions.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
		await act(async () => change('Retry me'))
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		expect(setCustomInstructions).toHaveBeenCalledTimes(1)
		await act(async () => textarea().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		expect(setCustomInstructions).toHaveBeenCalledTimes(2)
	})

	it('clears without first saving the focused draft', async () => {
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

	it('keeps the submitted draft when reopened before props catch up', async () => {
		let resolveSave: ((accepted: boolean) => void) | null = null
		setCustomInstructions.mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveSave = resolve)))
		await act(async () => change('Locally submitted'))
		await act(async () => dialogStore.hide())
		await act(async () => dialogStore.show())

		expect(textarea().value).toBe('Locally submitted')
		await act(async () => resolveSave?.(true))
	})

	it('shows the mobile notification toggle only for a ready preference', async () => {
		await act(async () =>
			root.render(<Harness mobileNotificationPreference={{ kind: 'known', available: true, enabled: false }} />)
		)
		const appTab = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'App'
		)
		await act(async () => appTab?.click())

		const mobileToggle = document.querySelector('button[aria-label="Mobile notifications"]') as HTMLButtonElement | null
		expect(mobileToggle).not.toBeNull()
		await act(async () => mobileToggle?.click())
		expect(mutateMobileNotifications).toHaveBeenCalledWith(true)

		await act(async () =>
			root.render(<Harness mobileNotificationPreference={{ kind: 'known', available: false, enabled: true }} />)
		)
		expect(document.querySelector('button[aria-label="Mobile notifications"]')).toBeNull()
	})

	it('shows a disabled loading row while the preference query is pending', async () => {
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

	it('shows an inline retry when the preference query fails', async () => {
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

	it('restores the spend cap after a failed save', async () => {
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
