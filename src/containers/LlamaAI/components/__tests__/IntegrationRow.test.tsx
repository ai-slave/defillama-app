// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { IntegrationRow } from '~/containers/LlamaAI/components/IntegrationRow'
import { getTelegramStatusQueryKey } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts, fieldErrorOf } from '~/utils/testing/fieldErrors'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const session = installSubscriberSession('reader')
const TELEGRAM_LINK = 'https://ai.llama.fi/telegram/link'
const linked: TelegramStatus = {
	link: { state: 'linked', telegramUsername: 'llamafan', linkedAt: '2026-09-01T00:00:00.000Z' },
	pending: null
}

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<IntegrationRow kind="telegram" title="Telegram" description="Chat in Telegram." initialStatus={linked} />
			</session.Wrapper>
		)
	)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

const button = (name: string, within: ParentNode = document) =>
	[...within.querySelectorAll<HTMLButtonElement>('button')].find((node) => accessibleName(node) === name)
const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]')
const unlinkRequests = () =>
	session.requests.filter((request) => request.url.href === TELEGRAM_LINK && request.init?.method === 'DELETE').length

test('Disconnect asks first, keeps its progress and error in the confirmation, and closes once unlinked', async () => {
	const firstUnlink = Promise.withResolvers<Response>()
	const retriedUnlink = Promise.withResolvers<Response>()
	let unlinks = 0
	session.serve({ [TELEGRAM_LINK]: () => (++unlinks === 1 ? firstUnlink.promise : retriedUnlink.promise) })

	await act(async () => button('Disconnect')!.click())
	await waitForUi(() => expect(confirmation()?.textContent).toContain('LlamaAI stops chatting with @llamafan'))
	expect(unlinkRequests()).toBe(0)

	await act(async () => button('Disconnect', confirmation()!)!.click())
	await waitForUi(() => expect(button('Disconnecting…', confirmation()!)).toBeDefined())
	await act(async () => firstUnlink.resolve(new Response('offline', { status: 503 })))
	await waitForUi(() => expect(alertTexts(confirmation()!)).toHaveLength(1))

	await act(async () => button('Disconnect', confirmation()!)!.click())
	await waitForUi(() => expect(button('Disconnecting…', confirmation()!)).toBeDefined())
	await act(async () => retriedUnlink.resolve(Response.json({ unlinked: true })))
	await waitForUi(() => expect(confirmation()).toBeNull())
	expect(button('Connect')).toBeDefined()
	expect(unlinkRequests()).toBe(2)
})

const TELEGRAM = 'https://ai.llama.fi/telegram'
const unlinked: TelegramStatus = { link: { state: 'unlinked' }, pending: null }
async function press(element: HTMLElement) {
	await act(async () => {
		element.focus()
		element.click()
	})
}
async function renderRow(props: { initialStatus: TelegramStatus; initialTgloginToken?: string }) {
	session.client.setQueryData(getTelegramStatusQueryKey('reader'), props.initialStatus)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<IntegrationRow kind="telegram" title="Telegram" description="Chat in Telegram." {...props} />
			</session.Wrapper>
		)
	)
}

test('a confirmed disconnect hands focus to Connect', async () => {
	session.serve({ [TELEGRAM_LINK]: () => Response.json({ unlinked: true }) })
	await press(button('Disconnect')!)
	await waitForUi(() => expect(confirmation()).not.toBeNull())
	await press(button('Disconnect', confirmation()!)!)
	await waitForUi(() => expect(confirmation()).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(button('Connect')))
})

test('Connect hands focus to the Telegram link that replaces it', async () => {
	vi.spyOn(window, 'open').mockReturnValue(null)
	session.serve({
		[`${TELEGRAM}/status`]: unlinked,
		[`${TELEGRAM}/link/start`]: {
			state: 'pending',
			token: 'token',
			deepLink: 'https://t.me/llama_bot?start=token',
			expiresAt: '2100-01-01T00:00:00.000Z'
		}
	})
	await renderRow({ initialStatus: unlinked })
	await press(button('Connect')!)
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('DM /start to the bot'))
})

test('the code and switch prompts hand focus to the control of the step that replaces them', async () => {
	const confirms: Array<Response> = [
		Response.json({
			status: 'requires_switch_confirmation',
			currentTelegramUsername: 'oldllama',
			expiresAt: '2100-01-01'
		})
	]
	session.serve({ [`${TELEGRAM}/status`]: unlinked, [`${TELEGRAM}/link/confirm`]: () => confirms.shift()! })
	await renderRow({ initialStatus: unlinked, initialTgloginToken: 'token' })
	const code = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(code, '123456')
		code.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await press(button('Confirm')!)
	await waitForUi(() => expect(document.activeElement).toBe(button('Yes, switch')))
	// Without a parent to consume the login token, cancelling the switch returns to its code prompt.
	await press(button('Cancel')!)
	await waitForUi(() =>
		expect(document.activeElement).toBe(document.querySelector('input[autocomplete="one-time-code"]'))
	)
})

