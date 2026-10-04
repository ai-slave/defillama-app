// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'

const router = vi.hoisted(() => ({
	query: {},
	pathname: '/ai',
	asPath: '/ai',
	isReady: true,
	push: async () => true,
	replace: async () => true,
	prefetch: async () => {},
	events: { on: () => {}, off: () => {} }
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
import LlamaAIGetStarted from '~/pages/ai'

const session = installSubscriberSession('reader', { account: 'signed-out', resolved: true })
let root: Root

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<LlamaAIGetStarted />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
	vi.useRealTimers()
})

const dots = () => [...document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Show example"]')]
const currentDot = () =>
	dots()
		.find((dot) => dot.getAttribute('aria-current') === 'true')
		?.getAttribute('aria-label')

test('the example showcase marks its current example and holds it while hovered or focused', async () => {
	expect(currentDot()).toBe('Show example 1')
	await act(async () => vi.advanceTimersByTime(6200))
	expect(currentDot()).toBe('Show example 2')

	const showcase = dots()[0].closest('div')!.parentElement!
	await act(async () => showcase.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
	await act(async () => vi.advanceTimersByTime(12_000))
	expect(currentDot()).toBe('Show example 2')
	await act(async () => showcase.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))

	await act(async () => dots()[0].focus())
	await act(async () => vi.advanceTimersByTime(12_000))
	expect(currentDot()).toBe('Show example 2')
	await act(async () => dots()[0].blur())
	await act(async () => vi.advanceTimersByTime(6200))
	expect(currentDot()).toBe('Show example 3')
})
