// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AddVariablePopover } from '../AddVariablePopover'

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

const labelField = () => document.body.querySelector<HTMLInputElement>('input[maxlength]')
const errors = () => [...document.body.querySelectorAll('.text-error')].map((node) => node.textContent)

test('a reopened parameter popover keeps the typed label but starts with its errors quiet', async () => {
	await act(async () =>
		root.render(
			<DashboardTestProvider mode="edit">
				<AddVariablePopover />
			</DashboardTestProvider>
		)
	)
	const disclosure = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Parameter')!
	await act(async () => disclosure.click())
	await waitForUi(() => expect(labelField()).not.toBeNull())
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(labelField(), 'Network')
		labelField()!.dispatchEvent(new Event('input', { bubbles: true }))
	})
	const add = () => [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Add parameter')!
	await act(async () => add().click())
	expect(errors()).toEqual(['Choose a chain.'])

	await act(async () => disclosure.click())
	await waitForUi(() => expect(labelField()).toBeNull())
	await act(async () => disclosure.click())
	await waitForUi(() => expect(labelField()).not.toBeNull())
	expect(labelField()!.value).toBe('Network')
	expect(errors()).toEqual([])
	await act(async () => add().click())
	expect(errors()).toEqual(['Choose a chain.'])
})
