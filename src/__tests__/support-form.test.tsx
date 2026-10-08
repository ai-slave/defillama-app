// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Support from '~/pages/support'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

// Page chrome is a heavy child this test asserts nothing about.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('next/script', () => ({ default: () => null }))

const session = installSubscriberSession('user-1', { account: 'signed-out' })
const REPORT_URL = 'https://api.llama.fi/reportSupport'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function openForm() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Support />
			</session.Wrapper>
		)
	)
	const formToggle = [...container.querySelectorAll('button')].find((button) =>
		button.textContent?.includes('Submit a Form')
	)!
	await act(async () => formToggle.click())
}

async function type(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')!.set!.call(control, value)
		control.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function submitForm() {
	await openForm()
	await type(container.querySelector('textarea')!, 'The fees chart is empty')
	await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
}

const errorTexts = () => [...container.querySelectorAll('.text-error')].map((element) => element.textContent)

test('a request without a description or with a malformed email says so under the fields and sends nothing', async () => {
	session.serve({ [REPORT_URL]: { message: 'success' } })
	await openForm()
	const email = container.querySelector<HTMLInputElement>('input[type="email"]')!
	const description = container.querySelector('textarea')!
	await type(email, 'reader@example')
	await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())

	expect(errorTexts()).toEqual(['Enter a valid email address.', 'Enter a description of the issue.'])
	expect(document.activeElement).toBe(email)
	await type(email, '')
	await type(description, 'The fees chart is empty')
	expect(errorTexts()).toEqual([])
	expect(session.requests.filter((request) => request.url.href === REPORT_URL)).toHaveLength(0)
})

test('a request the API rejects keeps the form and says so inline', async () => {
	session.serve({ [REPORT_URL]: { message: 'error' } })
	await submitForm()

	await waitForUi(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toBe(
			"Your request didn't send. Try again, or email support@defillama.com."
		)
	)
	expect(container.querySelector('form')).not.toBeNull()
})

test('an accepted request replaces the form with the confirmation', async () => {
	session.serve({ [REPORT_URL]: { message: 'success' } })
	await submitForm()

	await waitForUi(() => expect(container.querySelector('h2')?.textContent).toBe('Request sent'))
	expect(container.querySelector('form')).toBeNull()
})
