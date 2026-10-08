// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import { ResearchFooter } from '~/containers/Articles/landing/ResearchFooter'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'

const fixtures = installFixtureFetch()

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	window.umami = undefined
})

test('counts a sent media kit without sending the reader email to analytics', async () => {
	fixtures.serve({ [`${AUTH_SERVER}/newsletter/subscribe`]: { ok: true } })
	const umami = { identify: vi.fn(), track: vi.fn() }
	window.umami = umami
	const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
	await act(async () =>
		root.render(
			<QueryClientProvider client={queryClient}>
				<ResearchFooter />
			</QueryClientProvider>
		)
	)

	const input = container.querySelector<HTMLInputElement>('input[aria-label="Email address"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, ' reader@example.com ')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => input.form!.requestSubmit())

	await waitForUi(() => expect(container.querySelector('button[type="submit"]')!.textContent).toBe('Sent'))
	expect(umami.track.mock.calls).toEqual([['research-media-kit-email-sent', undefined]])
})
