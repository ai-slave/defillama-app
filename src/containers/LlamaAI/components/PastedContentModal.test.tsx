// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { downloadBlob } from '~/utils/download'
import { TextChip } from './input/ImageUpload'
import { PastedContentModal } from './PastedContentModal'

vi.mock('~/utils/download', () => ({ downloadBlob: vi.fn() }))
vi.mock('./ImagePreviewModal', () => ({ ImagePreviewModal: () => null }))

const writeText = vi.fn<(text: string) => Promise<void>>()
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
let root: Root
let host: HTMLDivElement

beforeEach(() => {
	vi.clearAllMocks()
	writeText.mockResolvedValue(undefined)
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
	if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
	else Reflect.deleteProperty(navigator, 'clipboard')
})

function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim() === name
	)!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function mount(preview: { filename: string; content: string; isPasted?: boolean }) {
	function Harness() {
		const [open, setOpen] = useState(false)
		return (
			<>
				<button type="button" onClick={() => setOpen(true)}>
					Open preview
				</button>
				<PastedContentModal preview={open ? preview : null} onClose={() => setOpen(false)} />
			</>
		)
	}
	await act(async () => root.render(<Harness />))
	await click('Open preview')
}

test.each([
	{
		filename: 'perp_skhynix_1%_depth.CSV',
		content: 'asset,notes,depth\r\nSK,"quoted, value",001.20\r\nÉTH,"two\nlines",\r\n',
		type: 'text/csv;charset=utf-8'
	},
	{ filename: 'Article.md', content: '# Draft\n\n**Original** text.\n', type: 'text/markdown;charset=utf-8' },
	{ filename: 'Pasted-1.txt', content: '', type: 'text/plain;charset=utf-8', isPasted: true }
])('downloads $filename without changing its text or filename', async ({ type, ...preview }) => {
	await mount(preview)
	await click('Download')
	const [filename, blob] = vi.mocked(downloadBlob).mock.calls[0]
	expect(filename).toBe(preview.filename)
	expect(blob.type).toBe(type)
	expect(await blob.text()).toBe(preview.content)
	expect(writeText).not.toHaveBeenCalled()
})

test('copy keeps focus, blocks repeats while pending and resets when the preview closes', async () => {
	let finish!: () => void
	writeText.mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve
			})
	)
	await mount({ filename: 'data.csv', content: 'a,b\n1,2' })
	const copy = button('Copy')
	copy.focus()
	await click('Copy')
	expect(copy.getAttribute('aria-busy')).toBe('true')
	expect(document.activeElement).toBe(copy)
	await click('Copying…')
	expect(writeText).toHaveBeenCalledTimes(1)
	await act(async () => finish())
	expect(button('Copied')).toBe(copy)
	await click('Close dialog')
	await click('Open preview')
	expect(button('Copy')).toBeDefined()
	expect(button('Copied')).toBeUndefined()
})

test('failed copy offers retry and leaves download available', async () => {
	writeText.mockRejectedValueOnce(new Error('Clipboard blocked'))
	await mount({ filename: 'data.csv', content: 'a,b\n1,2' })
	await click('Copy')
	expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't copy")
	await click('Download')
	expect(downloadBlob).toHaveBeenCalledTimes(1)
	await click('Retry copy')
	expect(button('Copied')).toBeDefined()
	expect(document.querySelector('[role="alert"]')).toBeNull()
})

test('attachment loading blocks repeats and failed reads can retry', async () => {
	let reject!: (reason: Error) => void
	const open = vi.fn<() => Promise<void>>().mockImplementationOnce(
		() =>
			new Promise((_, fail) => {
				reject = fail
			})
	)
	await act(async () =>
		root.render(<TextChip name="data.csv" sizeBytes={0} textContent="" isPasted={false} onOpen={open} />)
	)
	await click('Open data.csv')
	expect(button('Open data.csv').getAttribute('aria-busy')).toBe('true')
	await click('Open data.csv')
	expect(open).toHaveBeenCalledTimes(1)
	await act(async () => reject(new Error('Network failed')))
	expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't open file")
	open.mockResolvedValue(undefined)
	await click('Open data.csv')
	expect(open).toHaveBeenCalledTimes(2)
	expect(button('Open data.csv').getAttribute('aria-busy')).toBe('false')
	expect(document.querySelector('[role="alert"]')).toBeNull()
})
