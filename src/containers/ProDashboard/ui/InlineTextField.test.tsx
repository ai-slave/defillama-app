// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { InlineTextField } from './InlineTextField'

let root: Root
let container: HTMLDivElement

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

async function openEditor() {
	await act(async () => container.querySelector('button')!.click())
	return container.querySelector('input')!
}

function typeInto(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
	const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
	Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value)
	field.dispatchEvent(new Event('input', { bubbles: true }))
}

function press(field: HTMLElement, key: string, init: KeyboardEventInit = {}) {
	field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
}

test('clicking the value opens a selected input', async () => {
	const selected = vi.fn()
	await act(async () =>
		root.render(<InlineTextField value="Section" placeholder="Section title" maxLength={80} onCommit={vi.fn()} />)
	)
	expect(container.querySelector('button')!.textContent).toBe('Section')
	const select = vi.spyOn(HTMLInputElement.prototype, 'select').mockImplementation(selected)
	const input = await openEditor()
	expect(input.value).toBe('Section')
	expect(selected).toHaveBeenCalled()
	select.mockRestore()
})

test('Enter commits the trimmed value clipped to maxLength', async () => {
	const onCommit = vi.fn()
	await act(async () =>
		root.render(<InlineTextField value="Section" placeholder="Section title" maxLength={8} onCommit={onCommit} />)
	)
	const input = await openEditor()
	await act(async () => typeInto(input, '  Renamed section  '))
	await act(async () => press(input, 'Enter'))
	expect(onCommit).toHaveBeenCalledExactlyOnceWith('Renamed ')
	expect(container.querySelector('input')).toBeNull()
})

test('Escape leaves the value alone', async () => {
	const onCommit = vi.fn()
	await act(async () =>
		root.render(<InlineTextField value="Section" placeholder="Section title" maxLength={80} onCommit={onCommit} />)
	)
	const input = await openEditor()
	await act(async () => typeInto(input, 'Discarded'))
	await act(async () => press(input, 'Escape'))
	expect(onCommit).not.toHaveBeenCalled()
	expect(container.querySelector('button')!.textContent).toBe('Section')
})

test('Enter and Escape hand keyboard focus back to the value button', async () => {
	await act(async () =>
		root.render(<InlineTextField value="Section" placeholder="Section title" maxLength={80} onCommit={vi.fn()} />)
	)
	let input = await openEditor()
	await act(async () => press(input, 'Escape'))
	expect(document.activeElement).toBe(container.querySelector('button'))
	input = await openEditor()
	await act(async () => typeInto(input, 'Renamed'))
	await act(async () => press(input, 'Enter'))
	expect(document.activeElement).toBe(container.querySelector('button'))
})

test('leaving the field with the pointer commits without stealing focus', async () => {
	const onCommit = vi.fn()
	await act(async () =>
		root.render(
			<>
				<InlineTextField value="Section" placeholder="Section title" maxLength={80} onCommit={onCommit} />
				<button type="button" id="elsewhere">
					Elsewhere
				</button>
			</>
		)
	)
	const input = await openEditor()
	await act(async () => typeInto(input, 'Renamed'))
	const elsewhere = container.querySelector<HTMLButtonElement>('#elsewhere')!
	await act(async () => elsewhere.focus())
	expect(onCommit).toHaveBeenCalledExactlyOnceWith('Renamed')
	expect(document.activeElement).toBe(elsewhere)
})

test('committing the same value does not call back', async () => {
	const onCommit = vi.fn()
	await act(async () =>
		root.render(<InlineTextField value="Section" placeholder="Section title" maxLength={80} onCommit={onCommit} />)
	)
	const input = await openEditor()
	await act(async () => press(input, 'Enter'))
	expect(onCommit).not.toHaveBeenCalled()
})

test('a value changed elsewhere replaces the draft while the field is closed', async () => {
	await act(async () =>
		root.render(<InlineTextField value="Section" placeholder="Section title" maxLength={80} onCommit={vi.fn()} />)
	)
	await act(async () =>
		root.render(
			<InlineTextField value="Renamed elsewhere" placeholder="Section title" maxLength={80} onCommit={vi.fn()} />
		)
	)
	const input = await openEditor()
	expect(input.value).toBe('Renamed elsewhere')
})

