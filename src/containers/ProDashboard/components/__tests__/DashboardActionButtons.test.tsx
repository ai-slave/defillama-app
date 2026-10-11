// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { Dashboard } from '../../dashboardTypes'
import { DashboardError } from '../../services/DashboardAPI'
import { CopyDashboardButton, EditDoneButton, UndoAIGenerationButton } from '../DashboardActionButtons'
import { Rating } from '../Rating'

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
	push.mockReset().mockResolvedValue(true)
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
// A pending Button keeps its idle label in the DOM, aria-hidden, to hold its width; the name is the visible text.
function visibleText(el: Element) {
	const clone = el.cloneNode(true) as Element
	for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
	return clone.textContent?.trim()
}
function button(name: string) {
	return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => visibleText(el) === name || el.getAttribute('aria-label') === name
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
	await waitForUi(() => expect(button('Copying…').getAttribute('aria-disabled')).toBe('true'))
	expect(document.activeElement).toBe(button('Copying…'))
	await click('Copying…')
	expect(copy).toHaveBeenCalledOnce()
	await act(async () => pending.reject(new TypeError('Failed to fetch')))
	await waitForUi(() => expect(container.querySelector('[role="alert"]')).not.toBeNull())
	expect(container.querySelector('[role="alert"]')!.textContent).not.toContain('Failed to fetch')
	expect(push).not.toHaveBeenCalled()
	await click('Copy Dashboard')
	await waitForUi(() => expect(push).toHaveBeenCalledExactlyOnceWith('/pro/copied-analysis'))
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
	await waitForUi(() => expect(button('Copying…').getAttribute('aria-disabled')).toBe('true'))
	expect(copy).toHaveBeenCalledOnce()
	await render(<CopyDashboardButton key="another-source" onCopy={copy} />)
	await act(async () => pending.resolve(copied))
	await waitForUi(() => expect(client.isMutating()).toBe(0))
	expect(push).not.toHaveBeenCalled()
	expect(button('Copy Dashboard').getAttribute('aria-disabled')).not.toBe('true')
})
test('undo blocks another request while pending and keeps failure beside the retry action', async () => {
	const pending = Promise.withResolvers<void>()
	const undo = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
	await render(<UndoAIGenerationButton onUndo={undo} />)
	await click('Undo AI changes')
	await waitForUi(() => expect(button('Undoing…').getAttribute('aria-disabled')).toBe('true'))
	await click('Undoing…')
	expect(undo).toHaveBeenCalledOnce()
	await act(async () => pending.reject(new DashboardError('Read-only', 403, 'This dashboard is read-only.')))
	await waitForUi(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toBe('This dashboard is read-only.')
	)
	await click('Undo AI changes')
	await waitForUi(() => expect(undo).toHaveBeenCalledTimes(2))
	await waitForUi(() => {
		expect(container.querySelector('[role="alert"]')).toBeNull()
		expect(button('Undo AI changes').textContent).toBe('Undo AI changes')
		expect(button('Undo AI changes').getAttribute('aria-disabled')).not.toBe('true')
	})
})
// Skip shows its pending label while either action runs; the icon-only Dismiss keeps its aria-label.
test.each([
	['Skip', 'Skipping…'],
	['Dismiss rating', 'Dismiss rating']
])('%s blocks all rating actions and failure preserves feedback for retry', async (action, pendingName) => {
	const pending = Promise.withResolvers<void>()
	const submit = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
	await render(<Rating sessionId="first" mode="create" onSubmit={submit} />)
	await act(async () => container.querySelector<HTMLInputElement>('[aria-label="4 stars"]')!.click())
	container.querySelector('textarea')!.value = 'Keep this feedback'
	button(action).focus()
	await click(action)
	await waitForUi(() => expect(button(pendingName).getAttribute('aria-disabled')).toBe('true'))
	expect(document.activeElement).toBe(button(pendingName))
	await click('Submit Rating')
	await click('Skipping…')
	await click('Dismiss rating')
	expect(submit).toHaveBeenCalledExactlyOnceWith('first', { skipped: true })
	await act(async () => pending.reject(new TypeError('Failed to fetch')))
	await waitForUi(() => expect(container.querySelector('[role="alert"]')).not.toBeNull())
	expect(container.querySelector('[role="alert"]')!.textContent).not.toContain('Failed to fetch')
	expect(container.querySelector('textarea')!.value).toBe('Keep this feedback')
	await click('Submit Rating')
	await waitForUi(() => expect(submit).toHaveBeenLastCalledWith('first', { rating: 4, feedback: 'Keep this feedback' }))
	await render(<Rating sessionId="second" mode="iterate" onSubmit={submit} />)
	expect(container.querySelector('textarea')).toBeNull()
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect([...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].some((el) => el.checked)).toBe(false)
})

test('opening the editor blocks repeated navigation and exposes a retry after failure', async () => {
	const route = Promise.withResolvers<boolean>()
	push.mockReturnValueOnce(route.promise).mockResolvedValueOnce(true)
	await render(<EditDoneButton editing={false} href="/pro/example/edit" onDone={vi.fn()} refreshingSql={false} />)
	button('Edit').focus()
	await click('Edit')
	await waitForUi(() => expect(button('Opening editor…')?.getAttribute('aria-disabled')).toBe('true'))
	expect(document.activeElement).toBe(button('Opening editor…'))
	await click('Opening editor…')
	expect(push).toHaveBeenCalledExactlyOnceWith('/pro/example/edit', undefined, { shallow: true })
	await act(async () => route.reject(new Error('Offline')))
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
	await click('Edit')
	await waitForUi(() => expect(push).toHaveBeenCalledTimes(2))
	await waitForUi(() => {
		expect(container.querySelector('[role="alert"]')).toBeNull()
		expect(button('Edit')?.textContent).toBe('Edit')
		expect(button('Edit').getAttribute('aria-disabled')).not.toBe('true')
	})
})

test('a copied dashboard remains reachable when navigation fails without creating another copy', async () => {
	const copy = vi.fn().mockResolvedValue(copied)
	push.mockRejectedValueOnce(new Error('Route unavailable'))
	await render(<CopyDashboardButton onCopy={copy} />)
	await click('Copy Dashboard')
	await waitForUi(() =>
		expect(container.querySelector('a[href="/pro/copied-analysis"]')?.textContent).toBe('Open copy')
	)
	await click('Copied')
	expect(copy).toHaveBeenCalledOnce()
})

// The control leaves once its request settles, the way the dashboard page drops it.
function LeavesWhenDone({ control }: { control: (done: () => Promise<void>) => ReactNode }) {
	const [shown, setShown] = useState(true)
	return shown ? control(async () => setShown(false)) : null
}

async function renderUntilDone(control: (done: () => Promise<void>) => ReactNode) {
	const main = document.createElement('main')
	document.body.append(main)
	main.append(container)
	await render(<LeavesWhenDone control={control} />)
	return main
}

test('a skipped rating banner hands focus to the page as it leaves', async () => {
	const main = await renderUntilDone((done) => <Rating sessionId="r" mode="create" onSubmit={done} />)
	button('Skip').focus()
	await click('Skip')
	await waitForUi(() => expect(document.activeElement).toBe(main))
	main.remove()
})

test('a finished undo hands focus to the page as it leaves', async () => {
	const main = await renderUntilDone((done) => <UndoAIGenerationButton onUndo={done} />)
	button('Undo AI changes').focus()
	await click('Undo AI changes')
	await waitForUi(() => expect(document.activeElement).toBe(main))
	main.remove()
})
