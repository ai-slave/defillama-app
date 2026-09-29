// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
const session = installSubscriberSession('pending-user', { account: 'free', resolved: true })
import { WelcomeOnboarding } from '../WelcomeOnboarding'

vi.mock('next/router', () => ({ default: { push: vi.fn() }, useRouter: () => ({ push: vi.fn() }) }))

afterEach(() => {
	vi.useRealTimers()
})

test('stops promising automatic checks once the payment confirmation reads run out', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	try {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<WelcomeOnboarding />
				</session.Wrapper>
			)
		)
		expect(host.querySelector('h2')?.textContent).toBe('Processing your payment')
		expect(host.textContent).toContain('this page checks again automatically')
		expect(host.querySelector('[role="status"]')?.textContent).toContain('Checking your payment')

		// Six reads: one right away, then one every four seconds. Each read schedules the next on render,
		// so time advances one read per act.
		for (let read = 0; read < 6; read++) await act(() => vi.advanceTimersByTimeAsync(4000))
		const statusReads = session.urls().filter((url) => url.endsWith('/subscription/status'))
		expect(statusReads).toHaveLength(6)
		expect(host.textContent).toContain('Refresh the page to check again.')
		expect(host.textContent).not.toContain('automatically')
		expect(host.querySelector('[role="status"]')).toBeNull()
	} finally {
		await act(async () => root.unmount())
		host.remove()
	}
})
