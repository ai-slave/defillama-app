// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DashboardAnnotation } from '../../dashboardTypes'
import { AnnotationsPopover } from '../AnnotationsPopover'

const marks: Array<DashboardAnnotation> = [
	{ id: 'merge', date: '2022-09-15', label: 'Merge' },
	{ id: 'shapella', date: '2023-04-12', label: 'Shapella' }
]

function Harness() {
	const [annotations, setAnnotations] = useState(marks)
	return (
		<DashboardTestProvider mode="edit" annotations={{ annotations, setAnnotations }}>
			<AnnotationsPopover />
		</DashboardTestProvider>
	)
}

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const deleteButton = (label: string) =>
	document.body.querySelector<HTMLButtonElement>(`[aria-label="Delete annotation ${label}"]`)!
async function remove(label: string) {
	await act(async () => {
		deleteButton(label).focus()
		deleteButton(label).click()
	})
}

test('deleting an annotation hands focus to the next row, then to the date field after the last', async () => {
	await act(async () => root.render(<Harness />))
	await act(async () =>
		[...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Annotations'))!.click()
	)
	await waitForUi(() => expect(deleteButton('Merge')).not.toBeNull())

	await remove('Merge')
	expect(document.activeElement).toBe(deleteButton('Shapella'))
	await remove('Shapella')
	expect(document.body.textContent).toContain('No annotations yet.')
	expect(document.activeElement).toBe(document.body.querySelector('input[type="date"]'))
})

test('a reopened popover keeps the typed draft but starts with its errors quiet', async () => {
	await act(async () => root.render(<Harness />))
	const disclosure = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Annotations'))!
	await act(async () => disclosure.click())
	await waitForUi(() => expect(document.body.querySelector('input[type="text"]')).not.toBeNull())
	const labelField = () => document.body.querySelector<HTMLInputElement>('input[type="text"]')!
	const addButton = () => [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Add')!
	await act(async () => addButton().click())
	expect(fieldErrorTexts()).toHaveLength(2)
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(labelField(), 'Upgrade')
		labelField().dispatchEvent(new Event('input', { bubbles: true }))
	})

	await act(async () => document.body.querySelector<HTMLButtonElement>('[aria-label="Close annotations"]')!.click())
	await waitForUi(() => expect(document.body.querySelector('input[type="text"]')).toBeNull())
	await act(async () => disclosure.click())
	await waitForUi(() => expect(document.body.querySelector('input[type="text"]')).not.toBeNull())
	expect(labelField().value).toBe('Upgrade')
	expect(fieldErrorTexts()).toEqual([])
	await act(async () => addButton().click())
	expect(fieldErrorTexts()).toEqual(['Enter a date.'])
})
