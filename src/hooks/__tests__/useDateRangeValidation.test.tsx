// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
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
