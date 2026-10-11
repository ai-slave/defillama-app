// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DashboardCard } from '../DashboardCard'
import { DashboardList } from '../DashboardList'
import { Rating } from '../Rating'

vi.mock('../CardLikeButton', () => ({ CardLikeButton: () => null }))
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
	const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => accessibleName(e) === name)
	expect(el).toBeDefined()
	return el!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function clickMenuItem(name: string) {
	await waitForUi(() => {
		const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
			(e) => e.textContent?.trim() === name
		)
		expect(item).toBeDefined()
	})
	const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
		(e) => e.textContent?.trim() === name
	)
	await act(async () => item!.click())
}
function openDialog() {
	return [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')].find((e) => !e.hidden)
}

test('rating exposes one selected value and submits keyboard selection with feedback', async () => {
	const request = Promise.withResolvers<void>()
	const rate = vi.fn(() => request.promise)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Rating sessionId="rating-1" mode="create" onSubmit={rate} />
			</QueryClientProvider>
		)
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
	await waitForUi(() => expect(radios[1].checked).toBe(true))
	expect(radios.filter((e) => e.checked)).toHaveLength(1)
	expect(rate).not.toHaveBeenCalled()
	const feedback = document.querySelector('textarea')!
	feedback.value = 'Useful summary'
	await act(async () =>
		document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	expect(rate).toHaveBeenCalledExactlyOnceWith('rating-1', { rating: 2, feedback: 'Useful summary' })
	await waitForUi(() => expect(radios.every((e) => e.getAttribute('aria-disabled') === 'true')).toBe(true))
	await act(async () => request.resolve())
	expect(radios[1].checked).toBe(true)
	expect(feedback.value).toBe('Useful summary')
})

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
	await click('Actions for QA dashboard')
	await clickMenuItem('Delete…')
	await click('Delete')
	await waitForUi(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await click('Deleting…')
	expect(remove).toHaveBeenCalledExactlyOnceWith('qa')
	expect(openDialog()).toBeDefined()
	expect(button('Cancel').getAttribute('aria-disabled')).toBe('true')
	await act(async () => request.reject(new TypeError('Failed to fetch')))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	expect(document.querySelector('[role="alert"]')!.textContent).not.toContain('Failed to fetch')
	await click('Delete')
	await waitForUi(() => expect(openDialog()).toBeUndefined())
	expect(remove).toHaveBeenCalledTimes(2)
})

test('deleting the last dashboard hands focus to the page content', async () => {
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
				<main>
					<Harness />
				</main>
			</QueryClientProvider>
		)
	)
	await click('Actions for QA dashboard')
	await clickMenuItem('Delete…')
	await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Delete')
	await waitForUi(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await act(async () => request.resolve())
	await waitForUi(() => expect(document.activeElement?.tagName).toBe('MAIN'))
	expect(button('Create dashboard')).toBeDefined()
	expect(openDialog()).toBeUndefined()
})
