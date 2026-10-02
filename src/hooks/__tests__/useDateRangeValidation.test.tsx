// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useDateRangeValidation } from '../useDateRangeValidation'

let api: ReturnType<typeof useDateRangeValidation>

function Range({ defaultStartDate, defaultEndDate }: { defaultStartDate: string; defaultEndDate: string }) {
	api = useDateRangeValidation({ defaultStartDate, defaultEndDate })
	return (
		<output>
			{api.startDate}..{api.endDate}
		</output>
	)
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('untouched inputs follow a default that moves after hydration', async () => {
	await act(async () => root.render(<Range defaultStartDate="2026-08-26" defaultEndDate="2026-09-26" />))
	expect(container.textContent).toBe('2026-08-26..2026-09-26')

	await act(async () => root.render(<Range defaultStartDate="2026-08-27" defaultEndDate="2026-09-27" />))
	expect(container.textContent).toBe('2026-08-27..2026-09-27')
})

test('a date the reader picked stays when the default moves on', async () => {
	await act(async () => root.render(<Range defaultStartDate="2026-08-26" defaultEndDate="2026-09-26" />))
	await act(async () => api.handleEndDateChange('2026-09-20'))
	expect(container.textContent).toBe('2026-08-26..2026-09-20')

	await act(async () => root.render(<Range defaultStartDate="2026-08-27" defaultEndDate="2026-09-27" />))
	expect(container.textContent).toBe('2026-08-26..2026-09-20')
})

test('both endpoints applied in one batch keep each other', async () => {
	await act(async () => root.render(<Range defaultStartDate="2026-08-26" defaultEndDate="2026-09-26" />))
	await act(async () => {
		api.handleStartDateChange('2026-09-01')
		api.handleEndDateChange('2026-09-20')
	})
	expect(container.textContent).toBe('2026-09-01..2026-09-20')
})

test('a start after the end clears the end', async () => {
	await act(async () => root.render(<Range defaultStartDate="2026-08-26" defaultEndDate="2026-09-26" />))
	await act(async () => api.handleStartDateChange('2026-10-01'))
	expect(container.textContent).toBe('2026-10-01..')
})

test('today is the UTC day the defaults use, even where the local day is still yesterday', async () => {
	const originalTimeZone = process.env.TZ
	process.env.TZ = 'America/Los_Angeles'
	// 19:56 on Oct 1 in Los Angeles is already Oct 2 in UTC, the day the pages' default end date names.
	vi.useFakeTimers({ now: new Date('2026-10-02T02:56:00Z'), toFake: ['Date'] })
	try {
		await act(async () => root.render(<Range defaultStartDate="2026-09-02" defaultEndDate="2026-10-02" />))
		let valid = false
		await act(async () => {
			valid = api.validateDateRange('2026-09-02', '2026-10-02')
		})
		expect(valid).toBe(true)
		await act(async () => {
			valid = api.validateDateRange('2026-09-02', '2026-10-03')
		})
		expect(valid).toBe(false)
		expect(api.dateError).toBe('End date cannot be in the future')
	} finally {
		vi.useRealTimers()
		// Assigning undefined to an env var stores the string "undefined".
		if (originalTimeZone === undefined) delete process.env.TZ
		else process.env.TZ = originalTimeZone
	}
})
