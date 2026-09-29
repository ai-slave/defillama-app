// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Button } from '../Button'
import { Dialog, DialogBackButton, DialogBody, DialogHeader } from '../Dialog'

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

test('a pending submit button keeps focus, shows its pending label and submits nothing until it settles', async () => {
	const submit = vi.fn()
	function Form({ pending }: { pending: boolean }) {
		return (
			<form
				onSubmit={(event) => {
					event.preventDefault()
					submit()
				}}
			>
				<Button type="submit" variant="primary" size="md" pendingLabel={pending ? 'Saving…' : null}>
					Save
				</Button>
			</form>
		)
	}
	await act(async () => root.render(<Form pending={false} />))
	const button = container.querySelector('button')!
	button.focus()
	await act(async () => root.render(<Form pending />))
	expect(document.activeElement).toBe(button)
	expect(accessibleName(button)).toBe('Saving…')
	expect(button.getAttribute('aria-disabled')).toBe('true')
	expect(button.getAttribute('aria-busy')).toBe('true')
	await act(async () => button.click())
	expect(submit).not.toHaveBeenCalled()
	await act(async () => root.render(<Form pending={false} />))
	expect(accessibleName(button)).toBe('Save')
	await act(async () => button.click())
	expect(submit).toHaveBeenCalledOnce()
})

test('a pending dialog ignores Escape and its close button, then closes again once the request settles', async () => {
	function Harness({ pending }: { pending: boolean }) {
		const [open, setOpen] = useState(true)
		return (
			<>
				{open ? null : <p>Closed</p>}
				<Dialog size="sm" open={open} onClose={() => setOpen(false)} pending={pending}>
					<DialogHeader title="Invite" />
					<DialogBody>
						<p>Body</p>
					</DialogBody>
				</Dialog>
			</>
		)
	}
	await act(async () => root.render(<Harness pending />))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const dialog = document.querySelector<HTMLElement>('[role=dialog]')!
	const close = dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!
	expect(close.getAttribute('aria-disabled')).toBe('true')
	await act(async () => close.click())
	await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	expect(container.textContent).not.toContain('Closed')
	await act(async () => root.render(<Harness pending={false} />))
	await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	await waitForUi(() => expect(container.textContent).toContain('Closed'))
})

test('a pending dialog keeps focus on its back button and ignores it until the request settles', async () => {
	const back = vi.fn()
	function Harness({ pending }: { pending: boolean }) {
		return (
			<Dialog size="sm" open onClose={() => {}} pending={pending}>
				<DialogHeader title="New dashboard" leading={<DialogBackButton label="Back to choices" onClick={back} />} />
			</Dialog>
		)
	}
	await act(async () => root.render(<Harness pending={false} />))
	await waitForUi(() => expect(document.querySelector('[aria-label="Back to choices"]')).not.toBeNull())
	const backButton = document.querySelector<HTMLButtonElement>('[aria-label="Back to choices"]')!
	await act(async () => backButton.focus())
	await act(async () => root.render(<Harness pending />))
	expect(document.activeElement).toBe(backButton)
	expect(backButton.disabled).toBe(false)
	expect(backButton.getAttribute('aria-disabled')).toBe('true')
	await act(async () => backButton.click())
	expect(back).not.toHaveBeenCalled()
	await act(async () => root.render(<Harness pending={false} />))
	await act(async () => backButton.click())
	expect(back).toHaveBeenCalledOnce()
})

test('the header subtitle is announced as the dialog description', async () => {
	await act(async () =>
		root.render(
			<Dialog size="sm" open onClose={() => {}}>
				<DialogHeader title="Chart metrics" subtitle="3 of 40 selected" />
			</Dialog>
		)
	)
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const describedBy = document.querySelector('[role=dialog]')!.getAttribute('aria-describedby')
	expect(describedBy && document.getElementById(describedBy)?.textContent).toBe('3 of 40 selected')
})
