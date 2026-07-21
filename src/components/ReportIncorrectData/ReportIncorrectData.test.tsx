// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportIncorrectData, type ReportSubject } from '.'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.fetchJson.mockReset()
	mocks.fetchJson.mockResolvedValue({ message: 'success' })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

async function openReport(subject: ReportSubject) {
	await act(async () => root.render(<ReportIncorrectData subject={subject} />))
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
	it('shows exchange fields and submits the canonical exchange subject', async () => {
		await openReport({ type: 'exchange', name: 'Binance.US', slug: 'binance-us' })

		expect(document.body.textContent).toContain('Exchange')
		expect(document.body.textContent).toContain('Open Interest')
		const payload = await submitReport('Open Interest')

		expect(payload.subject).toEqual({ type: 'exchange', name: 'Binance.US', slug: 'binance-us' })
		expect(payload.dataType).toBe('Open Interest')
		expect(payload).not.toHaveProperty('protocol')
	})

	it('preserves protocol choices without sending the lending presentation hint', async () => {
		await openReport({ type: 'protocol', name: 'Aave', isLending: true })

		expect(document.body.textContent).toContain('Protocol')
		expect(document.body.textContent).toContain("For lending protocols TVL doesn't include active loans by default")
		expect(document.body.textContent).toContain('TVL')
		const payload = await submitReport('TVL')

		expect(payload.protocol).toBe('Aave')
		expect(payload).not.toHaveProperty('subject')
	})
})
