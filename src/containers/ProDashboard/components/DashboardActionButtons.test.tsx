// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Dashboard } from '../dashboardTypes'
import { CopyDashboardButton, UndoAIGenerationButton } from './DashboardActionButtons'
import { Rating } from './Rating'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/router', () => ({ useRouter: () => ({ push }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
const copied: Dashboard = {
	id: 'copy',
	slug: 'copied-analysis',
	data: { dashboardName: 'Copy', items: [] },
	created: '',
	updated: ''
}
beforeEach(() => {
	vi.clearAllMocks()
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
async function render(node: ReactNode) {
	await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>))
}
function button(name: string) {
	return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.textContent?.trim() === name || el.getAttribute('aria-label') === name
	)!
}
async function click(name: string) {
	await act(async () => button(name).click())
}

test('copy blocks repeated activation, exposes failure, and navigates after a successful retry', async () => {
	const pending = Promise.withResolvers<Dashboard>()
	const copy = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(copied)
	await render(<CopyDashboardButton onCopy={copy} />)
	button('Copy Dashboard').focus()
	await click('Copy Dashboard')
	await vi.waitFor(() => expect(button('Copying…').getAttribute('aria-disabled')).toBe('true'))
	expect(document.activeElement).toBe(button('Copying…'))
	await click('Copying…')
	expect(copy).toHaveBeenCalledOnce()
	await act(async () => pending.reject(new Error('Copy unavailable')))
	await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('Copy unavailable'))
	expect(push).not.toHaveBeenCalled()
	await click('Copy Dashboard')
	await vi.waitFor(() => expect(push).toHaveBeenCalledExactlyOnceWith('/pro/copied-analysis'))
})
test('copy respects the dashboard limit and cannot navigate after its source page is replaced', async () => {
	const pending = Promise.withResolvers<Dashboard>()
	const copy = vi.fn(() => pending.promise)
	const limit = vi.fn()
	await render(<CopyDashboardButton key="source" onCopy={copy} onLimitReached={limit} />)
	await click('Copy Dashboard')
	expect(limit).toHaveBeenCalledOnce()
	expect(copy).not.toHaveBeenCalled()
	await render(<CopyDashboardButton key="source" onCopy={copy} />)
	await click('Copy Dashboard')
	await render(<CopyDashboardButton key="another-source" onCopy={copy} />)
	await act(async () => pending.resolve(copied))
	await vi.waitFor(() => expect(client.isMutating()).toBe(0))
	expect(push).not.toHaveBeenCalled()
	expect(button('Copy Dashboard').getAttribute('aria-disabled')).not.toBe('true')
})
test('undo blocks another request while pending and keeps failure beside the retry action', async () => {
	const pending = Promise.withResolvers<void>()
	const undo = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
	await render(<UndoAIGenerationButton onUndo={undo} />)
	await click('Undo AI changes')
	await vi.waitFor(() => expect(button('Undo AI changes').getAttribute('aria-disabled')).toBe('true'))
	await click('Undo AI changes')
	expect(undo).toHaveBeenCalledOnce()
	await act(async () => pending.reject(new Error('Undo unavailable')))
	await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('Undo unavailable'))
	await click('Undo AI changes')
	await vi.waitFor(() => expect(undo).toHaveBeenCalledTimes(2))
})
test.each(['Skip', 'Dismiss rating'])(
	'%s blocks all rating actions and failure preserves feedback for retry',
	async (action) => {
		const pending = Promise.withResolvers<void>()
		const submit = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
		await render(<Rating sessionId="first" mode="create" variant="banner" onSubmit={submit} />)
		await act(async () => container.querySelector<HTMLInputElement>('[aria-label="4 stars"]')!.click())
		container.querySelector('textarea')!.value = 'Keep this feedback'
		button(action).focus()
		await click(action)
		await vi.waitFor(() => expect(button(action).getAttribute('aria-disabled')).toBe('true'))
		expect(document.activeElement).toBe(button(action))
		await click('Submit Rating')
		await click('Skip')
		await click('Dismiss rating')
		expect(submit).toHaveBeenCalledExactlyOnceWith('first', { skipped: true })
		await act(async () => pending.reject(new Error('Rating unavailable')))
		await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('Rating unavailable'))
		expect(container.querySelector('textarea')!.value).toBe('Keep this feedback')
		await click('Submit Rating')
		await vi.waitFor(() =>
			expect(submit).toHaveBeenLastCalledWith('first', { rating: 4, feedback: 'Keep this feedback' })
		)
		await render(<Rating sessionId="second" mode="iterate" variant="banner" onSubmit={submit} />)
		expect(container.querySelector('textarea')).toBeNull()
		expect(container.querySelector('[role="alert"]')).toBeNull()
		expect([...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].some((el) => el.checked)).toBe(
			false
		)
	}
)
