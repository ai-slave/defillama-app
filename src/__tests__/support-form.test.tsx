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

async function submitForm() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Support />
			</session.Wrapper>
		)
	)
	const openForm = [...container.querySelectorAll('button')].find((button) =>
		button.textContent?.includes('Submit a Form')
	)!
	await act(async () => openForm.click())
	const description = container.querySelector<HTMLTextAreaElement>('#support-description')!
	await act(async () => {
		description.value = 'The fees chart is empty'
	})
	await act(async () => container.querySelector('form')!.requestSubmit())
}

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
