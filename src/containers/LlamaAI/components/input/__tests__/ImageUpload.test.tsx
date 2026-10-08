// @vitest-environment happy-dom
import { act, createRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { attachmentUploadMessage, type AttachmentUpload } from '../../../hooks/useImageUpload'
import { ImageUpload } from '../ImageUpload'

vi.mock('../../ImagePreviewModal', () => ({ ImagePreviewModal: () => null }))
let host: HTMLDivElement
let root: Root
const retry = vi.fn()
const remove = vi.fn()
const file = new File(['protocol,tvl\ndemo,1'], 'demo.csv', { type: 'text/csv' })
beforeEach(() => {
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
	vi.clearAllMocks()
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})
async function render(upload: AttachmentUpload, disabled = false) {
	const selectedImages = [{ id: 'file-1', file, url: '', upload }]
	await act(async () =>
		root.render(
			<ImageUpload
				selectedImages={selectedImages}
				previewImage={null}
				setPreviewImage={vi.fn()}
				retryUpload={retry}
				removeImage={remove}
				uploadMessage={attachmentUploadMessage(selectedImages)}
				fileInputRef={createRef()}
				handleImageSelect={vi.fn()}
				disabled={disabled}
			/>
		)
	)
}
function button(label: string) {
	return host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
}

test('failed files remain visible with a named retry action, reason, and independent remove action', async () => {
	await render({ status: 'error', progress: 0, error: 'Connection interrupted' })
	expect(host.textContent).toContain('demo.csv')
	expect(host.querySelector('[role="alert"]')!.textContent).toContain('Connection interrupted')
	await act(async () => button('Retry upload demo.csv').click())
	expect(retry).toHaveBeenCalledWith('file-1')
	expect(remove).not.toHaveBeenCalled()
	await act(async () => button('Remove demo.csv').click())
	expect(remove).toHaveBeenCalledWith(0)
})

test('a retry that replaces the failed strip hands focus to the prompt field', async () => {
	const prompt = document.createElement('textarea')
	prompt.name = 'prompt'
	document.body.append(prompt)
	await render({ status: 'error', progress: 0, error: 'Connection interrupted' })
	const retryButton = button('Retry upload demo.csv')
	retryButton.focus()
	await act(async () => render({ status: 'pending', progress: 0 }))
	expect(retryButton.isConnected).toBe(false)
	expect(document.activeElement).toBe(prompt)
	prompt.remove()
})

test('waiting, transferring, finishing, and ready states stay on the same file card', async () => {
	await render({ status: 'pending', progress: 0 })
	const card = button('Open demo.csv')
	expect(host.textContent).toContain('Waiting to upload')
	expect(host.querySelector('[role="progressbar"]')).toBeNull()
	await render({ status: 'uploading', progress: 0.54 })
	expect(button('Open demo.csv')).toBe(card)
	expect(host.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('54')
	expect(host.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).toBe('Uploading demo.csv')
	await render({ status: 'uploading', progress: 1 })
	expect(host.textContent).toContain('Finishing upload…')
	expect(host.querySelector('[role="progressbar"]')).toBeNull()
	await render({
		status: 'done',
		progress: 1,
		attachment: { id: 'a', url: 'https://files/demo.csv', mimeType: 'text/csv', filename: file.name, size: file.size }
	})
	expect(button('Open demo.csv')).toBe(card)
	expect(host.textContent).toContain('Ready')
	expect(host.textContent).not.toContain('Finishing')
})

test('stopping disables retry and hides removal without dropping the failed file', async () => {
	await render({ status: 'error', progress: 0, error: 'Upload failed' }, true)
	expect(button('Retry upload demo.csv').disabled).toBe(true)
	expect(button('Remove demo.csv')).toBeNull()
	expect(host.textContent).toContain('demo.csv')
})

test('opens the full failure reason without retrying or removing the file', async () => {
	await render({ status: 'error', progress: 0, error: 'Too many concurrent uploads. Try again shortly.' })
	await act(async () => button('Upload error for demo.csv').click())
	const details = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(details.getAttribute('aria-labelledby')!)?.textContent).toBe(
		'Upload error for demo.csv'
	)
	expect(details.textContent).toContain('Too many concurrent uploads. Try again shortly.')
	expect(retry).not.toHaveBeenCalled()
	expect(remove).not.toHaveBeenCalled()
})

test('removing an attachment hands focus to the next one’s remove, and the last one to the prompt field', async () => {
	const prompt = document.createElement('textarea')
	prompt.name = 'prompt'
	document.body.append(prompt)
	const image = new File(['png'], 'chart.png', { type: 'image/png' })
	function Harness() {
		const [selected, setSelected] = useState([
			{ id: 'file-1', file },
			{ id: 'image-1', file: image, url: 'blob:chart' }
		])
		return (
			<ImageUpload
				selectedImages={selected.map((item) => ({ url: '', ...item }))}
				previewImage={null}
				setPreviewImage={vi.fn()}
				retryUpload={retry}
				removeImage={(idx) => setSelected((items) => items.filter((_, i) => i !== idx))}
				uploadMessage={null}
				fileInputRef={createRef()}
				handleImageSelect={vi.fn()}
			/>
		)
	}
	await act(async () => root.render(<Harness />))
	await act(async () => {
		button('Remove demo.csv').focus()
		button('Remove demo.csv').click()
	})
	expect(document.activeElement).toBe(button('Remove chart.png'))
	await act(async () => button('Remove chart.png').click())
	expect(button('Remove chart.png')).toBeNull()
	expect(document.activeElement).toBe(prompt)
	prompt.remove()
})
