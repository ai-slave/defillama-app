// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { useLlamaAISettings } from '../useLlamaAISettings'

const session = installSubscriberSession('user-1')
const SETTINGS_URL = `${AI_SERVER}/user-settings`

// A lost fixture must fail in a second, not wait out the 30s suite timeout.
function within<T>(promise: Promise<T>, ms = 1000): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Not settled in ${ms}ms`)), ms))
	])
}

describe('useLlamaAISettings', () => {
	let container: HTMLDivElement
	let root: Root
	let hook: ReturnType<typeof useLlamaAISettings>
	let auth: ReturnType<typeof useAuthContext>

	function Harness() {
		hook = useLlamaAISettings()
		auth = useAuthContext()
		return null
	}

	async function mount() {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<Harness />
				</session.Wrapper>
			)
		)
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test("logging out takes the account's custom instructions with it but keeps browser preferences", async () => {
		session.serve({
			[SETTINGS_URL]: { settings: { customInstructions: 'Account A private notes', enterToSend: false } }
		})
		await mount()
		await waitForUi(async () => {
			await act(async () => {})
			expect(hook.settings.customInstructions).toBe('Account A private notes')
		})

		await act(async () => auth.logout())

		expect(hook.settings.customInstructions).toBe('')
		expect(hook.settings.enterToSend).toBe(false)
	})

	test('a custom instructions save that lands after switching accounts keeps them out of the next account', async () => {
		let releaseSave!: () => void
		session.serve({
			[SETTINGS_URL]: (_url: URL, init?: RequestInit) => {
				if (init?.method !== 'PUT') return { settings: { customInstructions: '' } }
				return new Promise<Response>((resolve) => (releaseSave = () => resolve(new Response(null))))
			}
		})
		await mount()
		await waitForUi(() => expect(session.requests.some((r) => r.url.href === SETTINGS_URL)).toBe(true))

		let save!: Promise<boolean>
		await act(async () => {
			save = hook.saveSettings({ customInstructions: 'Account A private notes' })
		})
		await waitForUi(() => expect(releaseSave).toBeTypeOf('function'))
		await act(async () => auth.logout())
		const otherRecord = { ...session.record, id: 'user-2' }
		const otherToken = `e30.${btoa(JSON.stringify({ id: 'user-2', exp: 4_102_444_800 }))}.signature`
		session.serve({ '/api/collections/users/auth-refresh': { token: otherToken, record: otherRecord } })
		await act(async () => pb.authStore.save(otherToken, otherRecord))
		await waitForUi(() => expect(auth.user?.id).toBe('user-2'))
		await act(async () => releaseSave())
		await within(save)
		// Read what the page shows only once the response has been handled.
		await waitForUi(async () => {
			await act(async () => {})
			expect(session.client.isMutating()).toBe(0)
		})

		expect(hook.settings.customInstructions).toBe('')
	})

	test('serializes saves across remount and keeps the preceding accepted value', async () => {
		let releaseFirstSave: (() => void) | null = null
		const puts: Array<unknown> = []
		session.serve({
			[SETTINGS_URL]: (_url: URL, init?: RequestInit) => {
				if (init?.method !== 'PUT') return { settings: { enableMemory: true } }
				puts.push(JSON.parse(init.body as string))
				if (puts.length === 1)
					return new Promise<Response>((resolve) => (releaseFirstSave = () => resolve(new Response(null))))
				return new Response(null, { status: 500 })
			}
		})
		await mount()
		await waitForUi(() => expect(session.requests.some((r) => r.url.href === SETTINGS_URL)).toBe(true))

		let firstSave!: Promise<boolean>
		let secondSave!: Promise<boolean>
		await act(async () => {
			firstSave = hook.saveSettings({ enableMemory: false })
		})
		await waitForUi(() => expect(puts).toHaveLength(1))
		await act(async () => root.unmount())
		root = createRoot(container)
		await mount()
		await act(async () => {
			secondSave = hook.saveSettings({ enableMemory: true })
		})
		// The second save waits behind the first instead of racing it to the server.
		expect(puts).toHaveLength(1)

		await act(async () => releaseFirstSave!())
		expect(await within(firstSave)).toBe(true)
		expect(await within(secondSave)).toBe(false)
		expect(puts).toEqual([{ settings: { enableMemory: false } }, { settings: { enableMemory: true } }])
		// The failed second save rolls back to the value the server accepted, not the pre-save default.
		expect(hook.settings.enableMemory).toBe(false)
	})

	test('ignores a settings response that predates a successful save', async () => {
		let releaseSettings: (() => void) | null = null
		session.serve({
			[SETTINGS_URL]: (_url: URL, init?: RequestInit) => {
				if (init?.method === 'PUT') return new Response(null)
				return new Promise<Response>(
					(resolve) =>
						(releaseSettings = () => resolve(Response.json({ settings: { customInstructions: 'Old instructions' } })))
				)
			}
		})
		await mount()
		await waitForUi(() => expect(releaseSettings).not.toBeNull())

		let save!: Promise<boolean>
		await act(async () => {
			save = hook.saveSettings({ customInstructions: 'New instructions' })
		})
		expect(await within(save)).toBe(true)
		await waitForUi(() => expect(hook.settings.customInstructions).toBe('New instructions'))

		// Give the stale response every chance to land before checking it did not win.
		await act(async () => {
			releaseSettings!()
			await new Promise((resolve) => setTimeout(resolve, 20))
		})

		expect(hook.settings.customInstructions).toBe('New instructions')
	})
})