test('a failed Switch account keeps the linked account and the button that retries it', async () => {
	session.serve({ [`${TELEGRAM}/status`]: linked })
	session.serveInOrder(`${TELEGRAM}/link/start`, [() => Response.json({ error: 'Telegram is down' }, { status: 503 })])
	await press(button('Switch account')!)
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	expect(container.textContent).toContain('Linked as @llamafan')
	expect(button('Switch account')).toBeDefined()
})

test('a Switch account retry keeps the start error on screen while it opens', async () => {
	session.serve({ [`${TELEGRAM}/status`]: linked })
	session.serveInOrder(`${TELEGRAM}/link/start`, [
		() => Response.json({ error: 'Telegram is down' }, { status: 503 }),
		() => new Promise<Response>(() => {})
	])
	const switchAccount = button('Switch account')!
	await press(switchAccount)
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	const failure = document.querySelector('[role="alert"]')!.textContent
	await press(switchAccount)

	await waitForUi(() => expect(switchAccount.textContent).toContain('Opening…'))
	expect(document.querySelector('[role="alert"]')?.textContent).toBe(failure)
})

test('Switch account keeps the linked account and waits with focus while it starts', async () => {
	session.serve({
		[`${TELEGRAM}/status`]: linked,
		[`${TELEGRAM}/link/start`]: () => new Promise<Response>(() => {})
	})
	const switchAccount = button('Switch account')!
	await press(switchAccount)
	await waitForUi(() => expect(switchAccount.textContent).toContain('Opening…'))
	expect(container.textContent).toContain('Linked as @llamafan')
	expect(document.activeElement).toBe(switchAccount)
})

async function typeCode(value: string) {
	const code = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(code, value)
		code.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('a short code says so under the field; a wrong code says so until the code is edited', async () => {
	session.serve({ [`${TELEGRAM}/status`]: unlinked })
	session.serveInOrder(`${TELEGRAM}/link/confirm`, [() => Response.json({ error: 'bad code' }, { status: 400 })])
	await renderRow({ initialStatus: unlinked, initialTgloginToken: 'token' })
	const code = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
	await typeCode('123')
	await press(button('Confirm')!)
	expect(fieldErrorOf(code)).toBe('Enter the 6-digit code from Telegram.')
	expect(document.activeElement).toBe(code)
	await typeCode('123456')
	expect(fieldErrorOf(code)).toBeNull()
	await press(button('Confirm')!)
	await waitForUi(() => expect(fieldErrorOf(code)).toBe("That code didn't work. Check it in Telegram and try again."))
	// The refusal moves focus to the code, so a screen reader reads the field with its error.
	expect(document.activeElement).toBe(code)
	await typeCode('654321')
	expect(fieldErrorOf(code)).toBeNull()
})

test('a server failure on confirm says the request failed, not that the code is wrong, and Confirm retries', async () => {
	session.serve({ [`${TELEGRAM}/status`]: unlinked })
	session.serveInOrder(`${TELEGRAM}/link/confirm`, [
		() => Response.json({ error: 'upstream down' }, { status: 503 }),
		() => Response.json({ linked: true, telegramUsername: 'llama' })
	])
	await renderRow({ initialStatus: unlinked, initialTgloginToken: 'token' })
	const code = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
	await typeCode('123456')
	await press(button('Confirm')!)
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
	expect(code.getAttribute('aria-invalid')).toBeNull()
	await press(button('Confirm')!)
	await waitForUi(() => expect(container.textContent).toContain('Linked as @llama'))
	expect(container.querySelector('[role="alert"]')).toBeNull()
})

test('a confirmed switch hands focus to the linked account', async () => {
	session.serve({ [`${TELEGRAM}/status`]: unlinked })
	session.serveInOrder(`${TELEGRAM}/link/confirm`, [
		() =>
			Response.json({
				status: 'requires_switch_confirmation',
				currentTelegramUsername: 'oldllama',
				expiresAt: '2100-01-01'
			}),
		() => Response.json({ linked: true, telegramUsername: 'newllama', switched: true })
	])
	await renderRow({ initialStatus: unlinked, initialTgloginToken: 'token' })
	await typeCode('123456')
	await press(button('Confirm')!)
	await waitForUi(() => expect(document.activeElement).toBe(button('Yes, switch')))
	await press(button('Yes, switch')!)
	await waitForUi(() => expect(container.textContent).toContain('Linked as @newllama'))
	expect(document.activeElement).toBe(button('Switch account'))
})
