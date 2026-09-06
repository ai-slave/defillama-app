// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BasicLink } from './Link'

const mocks = vi.hoisted(() => ({ trackUmamiEvent: vi.fn() }))

vi.mock('next/link', () => ({
	default: ({
		children,
		href,
		prefetch: _prefetch,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
		<a href={href} {...props}>
			{children}
		</a>
	)
}))

vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: mocks.trackUmamiEvent }))

describe('BasicLink umami events', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.trackUmamiEvent.mockReset()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('tracks an internal event without rendering Umami attributes', async () => {
		await act(async () =>
			root.render(
				<BasicLink href="/ai" data-umami-event="llamaai-nav-link" data-umami-event-subscribed="true">
					Ask LlamaAI
				</BasicLink>
			)
		)

		const link = container.querySelector('a')
		expect(link).toHaveProperty('href', 'http://localhost:3000/ai')
		expect(link?.getAttribute('data-umami-event')).toBeNull()
		expect(link?.getAttribute('data-umami-event-subscribed')).toBeNull()

		await act(async () => link?.click())

		expect(mocks.trackUmamiEvent).toHaveBeenCalledWith('llamaai-nav-link', { subscribed: 'true' })
	})

	test('leaves ordinary internal links untracked', async () => {
		await act(async () => root.render(<BasicLink href="/ai">Ask LlamaAI</BasicLink>))

		await act(async () => container.querySelector('a')?.click())

		expect(mocks.trackUmamiEvent).not.toHaveBeenCalled()
	})
})
