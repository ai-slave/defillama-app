// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { InlineRenameInput, InlineTextField } from '../InlineTextField'

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
		root.render(
			<InlineTextField label="Title" value="Section" placeholder="Section title" maxLength={80} onCommit={vi.fn()} />
		)
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
		root.render(
			<InlineTextField label="Title" value="Section" placeholder="Section title" maxLength={8} onCommit={onCommit} />
		)
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
		root.render(
			<InlineTextField label="Title" value="Section" placeholder="Section title" maxLength={80} onCommit={onCommit} />
		)
	)
	const input = await openEditor()
	await act(async () => typeInto(input, 'Discarded'))
	await act(async () => press(input, 'Escape'))
	expect(onCommit).not.toHaveBeenCalled()
	expect(container.querySelector('button')!.textContent).toBe('Section')
})

test('Enter and Escape hand keyboard focus back to the value button', async () => {
	await act(async () =>
		root.render(
			<InlineTextField label="Title" value="Section" placeholder="Section title" maxLength={80} onCommit={vi.fn()} />
		)
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
				<InlineTextField label="Title" value="Section" placeholder="Section title" maxLength={80} onCommit={onCommit} />
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
		root.render(
			<InlineTextField label="Title" value="Section" placeholder="Section title" maxLength={80} onCommit={onCommit} />
		)
	)
	const input = await openEditor()
	await act(async () => press(input, 'Enter'))
	expect(onCommit).not.toHaveBeenCalled()
})

test('a value changed elsewhere replaces the draft while the field is closed', async () => {
	await act(async () =>
		root.render(
			<InlineTextField label="Title" value="Section" placeholder="Section title" maxLength={80} onCommit={vi.fn()} />
		)
	)
	await act(async () =>
		root.render(
			<InlineTextField
				label="Title"
				value="Renamed elsewhere"
				placeholder="Section title"
				maxLength={80}
				onCommit={vi.fn()}
			/>
		)
	)
	const input = await openEditor()
	expect(input.value).toBe('Renamed elsewhere')
})

test('the placeholder shows when there is no value', async () => {
	await act(async () =>
		root.render(
			<InlineTextField label="Title" value="" placeholder="Add a description" maxLength={200} onCommit={vi.fn()} />
		)
	)
	expect(container.querySelector('button')!.textContent).toBe('Add a description')
})

test('saving marks the value busy without an error', async () => {
	await act(async () =>
		root.render(
			<InlineTextField
				label="Title"
				value="Section"
				placeholder="Section title"
				maxLength={80}
				status="saving"
				onCommit={vi.fn()}
			/>
		)
	)
	const button = container.querySelector('button')!
	expect(button.getAttribute('aria-busy')).toBe('true')
	expect(container.querySelector('[role="alert"]')).toBeNull()
})

test('error marks the field and announces the message', async () => {
	await act(async () =>
		root.render(
			<InlineTextField
				label="Title"
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
	expect(button.getAttribute('aria-busy')).toBeNull()
	expect(container.querySelector('[role="alert"]')!.textContent).toBe('Could not save the name')
})

test('multiline edits in a textarea where Enter commits and Shift+Enter does not', async () => {
	const onCommit = vi.fn()
	await act(async () =>
		root.render(
			<InlineTextField
				multiline
				label="Description"
				value=""
				placeholder="Add a description"
				maxLength={200}
				onCommit={onCommit}
			/>
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
					label="Title"
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

describe('InlineRenameInput', () => {
	function renderRename(onCommit = vi.fn(), onCancel = vi.fn(), multiline = false) {
		return act(async () =>
			root.render(
				<InlineRenameInput
					initial="Weekly volume"
					label="Rename Weekly volume"
					multiline={multiline}
					onCommit={onCommit}
					onCancel={onCancel}
				/>
			)
		)
	}
	const field = () => container.querySelector<HTMLInputElement>('[aria-label="Rename Weekly volume"]')!

	test('mounts focused with the whole name selected', async () => {
		await renderRename()
		expect(document.activeElement).toBe(field())
		expect([field().selectionStart, field().selectionEnd]).toEqual([0, 'Weekly volume'.length])
	})

	test('Enter reports the raw text from the keyboard once, and the blur that follows is ignored', async () => {
		const onCommit = vi.fn()
		await renderRename(onCommit)
		await act(async () => typeInto(field(), ' Daily '))
		await act(async () => press(field(), 'Enter'))
		await act(async () => field().blur())
		expect(onCommit).toHaveBeenCalledExactlyOnceWith(' Daily ', true)
	})

	test('Escape cancels without saving, and the blur that follows is ignored', async () => {
		const onCommit = vi.fn()
		const onCancel = vi.fn()
		await renderRename(onCommit, onCancel)
		await act(async () => typeInto(field(), 'Daily'))
		await act(async () => press(field(), 'Escape'))
		await act(async () => field().blur())
		expect(onCancel).toHaveBeenCalledOnce()
		expect(onCommit).not.toHaveBeenCalled()
	})

	test('leaving the field saves, marked as not from the keyboard', async () => {
		const onCommit = vi.fn()
		await renderRename(onCommit)
		await act(async () => typeInto(field(), 'Daily'))
		await act(async () => field().blur())
		expect(onCommit).toHaveBeenCalledExactlyOnceWith('Daily', false)
	})

	test('Enter while an IME composes belongs to the composition', async () => {
		const onCommit = vi.fn()
		await renderRename(onCommit)
		await act(async () => press(field(), 'Enter', { isComposing: true }))
		expect(onCommit).not.toHaveBeenCalled()
		expect(document.activeElement).toBe(field())
	})

	test('keys and presses stay inside the field', async () => {
		const outside = vi.fn()
		await act(async () =>
			root.render(
				<div role="presentation" onKeyDown={outside} onClick={outside}>
					<InlineRenameInput
						initial="Weekly volume"
						label="Rename Weekly volume"
						onCommit={vi.fn()}
						onCancel={vi.fn()}
					/>
				</div>
			)
		)
		await act(async () => press(field(), 'ArrowRight'))
		await act(async () => press(field(), 'Escape'))
		await act(async () => field().click())
		expect(outside).not.toHaveBeenCalled()
	})

	test('multiline keeps Shift+Enter as a new line and saves on Enter', async () => {
		const onCommit = vi.fn()
		await renderRename(onCommit, vi.fn(), true)
		expect(field()).toBeInstanceOf(HTMLTextAreaElement)
		await act(async () => press(field(), 'Enter', { shiftKey: true }))
		expect(onCommit).not.toHaveBeenCalled()
		await act(async () => press(field(), 'Enter'))
		expect(onCommit).toHaveBeenCalledExactlyOnceWith('Weekly volume', true)
	})
})
