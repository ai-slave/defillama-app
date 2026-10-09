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

test.each(['isLoading', 'disabled'] as const)(
	'%s preserves focus and the value, blocks activation, and re-enables cleanly',
	async (state) => {
		const change = vi.fn()
		function Field({ blocked }: { blocked: boolean }) {
			const [checked, setChecked] = useState(true)
			return (
				<Switch
					label="Alert enabled"
					value="alert"
					checked={checked}
					onChange={(event) => {
						change(event.target.checked)
						setChecked(event.target.checked)
					}}
					{...{ [state]: blocked || undefined }}
				/>
			)
		}
		await act(async () => root.render(<Field blocked={false} />))
		const input = container.querySelector('input')!
		input.focus()
		await act(async () => root.render(<Field blocked />))
		expect(document.activeElement).toBe(input)
		expect(input.getAttribute('aria-disabled')).toBe('true')
		expect(input.getAttribute('aria-busy')).toBe(state === 'isLoading' ? 'true' : null)
		await act(async () => input.click())
		expect(change).not.toHaveBeenCalled()
		expect(input.checked).toBe(true)
		expect(input.getAttribute('aria-checked')).toBe('true')
		await act(async () => root.render(<Field blocked={false} />))
		await act(async () => input.click())
		expect(change).toHaveBeenCalledExactlyOnceWith(false)
		expect(input.checked).toBe(false)
		expect(input.getAttribute('aria-checked')).toBe('false')
	}
)

test('article switch has a concise label and separate description; label activation is reversible', async () => {
	const changed = vi.fn()
	function Field() {
		const [checked, setChecked] = useState(false)
		return (
			<MetaSwitch
				label="Show on homepage"
				description="The article appears in featured research."
				checked={checked}
				onCheckedChange={(next) => {
					changed(next)
					setChecked(next)
				}}
			/>
		)
	}
	await act(async () => root.render(<Field />))
	const input = container.querySelector<HTMLInputElement>('[role="switch"]')!
	expect(input.getAttribute('aria-label')).toBe('Show on homepage')
	expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
		'The article appears in featured research.'
	)
	expect(changed).not.toHaveBeenCalled()
	await act(async () => container.querySelector('label')!.click())
	expect(input.checked).toBe(true)
	await act(async () => container.querySelector('label')!.click())
	expect(input.checked).toBe(false)
	expect(changed.mock.calls).toEqual([[true], [false]])
})
