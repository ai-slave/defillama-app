// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { SignInDialog } from '../SignInDialog'

vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const session = installSubscriberSession('u1', { account: 'signed-out' })
const track = installUmamiSink()
const QUESTION = 'Which chains grew the most this month?'
let root: Root

function Harness({ question }: { question?: string }) {
	const store = Ariakit.useDialogStore({ defaultOpen: true })
	return <SignInDialog store={store} prompt="Sign in to save your dashboards" question={question} />
}

async function open(variant: 'a' | 'b', question: string | null = QUESTION) {
	document.documentElement.setAttribute('data-ab-llamaai-signin-offer-v1', variant)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness question={question ?? undefined} />
			</session.Wrapper>
		)
	)
	return waitForUi(() => {
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
		expect(dialog).not.toBeNull()
		return dialog!
	})
}
const heading = (dialog: HTMLElement) => dialog.querySelector('h2, [role="heading"]')?.textContent

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
	document.documentElement.removeAttribute('data-ab-llamaai-signin-offer-v1')
	sessionStorage.clear()
})

test('B leads with Get your answer free, the welcome offer and the question', async () => {
	const dialog = await open('b')
	expect(heading(dialog)).toBe('Get your answer free')
	expect(dialog.textContent).toContain('New here? 5 free questions a day for your first week')
	expect(dialog.textContent).toContain(`“${QUESTION}”`)
	expect(dialog.textContent).not.toContain('Sign in to ask for free')
})

test('B Create an account opens sign-up and counts a signup-click', async () => {
	const dialog = await open('b')
	const create = [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Create an account')!
	await act(async () => create.click())
	await waitForUi(() => expect(heading(document.querySelector('[role="dialog"]')!)).toBe('Create an account'))
	expect(track).toHaveBeenCalledWith('experiment-action', {
		experiment: 'llamaai-signin-offer-v1',
		variant: 'b',
		metric: 'signup-click'
	})
})

test('A keeps today’s Sign in dialog and records exposure for its arm', async () => {
	const dialog = await open('a')
	expect(heading(dialog)).toBe('Sign in')
	expect(dialog.textContent).toContain(`Sign in to ask for free: “${QUESTION}”`)
	expect(dialog.textContent).not.toContain('Sign in to save your dashboards')
	expect(dialog.textContent).not.toContain('New here?')
	expect(track).toHaveBeenCalledWith('experiment-exposure', {
		experiment: 'llamaai-signin-offer-v1',
		variant: 'a'
	})
})

test('a sign-in dialog outside LlamaAI never shows the offer, even for a B visitor', async () => {
	const dialog = await open('b', null)
	expect(heading(dialog)).toBe('Sign in')
	expect(dialog.textContent).toContain('Sign in to save your dashboards')
	expect(dialog.textContent).not.toContain('New here?')
	expect(track).not.toHaveBeenCalledWith('experiment-exposure', expect.anything())
})
