// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NewsletterSignup } from './NewsletterSignup'

const mutation = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ user: { email: 'reader@example.com' } }) }))
vi.mock('~/hooks/useNewsletterSubscription', async (original) => ({
	...(await original<typeof import('~/hooks/useNewsletterSubscription')>()),
	useNewsletterSubscription: () => mutation
}))
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	mutation.mutate.mockReset()
	mutation.isPending = false
	localStorage.clear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test.each(['card', 'strip'] as const)(
	'%s allows clearing both defaults, then submits only the reselected newsletter',
	async (layout) => {
		await act(async () => root.render(<NewsletterSignup layout={layout} />))
		const choices = [...container.querySelectorAll<HTMLButtonElement>('[role="checkbox"], [role="switch"]')]
		expect(choices).toHaveLength(2)
		expect(choices.map((e) => e.getAttribute('aria-checked'))).toEqual(['true', 'true'])
		expect(mutation.mutate).not.toHaveBeenCalled()
		await act(async () => {
			for (const choice of choices) choice.click()
		})
		const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
		expect(submit.disabled).toBe(true)
		expect(choices.map((e) => e.getAttribute('aria-checked'))).toEqual(['false', 'false'])
		await act(async () => choices[1].click())
		await act(async () => submit.click())
		expect(mutation.mutate).toHaveBeenCalledExactlyOnceWith(
			{ email: 'reader@example.com', newsletters: ['research'] },
			expect.any(Object)
		)
		mutation.isPending = true
		await act(async () => root.render(<NewsletterSignup layout={layout} />))
		await act(async () => {
			choices[0].click()
			submit.click()
		})
		expect(choices[0].getAttribute('aria-checked')).toBe('false')
		expect(mutation.mutate).toHaveBeenCalledOnce()
	}
)
