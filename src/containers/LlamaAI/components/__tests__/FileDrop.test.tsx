// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useImageUpload } from '../../hooks/useImageUpload'
import { FileDropOverlay, FileDropProvider, useFileDropTarget } from '../FileDrop'

vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
vi.mock('~/components/Toast/notifications', () => ({ errorToast: vi.fn() }))

let container: HTMLDivElement
let root: Root
function Composer({ enabled, label }: { enabled: boolean; label: string }) {
	const upload = useImageUpload()
	useFileDropTarget(label, upload.addDroppedFiles, enabled)
	return (
		<div>
			<textarea />
			<output>{upload.selectedImages.map(({ file }) => file.name).join(',')}</output>
		</div>
	)
}
async function render(enabled = true) {
	await act(async () =>
		root.render(
			<FileDropProvider>
				<FileDropOverlay />
				<p>Outside composer</p>
				<Composer enabled={enabled} label="Attach files to message" />
			</FileDropProvider>
		)
	)
}
async function drag(target: Element, type: string, files: Array<File> = [], types = ['Files']) {
	const event = new Event(type, { bubbles: true, cancelable: true })
	Object.assign(event, { dataTransfer: { files, types } })
	await act(async () => {
		target.dispatchEvent(event)
	})
	return event
}
const overlayText = () => container.textContent ?? ''
const output = () => container.querySelector('output')!.textContent
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

test('attaches every file dropped outside the composer and clears the overlay', async () => {
	await render()
	const outside = document.body
	await drag(outside, 'dragenter')
	expect(overlayText()).toContain('Attach files to message')
	const drop = await drag(outside, 'drop', [
		new File(['a'], 'a.pdf', { type: 'application/pdf' }),
		new File(['b'], 'b.pdf', { type: 'application/pdf' })
	])
	expect(drop.defaultPrevented).toBe(true)
	expect(output()).toBe('a.pdf,b.pdf')
	expect(overlayText()).not.toContain('Attach files to message')
	const textDrop = await drag(outside, 'drop', [], ['text/plain'])
	expect(textDrop.defaultPrevented).toBe(false)
	expect(output()).toBe('a.pdf,b.pdf')
})

test('keeps the overlay while crossing children and clears it when leaving the window', async () => {
	await render()
	const outside = container.querySelector('p')!
	const input = container.querySelector('textarea')!
	await drag(outside, 'dragenter')
	await drag(input, 'dragenter')
	await drag(outside, 'dragleave')
	expect(overlayText()).toContain('Attach files to message')
	await drag(input, 'dragleave')
	expect(overlayText()).not.toContain('Attach files to message')
})

test('swallows files without highlighting when the receiver is disabled', async () => {
	await render(false)
	await drag(container.querySelector('p')!, 'dragenter')
	expect(overlayText()).not.toContain('Attach files to message')
	const event = await drag(container.querySelector('textarea')!, 'drop', [
		new File(['a'], 'a.pdf', { type: 'application/pdf' })
	])
	expect(event.defaultPrevented).toBe(true)
	expect(output()).toBe('')
})

test('uncovers the target underneath when the top one unregisters', async () => {
	const landed: Array<string> = []
	function Panel() {
		useFileDropTarget('Add files to project', () => landed.push('project'), true)
		return null
	}
	function Landing({ tab }: { tab: string }) {
		useFileDropTarget('Attach files to message', () => landed.push('message'), tab === 'chats')
		return <Panel />
	}
	const show = (tab: string) =>
		act(async () =>
			root.render(
				<FileDropProvider>
					<Landing tab={tab} />
				</FileDropProvider>
			)
		)
	const file = [new File(['a'], 'a.csv', { type: 'text/csv' })]

	await show('sources')
	await drag(document.body, 'drop', file)
	await show('chats')
	await drag(document.body, 'drop', file)
	await show('sources')
	await drag(document.body, 'drop', file)
	expect(landed).toEqual(['project', 'message', 'project'])
})
