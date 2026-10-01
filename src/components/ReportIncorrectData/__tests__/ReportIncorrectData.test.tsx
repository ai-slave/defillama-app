// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast, { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ReportIncorrectData, type ReportSubject } from '..'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))
vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.resetAllMocks()
	mocks.fetchJson.mockResolvedValue({ message: 'success' })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	// react-hot-toast keeps toasts in a module store that outlives the Toaster.
	toast.remove()
	document.body.innerHTML = ''
})

async function openReport(subject: ReportSubject) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<ReportIncorrectData subject={subject} />
			</QueryClientProvider>
		)
	)
	const trigger = Array.from(document.querySelectorAll('button')).find(
		(button) => button.textContent?.trim() === 'Report incorrect data'
	)
	expect(trigger).toBeDefined()
	await act(async () => trigger?.click())
}

async function submitReport(dataType: string) {
	const form = document.querySelector('form')
	const select = form?.elements.namedItem('dataType') as HTMLSelectElement | null
	const message = form?.elements.namedItem('message') as HTMLTextAreaElement | null
	expect(form).not.toBeNull()
	expect(select).not.toBeNull()
	expect(message).not.toBeNull()
	select!.value = dataType
	message!.value = 'Incorrect value'
	await act(async () => form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	return JSON.parse(mocks.fetchJson.mock.calls[0][1].body)
}

describe('ReportIncorrectData', () => {
	test('shows exchange fields and submits the canonical exchange subject', async () => {
		await openReport({ type: 'exchange', name: 'Binance.US', slug: 'binance-us' })

		expect(document.body.textContent).toContain('Exchange')
		expect(document.body.textContent).toContain('Open Interest')
		const payload = await submitReport('Open Interest')

		expect(payload.subject).toEqual({ type: 'exchange', name: 'Binance.US', slug: 'binance-us' })
		expect(payload.dataType).toBe('Open Interest')
		expect(payload).not.toHaveProperty('protocol')
	})

	test('preserves protocol choices without sending the lending presentation hint', async () => {
		await openReport({ type: 'protocol', name: 'Aave', isLending: true })

		expect(document.body.textContent).toContain('Protocol')
		expect(document.body.textContent).toContain('For lending protocols, TVL doesn’t include active loans by default.')
		expect(document.body.textContent).toContain('TVL')
		const payload = await submitReport('TVL')

		expect(payload.protocol).toBe('Aave')
		expect(payload).not.toHaveProperty('subject')
	})
})

async function waitForPending() {
	await waitForUi(() => expect(document.querySelector('textarea')?.readOnly).toBe(true))
}

async function clickReportButton(name: string) {
	const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name
	)!
	await act(async () => button.click())
}

test('failed reports retain the draft for retry but reopening starts without the old error', async () => {
	mocks.fetchJson.mockRejectedValueOnce(new Error('Offline'))
	await openReport({ type: 'protocol', name: 'Aave', isLending: false })
	await submitReport('TVL')
	await waitForUi(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toBe('Couldn’t send the report. Try again.')
	)
	expect(document.querySelector('textarea')?.value).toBe('Incorrect value')
	await clickReportButton('Close dialog')
	await clickReportButton('Report incorrect data')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(document.querySelector('textarea')?.value).toBe('')
	await submitReport('Fees')
	expect(JSON.parse(mocks.fetchJson.mock.calls[1][1].body)).toEqual({
		protocol: 'Aave',
		dataType: 'Fees',
		message: 'Incorrect value',
		correctSource: '',
		contact: ''
	})
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Report sent'))
})

test('a pending report locks the dialog until it settles, then shows the outcome step', async () => {
	const request = Promise.withResolvers<{ message: string }>()
	mocks.fetchJson.mockReturnValueOnce(request.promise)
	await openReport({ type: 'protocol', name: 'Aave', isLending: false })
	await submitReport('TVL')
	await waitForPending()
	const dialog = document.querySelector('[role="dialog"]')!

	await act(async () =>
		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
	expect(document.querySelector('form')).not.toBeNull()
	await clickReportButton('Close dialog')
	await clickReportButton('Cancel')
	expect(document.querySelector('form')).not.toBeNull()
	expect(mocks.fetchJson).toHaveBeenCalledTimes(1)

	await act(async () => request.resolve({ message: 'success' }))
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Report sent'))
	expect(document.querySelector('form')).toBeNull()

	await clickReportButton('Done')
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	await clickReportButton('Report incorrect data')
	expect(document.querySelector('textarea')?.value).toBe('')
})

test.each(['dataType', 'contact', 'submit-btn'])(
	'pending submission from %s preserves focus and the selected metric',
	async (focusedField) => {
		const request = Promise.withResolvers<{ message: string }>()
		mocks.fetchJson.mockReturnValueOnce(request.promise)
		await openReport({ type: 'protocol', name: 'Aave', isLending: false })
		const form = document.querySelector('form')!
		const focusedControl = form.elements.namedItem(focusedField) as HTMLElement
		await act(async () => focusedControl.focus())
		const payload = await submitReport('Fees')
		await waitForPending()

		expect(payload).toEqual({
			protocol: 'Aave',
			dataType: 'Fees',
			message: 'Incorrect value',
			correctSource: '',
			contact: ''
		})
		const pendingFocus = form.elements.namedItem(focusedField === 'dataType' ? 'submit-btn' : focusedField)
		expect(document.activeElement).toBe(pendingFocus)
		expect(document.querySelector('button[type="submit"]')?.getAttribute('aria-disabled')).toBe('true')
		expect(document.querySelector('select')?.disabled).toBe(true)
		expect(document.querySelector('button[type="submit"]')?.textContent).toContain('Sending…')

		await act(async () => request.reject(new Error('Offline')))
		await waitForUi(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toBe('Couldn’t send the report. Try again.')
		)
		expect(document.activeElement).toBe(pendingFocus)
		expect(document.querySelector('select')?.disabled).toBe(false)
		expect(document.querySelector('textarea')?.value).toBe('Incorrect value')
	}
)

test('a sent report moves focus to Done on the outcome step', async () => {
	await openReport({ type: 'protocol', name: 'Aave', isLending: false })
	await submitReport('TVL')
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Report sent'))
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Done'))
})

test.each([
	['success', 'Report sent'],
	['failure', "Couldn't send the report"]
] as const)('a report that settles with %s after leaving the page says so in a toast', async (outcome, message) => {
	const request = Promise.withResolvers<{ message: string }>()
	mocks.fetchJson.mockReturnValueOnce(request.promise)
	await openReport({ type: 'protocol', name: 'Aave', isLending: false })
	await submitReport('TVL')
	await waitForPending()

	// Navigating away unmounts the page and its dialog; the app's toaster stays.
	await act(async () => root.render(<Toaster />))
	await act(async () => {
		if (outcome === 'success') request.resolve({ message: 'success' })
		else request.reject(new Error('Offline'))
	})
	await waitForUi(() => expect(document.body.textContent).toContain(message))
})
