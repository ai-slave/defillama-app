// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AlertIntent } from '~/containers/LlamaAI/types'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AlertArtifact } from '../AlertArtifact'

// The schedule and Slack pickers are Selects, which read the router.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/ai/chat' }) }))

const session = installSubscriberSession('reader', { resolved: true })
const AI = 'https://ai.llama.fi'
const intent: AlertIntent = {
	detected: true,
	frequency: 'daily',
	hour: 9,
	deliveryChannel: 'email',
	toolExecutions: []
}
let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	session.serve({
		[`${AI}/telegram/status`]: { link: { state: 'unlinked' }, pending: null },
		[`${AI}/slack/workspaces`]: { workspaces: [] }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render(savedAlertIds?: Array<string>, alertIntent = intent) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AlertArtifact
					alertId="alert"
					alertIntent={alertIntent}
					messageId="message"
					savedAlertIds={savedAlertIds}
					defaultTitle="Daily TVL"
				/>
			</session.Wrapper>
		)
	)
}
const buttonNamed = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)
async function press(button: HTMLElement) {
	await act(async () => {
		button.focus()
		button.click()
	})
}

test('Save alert keeps focus while it saves, then hands it to the saved status', async () => {
	const saved = Promise.withResolvers<Response>()
	session.serve({
		[`${AI}/alerts`]: () => saved.promise,
		[`${AI}/alerts/alert`]: { alert: { test_sent: false } }
	})
	await render()
	await press(buttonNamed('Save alert')!)
	await waitForUi(() => expect(buttonNamed('Saving…')).toBeDefined())
	const save = buttonNamed('Saving…')!
	expect(save.disabled).toBe(false)
	expect(save.getAttribute('aria-disabled')).toBe('true')
	expect(document.activeElement).toBe(save)
	await act(async () => saved.resolve(Response.json({ id: 'alert', nextRunAt: null })))
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Alert saved'))
})

test('a test send hands focus from its button to its progress, then to the outcome', async () => {
	const sent = Promise.withResolvers<Response>()
	session.serve({
		[`${AI}/alerts/alert/test`]: () => sent.promise,
		[`${AI}/alerts/alert`]: { alert: { test_sent: false } }
	})
	await render(['alert'])
	await waitForUi(() => expect(buttonNamed('Send test alert')?.disabled).toBe(false))
	await press(buttonNamed('Send test alert')!)
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Sending test alert…'))
	await act(async () => sent.resolve(Response.json({ success: true })))
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Test sent! Check your inbox'))
})

test('a failed test send focuses Try again, and a failed retry focuses its error', async () => {
	session.serve({
		[`${AI}/alerts/alert/test`]: () => new Response(null, { status: 500 }),
		[`${AI}/alerts/alert`]: { alert: { test_sent: false } }
	})
	await render(['alert'])
	await waitForUi(() => expect(buttonNamed('Send test alert')?.disabled).toBe(false))
	await press(buttonNamed('Send test alert')!)
	await waitForUi(() => expect(document.activeElement).toBe(buttonNamed('Try again')))
	await press(buttonNamed('Try again')!)
	await waitForUi(() => expect(buttonNamed('Try again')).toBeUndefined())
	await waitForUi(() => expect(document.activeElement?.querySelector('[role="alert"]')).not.toBeNull())
	expect(document.activeElement?.textContent).not.toContain('500')
})

test('a card saved in an earlier visit shows its earlier test without taking focus', async () => {
	session.serve({ [`${AI}/alerts/alert`]: { alert: { test_sent: true } } })
	await render(['alert'])
	await waitForUi(() => expect(document.body.textContent).toContain('Test already sent for this alert'))
	expect(document.activeElement).toBe(document.body)
})

test('Save alert with no Slack channel picked focuses the channel picker, not the delivery channel toggle', async () => {
	session.serve({
		[`${AI}/slack/workspaces`]: {
			workspaces: [
				{ team_id: 'T1', team_name: 'Llama Research', default_channel_id: null, revoked: false },
				{ team_id: 'T2', team_name: 'Llama Ops', default_channel_id: null, revoked: false }
			]
		},
		[`${AI}/slack/channels?team_id=T1`]: { channels: [{ id: 'C1', name: 'alerts', is_private: false }] }
	})
	await render(undefined, { ...intent, deliveryChannel: 'slack', slackTeamId: 'T1' })
	const channel = await waitForUi(() => {
		const picker = document.querySelector<HTMLButtonElement>('[aria-label="Slack channel"]')
		expect(picker).not.toBeNull()
		return picker!
	})
	await press(buttonNamed('Save alert')!)
	expect(document.activeElement).toBe(channel)
	expect(channel.getAttribute('aria-invalid')).toBe('true')
	expect(
		document.querySelector<HTMLButtonElement>('[aria-label="Slack workspace"]')!.getAttribute('aria-invalid')
	).toBeNull()
	expect(fieldErrorTexts()).toHaveLength(1)
})
