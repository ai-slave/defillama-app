// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MetaSwitch } from '~/containers/Articles/editor/ArticleMetaFields'
import { Switch } from '../Switch'
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
test('loading blocks activation, then a settled switch can be deselected', async () => {
	const change = vi.fn()
	async function render(loading: boolean) {
		await act(async () =>
			root.render(
				<Switch
					label="Price"
					value="price"
					checked
					onChange={(event) => change(event.currentTarget.checked)}
					isLoading={loading}
				/>
			)
		)
	}
	await render(true)
	const input = container.querySelector('input')!
	expect(input.disabled).toBe(true)
	await act(async () => {
		input.focus()
		input.click()
	})
	expect(document.activeElement).not.toBe(input)
	expect(change).not.toHaveBeenCalled()
	await render(false)
	await act(async () => {
		input.focus()
		input.click()
	})
	expect(document.activeElement).toBe(input)
	expect(change).toHaveBeenCalledExactlyOnceWith(false)
})
test('article switch has a concise label and separate description; label activation is reversible', async () => {
	const changed = vi.fn()
	function Field({ disabled }: { disabled: boolean }) {
		const [checked, setChecked] = useState(false)
		return (
			<MetaSwitch
				label="Show on homepage"
				description="The article appears in featured research."
				checked={checked}
				disabled={disabled}
				onCheckedChange={(next) => {
					changed(next)
					setChecked(next)
				}}
			/>
		)
	}
	await act(async () => root.render(<Field disabled={false} />))
	const input = container.querySelector<HTMLInputElement>('[role="switch"]')!
	expect(document.getElementById(input.getAttribute('aria-labelledby')!)?.textContent).toBe('Show on homepage')
	expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
		'The article appears in featured research.'
	)
	expect(changed).not.toHaveBeenCalled()
	await act(async () => container.querySelector('label')!.click())
	expect(input.checked).toBe(true)
	await act(async () => container.querySelector('label')!.click())
	expect(input.checked).toBe(false)
	expect(changed.mock.calls).toEqual([[true], [false]])
	await act(async () => root.render(<Field disabled />))
	await act(async () => container.querySelector('label')!.click())
	expect(changed).toHaveBeenCalledTimes(2)
})
