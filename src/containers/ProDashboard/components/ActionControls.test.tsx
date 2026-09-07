// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ConfirmationModal } from './ConfirmationModal'
import { DashboardCard } from './DashboardCard'
import { DashboardList } from './DashboardList'
import { Rating } from './Rating'

vi.mock('./CardLikeButton', () => ({ CardLikeButton: () => null }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	client = new QueryClient()
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
function button(name: string) {
	const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(e) => e.getAttribute('aria-label') === name || e.textContent?.trim() === name
	)
	expect(el).toBeDefined()
	return el!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
function openDialog() {
	return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((e) => !e.hidden)
}

test.each(['banner', 'inline'] as const)(
	'%s rating exposes one selected value and submits keyboard selection with feedback',
	async (variant) => {
		const request = Promise.withResolvers<void>()
		const rate = vi.fn(() => request.promise)
		await act(async () =>
			root.render(<Rating sessionId="rating-1" mode="create" variant={variant} onRate={rate} onSkip={vi.fn()} />)
		)
		const radios = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
		expect(radios.map((e) => e.getAttribute('aria-label'))).toEqual([
			'1 star',
			'2 stars',
			'3 stars',
			'4 stars',
			'5 stars'
		])
		expect(radios.some((e) => e.checked)).toBe(false)
		expect(rate).not.toHaveBeenCalled()
		await act(async () => {
			radios[0].click()
			radios[0].focus()
			radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
		})
		await vi.waitFor(() => expect(radios[1].checked).toBe(true))
		expect(radios.filter((e) => e.checked)).toHaveLength(1)
		expect(rate).not.toHaveBeenCalled()
		const feedback = document.querySelector('textarea')!
		feedback.value = 'Useful summary'
		await act(async () =>
			document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
		)
		expect(rate).toHaveBeenCalledExactlyOnceWith('rating-1', 2, 'Useful summary')
		expect(radios.every((e) => e.disabled)).toBe(true)
		await act(async () => request.resolve())
		expect(radios[1].checked).toBe(true)
		expect(feedback.value).toBe('Useful summary')
	}
)

test('dashboard deletion stays pending in the confirmation and retries failures without closing', async () => {
	const request = Promise.withResolvers<void>()
	const remove = vi.fn().mockReturnValueOnce(request.promise).mockResolvedValueOnce(undefined)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<DashboardCard
					dashboard={{
						id: 'qa',
						data: { items: [], dashboardName: 'QA dashboard' },
						created: '2026-09-07',
						updated: '2026-09-07'
					}}
					onDelete={remove}
				/>
			</QueryClientProvider>
		)
	)
	await click('Delete dashboard')
	await click('Delete')
	await vi.waitFor(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await click('Deleting…')
	expect(remove).toHaveBeenCalledExactlyOnceWith('qa')
	expect(openDialog()).toBeDefined()
	expect(button('Cancel').disabled).toBe(true)
	await act(async () => request.reject(new Error('Deletion failed')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Deletion failed'))
	await click('Delete')
	await vi.waitFor(() => expect(openDialog()).toBeUndefined())
	expect(remove).toHaveBeenCalledTimes(2)
})

test('synchronous widget confirmation still closes immediately', async () => {
	const confirm = vi.fn()
	function Harness() {
		const [open, setOpen] = useState(true)
		return (
			<ConfirmationModal isOpen={open} onClose={() => setOpen(false)} onConfirm={confirm} confirmText="Duplicate" />
		)
	}
	await act(async () => root.render(<Harness />))
	await click('Duplicate')
	expect(confirm).toHaveBeenCalledOnce()
	expect(openDialog()).toBeUndefined()
})

test('deleting the last dashboard returns focus to the surviving list', async () => {
	const request = Promise.withResolvers<void>()
	function Harness() {
		const [dashboards, setDashboards] = useState([
			{ id: 'qa', data: { items: [], dashboardName: 'QA dashboard' }, created: '2026-09-07', updated: '2026-09-07' }
		])
		return (
			<DashboardList
				dashboards={dashboards}
				isLoading={false}
				onCreateNew={vi.fn()}
				onDeleteDashboard={async () => {
					await request.promise
					setDashboards([])
				}}
			/>
		)
	}
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
	await click('Delete dashboard')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Delete')
	await vi.waitFor(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await act(async () => request.resolve())
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Your dashboards'))
	expect(button('Create Dashboard')).toBeDefined()
	expect(openDialog()).toBeUndefined()
})