test('the placeholder shows when there is no value', async () => {
	await act(async () =>
		root.render(<InlineTextField value="" placeholder="Add a description" maxLength={200} onCommit={vi.fn()} />)
	)
	expect(container.querySelector('button')!.textContent).toBe('Add a description')
})

test('saving dims the value and shows a spinner beside it', async () => {
	await act(async () =>
		root.render(
			<InlineTextField value="Section" placeholder="Section title" maxLength={80} status="saving" onCommit={vi.fn()} />
		)
	)
	const button = container.querySelector('button')!
	expect(button.getAttribute('aria-busy')).toBe('true')
	expect(button.className).toContain('opacity-70')
	expect(button.className).toContain('pr-5')
	expect(container.querySelector('.animate-spin')).not.toBeNull()
	expect(container.querySelector('[role="alert"]')).toBeNull()
})

test('saving keeps the value focusable even when the caller also disables it', async () => {
	await act(async () =>
		root.render(
			<InlineTextField
				value="Section"
				placeholder="Section title"
				maxLength={80}
				disabled
				status="saving"
				onCommit={vi.fn()}
			/>
		)
	)
	const button = container.querySelector('button')!
	expect(button.disabled).toBe(false)
	await act(async () => button.focus())
	expect(document.activeElement).toBe(button)
})

test('disabled without a saving status still blocks the field', async () => {
	await act(async () =>
		root.render(
			<InlineTextField value="Section" placeholder="Section title" maxLength={80} disabled onCommit={vi.fn()} />
		)
	)
	expect(container.querySelector('button')!.disabled).toBe(true)
})

test('error marks the field and announces the message', async () => {
	await act(async () =>
		root.render(
			<InlineTextField
				value="Section"
				placeholder="Section title"
				maxLength={80}
				status="error"
				errorMessage="Could not save the name"
				onCommit={vi.fn()}
			/>
		)
	)
	const button = container.querySelector('button')!
	expect(button.className).toContain('ring-error')
	expect(button.getAttribute('aria-busy')).toBeNull()
	const alert = container.querySelector('[role="alert"]')!
	expect(alert.tagName).toBe('SPAN')
	expect(alert.textContent).toBe('Could not save the name')
	expect(container.querySelector('.animate-spin')).toBeNull()
})

test('the saving state leaves the editor usable', async () => {
	await act(async () =>
		root.render(
			<InlineTextField value="Section" placeholder="Section title" maxLength={80} status="idle" onCommit={vi.fn()} />
		)
	)
	const input = await openEditor()
	expect(input.getAttribute('aria-busy')).toBeNull()
	expect(input.className).toContain('border-pro-cards-border')
})

test('multiline edits in a textarea where Enter commits and Shift+Enter does not', async () => {
	const onCommit = vi.fn()
	await act(async () =>
		root.render(
			<InlineTextField multiline value="" placeholder="Add a description" maxLength={200} onCommit={onCommit} />
		)
	)
	await act(async () => container.querySelector('button')!.click())
	const textarea = container.querySelector('textarea')!
	expect(container.querySelector('input')).toBeNull()
	await act(async () => typeInto(textarea, 'First line'))
	await act(async () => press(textarea, 'Enter', { shiftKey: true }))
	expect(onCommit).not.toHaveBeenCalled()
	await act(async () => press(textarea, 'Enter'))
	expect(onCommit).toHaveBeenCalledExactlyOnceWith('First line')
})

test('autoFocus turning on after mount opens the editor', async () => {
	const render = (autoFocus: boolean) =>
		act(async () =>
			root.render(
				<InlineTextField
					value="Section"
					placeholder="Section title"
					maxLength={80}
					autoFocus={autoFocus}
					onCommit={vi.fn()}
				/>
			)
		)
	await render(false)
	expect(container.querySelector('input')).toBeNull()
	await render(true)
	expect(container.querySelector('input')!.value).toBe('Section')
})
