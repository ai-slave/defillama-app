// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ImagePreviewModal } from '../ImagePreviewModal'

const { writeText, toastError } = vi.hoisted(() => ({ writeText: vi.fn(), toastError: vi.fn() }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
vi.mock('react-hot-toast', () => ({ toast: { error: toastError } }))
let root: Root
let downloads: Array<{ filename: string; blob: Blob }>
let blobs: Map<string, Blob>
const imageA = 'https://images.example/chart-a.png'
const imageB = 'https://images.example/chart-b.png'
function button(name: string) {
	const result = [...document.querySelectorAll('button')].find((el) => el.textContent?.trim() === name)
	expect(result, `button ${name}`).not.toBeUndefined()
	return result!
}
async function render(imageUrl: string | null) {
	await act(async () => root.render(<ImagePreviewModal imageUrl={imageUrl} onClose={vi.fn()} source="generated" />))
}
async function click(name: string) {
	await act(async () => {
		const target = button(name)
		target.focus()
		target.click()
	})
}
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.resetAllMocks()
	writeText.mockResolvedValue(undefined)
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
	const container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	downloads = []
	blobs = new Map()
	vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
		const url = `blob:preview-${blobs.size}`
		blobs.set(url, blob as Blob)
		return url
	})
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
		blobs.delete(url)
	})
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
		downloads.push({ filename: this.download, blob: blobs.get(this.href)! })
	})
})
afterEach(async () => {
	await act(async () => root.unmount())
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	document.body.innerHTML = ''
})

test('HTTP errors show retry feedback and never download the error body', async () => {
	const fetch = vi.fn().mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
	vi.stubGlobal('fetch', fetch)
	await render(imageA)
	await click('Download')
	expect(downloads).toEqual([])
	expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Image preview')
	expect(document.querySelector('[role="alert"]')?.textContent).toBe(
		'Couldn’t download the image. Try again, or use Open to save it from your browser.'
	)
	expect(document.querySelector('a')?.href).toBe(imageA)
	fetch.mockResolvedValueOnce(
		new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } })
	)
	await click('Download')
	expect(downloads.map(({ filename }) => filename)).toEqual(['chart-a.png'])
	expect(Array.from(new Uint8Array(await downloads[0].blob.arrayBuffer()))).toEqual([137, 80, 78, 71])
	expect(downloads[0].blob.type).toBe('image/png')
	expect(blobs.size).toBe(0)
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(button('Download again')).toBe(document.activeElement)
})

test('a delayed download keeps focus and prevents duplicate requests', async () => {
	const request = Promise.withResolvers<Response>()
	const fetch = vi.fn().mockReturnValue(request.promise)
	vi.stubGlobal('fetch', fetch)
	await render(imageA)
	await click('Download')
	const downloading = button('Downloading…')
	expect(downloading).toBe(document.activeElement)
	expect(downloading.getAttribute('aria-disabled')).toBe('true')
	await click('Downloading…')
	expect(fetch.mock.calls).toEqual([[imageA]])
	await act(async () => request.resolve(new Response('image bytes')))
	expect(await downloads[0].blob.text()).toBe('image bytes')
	expect(button('Download again')).toBe(document.activeElement)
})

test.each(['close', 'change image'])(
	'%s isolates feedback without cancelling the requested image download',
	async (action) => {
		const request = Promise.withResolvers<Response>()
		vi.stubGlobal('fetch', vi.fn().mockReturnValue(request.promise))
		await render(imageA)
		await click('Download')
		expect([...document.querySelectorAll('[role="status"]')].map((el) => el.textContent).filter(Boolean)).toEqual([
			'Downloading image'
		])
		if (action === 'close') await render(null)
		await render(imageB)
		await act(async () => request.resolve(new Response('original image')))
		expect(downloads.map(({ filename }) => filename)).toEqual(['chart-a.png'])
		expect(await downloads[0].blob.text()).toBe('original image')
		expect(document.querySelector('img')?.src).toBe(imageB)
		expect(button('Download').getAttribute('aria-disabled')).not.toBe('true')
		expect([...document.querySelectorAll('[role="status"]')].map((el) => el.textContent).filter(Boolean)).toEqual([])
	}
)

test('copy failure is visible, retry preserves focus, and a new image starts without old copied state', async () => {
	writeText.mockRejectedValueOnce(new Error('Denied'))
	await render(imageA)
	await click('Copy URL')
	expect(document.querySelector('[role="alert"]')?.textContent).toBe(
		'Couldn’t copy the image URL. Try again, or use Open to copy it from your browser.'
	)
	const copy = Promise.withResolvers<void>()
	writeText.mockReturnValueOnce(copy.promise)
	await click('Copy URL')
	expect(button('Copying…')).toBe(document.activeElement)
	await act(async () => copy.resolve())
	expect(button('Copied')).toBe(document.activeElement)
	expect(document.querySelector('[role="alert"]')).toBeNull()
	await render(imageB)
	await click('Copy URL')
	expect(writeText.mock.calls).toEqual([[imageA], [imageA], [imageB]])
})

test('a network failure after dismissal reports once without opening a surprise tab', async () => {
	const request = Promise.withResolvers<Response>()
	vi.stubGlobal('fetch', vi.fn().mockReturnValue(request.promise))
	const open = vi.spyOn(window, 'open').mockReturnValue(null)
	await render(imageA)
	await click('Download')
	await render(null)
	await act(async () => request.reject(new Error('CORS blocked')))
	expect(toastError.mock.calls).toEqual([['Couldn’t download the image. Reopen its preview to try again.']])
	expect(open).not.toHaveBeenCalled()
	await render(imageA)
	expect(button('Download').getAttribute('aria-disabled')).not.toBe('true')
	expect(document.querySelector('[role="alert"]')).toBeNull()
})
