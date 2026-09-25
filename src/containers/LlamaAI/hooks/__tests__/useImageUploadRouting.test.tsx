// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { UploadedAttachment } from '../../api/uploadChatFile'
import { toSubmittedAttachments, useImageUpload, type UploadContext } from '../useImageUpload'

/** One upload as the server sees it. XMLHttpRequest is the network boundary: fetch cannot report progress. */
class FakeUpload {
	static sent: Array<FakeUpload> = []
	/** How every new upload answers; null leaves it open for the test to settle. */
	static answer: ((upload: FakeUpload) => void) | null = null
	url = new URL('about:blank')
	file!: File
	aborted = false
	status = 0
	responseText = ''
	upload = new EventTarget()
	private events = new EventTarget()
	open(_method: string, url: string) {
		this.url = new URL(url)
	}
	setRequestHeader() {}
	addEventListener(type: string, listener: EventListener) {
		this.events.addEventListener(type, listener)
	}
	send(form: FormData) {
		this.file = form.get('file') as File
		FakeUpload.sent.push(this)
		FakeUpload.answer?.(this)
	}
	abort() {
		this.aborted = true
		this.events.dispatchEvent(new Event('abort'))
	}
	get sessionId() {
		return this.url.searchParams.get('sessionId')
	}
	get projectId() {
		return this.url.searchParams.get('projectId')
	}
	resolve(attachment: UploadedAttachment = uploaded) {
		this.finish(200, { attachments: [attachment] })
	}
	reject(status: number, body: unknown) {
		this.finish(status, body)
	}
	fail() {
		this.events.dispatchEvent(new Event('error'))
	}
	progress(fraction: number) {
		this.upload.dispatchEvent(
			Object.assign(new Event('progress'), { lengthComputable: true, loaded: fraction, total: 1 })
		)
	}
	private finish(status: number, body: unknown) {
		this.status = status
		this.responseText = JSON.stringify(body)
		this.events.dispatchEvent(new Event('load'))
	}
}
const requests = FakeUpload.sent
/** Leave uploads open so a test can settle each one itself. */
function controlledUploads() {
	FakeUpload.answer = null
	return requests
}

function bigCsv(name: string, mb: number) {
	const file = new File(['x'], name, { type: 'text/csv' })
	Object.defineProperty(file, 'size', { value: mb * 1024 * 1024 })
	return file
}

let api: ReturnType<typeof useImageUpload>
let container: HTMLDivElement
let root: Root
function Probe({ uploadContext }: { uploadContext: UploadContext | null }) {
	api = useImageUpload({ uploadContext })
	return null
}
async function render(uploadContext: UploadContext | null) {
	await act(async () => root.render(<Probe uploadContext={uploadContext} />))
}

const uploaded: UploadedAttachment = {
	id: '1',
	filename: 'a.csv',
	workspacePath: 'uploads/s1/a.csv',
	url: 'https://files/a.csv',
	mimeType: 'text/csv',
	size: 1
}
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	FakeUpload.sent.length = 0
	FakeUpload.answer = (upload) => queueMicrotask(() => upload.resolve())
	vi.stubGlobal('XMLHttpRequest', FakeUpload)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
})

test("kyle's six 72MB CSVs all attach and each uploads on its own", async () => {
	await render({ authToken: 'tok', sessionId: 's1' })
	const files = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((n) => bigCsv(`${n}.csv`, 72))

	await act(async () => {
		api.addImages(files)
	})

	expect(api.selectedImages.map((i) => i.file.name)).toEqual([
		'p1.csv',
		'p2.csv',
		'p3.csv',
		'p4.csv',
		'p5.csv',
		'p6.csv'
	])
	expect(requests).toHaveLength(6)
	expect(api.selectedImages.every((i) => i.upload?.status === 'done')).toBe(true)
})

test('without an upload context the message budget still applies', async () => {
	await render(null)
	await act(async () => {
		api.addImages(['p1', 'p2'].map((n) => bigCsv(`${n}.csv`, 72)))
	})
	expect(api.selectedImages).toHaveLength(1)
	expect(requests).toHaveLength(0)
	expect(api.selectionFeedback).toMatchObject({ added: 1, skipped: [{ filename: 'p2.csv' }] })
})

test('images keep riding inside the message and keep their budget', async () => {
	await render({ authToken: 'tok', sessionId: 's1' })
	const image = new File(['x'], 'chart.png', { type: 'image/png' })
	Object.defineProperty(image, 'size', { value: 5 * 1024 * 1024 })
	await act(async () => {
		api.addImages([image])
	})
	expect(requests).toHaveLength(0)
	expect(api.selectedImages[0].upload).toBeUndefined()
})

test('a failed upload is shown on the file, not swallowed', async () => {
	FakeUpload.answer = (upload) => queueMicrotask(() => upload.reject(507, { error: 'Project storage quota exceeded' }))
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => {
		api.addImages([bigCsv('p1.csv', 72)])
	})
	expect(api.selectedImages[0].upload).toMatchObject({
		status: 'error',
		error: 'Project storage quota exceeded'
	})
})

test('an uploaded file is sent as a path; everything else is still inlined', async () => {
	const csv = bigCsv('p1.csv', 72)
	const png = new File(['x'], 'chart.png', { type: 'image/png' })

	const sent = await toSubmittedAttachments([
		{
			file: csv,
			upload: {
				status: 'done',
				progress: 1,
				attachment: {
					id: '1',
					url: 'https://r2/launches.csv',
					mimeType: 'text/csv',
					filename: 'p1.csv',
					size: csv.size,
					workspacePath: 'uploads/s1/p1.csv'
				}
			}
		},
		{ file: png }
	])

	expect(sent[0]).toMatchObject({ workspacePath: 'uploads/s1/p1.csv', mimeType: 'text/csv' })
	// The 72MB file contributes a path, not 96MB of base64.
	expect(sent[0].data).toBe('https://r2/launches.csv')
	expect(sent[1].workspacePath).toBeUndefined()
	expect(typeof sent[1].data).toBe('string')
})

test.each(['pending', 'uploading', 'error'] as const)('never inlines a %s workspace upload', async (status) => {
	const csv = bigCsv('p1.csv', 72)
	await expect(
		toSubmittedAttachments([{ file: csv, upload: { status, progress: 0, error: 'Failed' } }])
	).rejects.toThrow('Retry or remove')
})

test('a converted document uses its uploaded URL even without a workspace path', async () => {
	const file = new File(['doc'], 'notes.docx')
	const sent = await toSubmittedAttachments([
		{
			file,
			upload: {
				status: 'done',
				progress: 1,
				attachment: { ...uploaded, workspacePath: undefined, mimeType: 'application/pdf' }
			}
		}
	])
	expect(sent[0]).toMatchObject({ data: uploaded.url, mimeType: 'application/pdf' })
})

test('never runs more uploads at once than the server accepts', async () => {
	controlledUploads()
	const open = () => requests.filter((r) => r.status === 0 && !r.aborted).length

	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => {
		api.addImages(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((n) => bigCsv(`${n}.csv`, 72)))
	})

	expect(open()).toBe(3)
	expect(api.selectedImages.filter((i) => i.upload?.status === 'pending')).toHaveLength(3)

	// Finishing the running ones lets the queued ones through, and all six still land.
	for (let i = 0; i < 6; i++) {
		await act(async () => requests[i]!.resolve())
		expect(open()).toBeLessThanOrEqual(3)
	}
	expect(requests).toHaveLength(6)
	expect(api.selectedImages.every((i) => i.upload?.status === 'done')).toBe(true)
})

test('removing a queued file prevents it from starting', async () => {
	controlledUploads()
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => api.addImages([1, 2, 3, 4, 5].map((i) => bigCsv(`${i}.csv`, 72))))
	await act(async () => api.removeImage(3))
	await act(async () => requests[0]!.resolve())
	expect(requests.map((r) => r.file.name)).toEqual(['1.csv', '2.csv', '3.csv', '5.csv'])
})

test('removing an active upload aborts it and starts the next file without showing an error', async () => {
	controlledUploads()
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => api.addImages([1, 2, 3, 4].map((i) => bigCsv(`${i}.csv`, 72))))
	await act(async () => api.removeImage(0))
	expect(requests[0]!.aborted).toBe(true)
	expect(requests).toHaveLength(4)
	await act(async () => {
		requests[0]!.progress(0.8)
		requests[0]!.resolve()
	})
	expect(api.selectedImages.map((i) => i.file.name)).toEqual(['2.csv', '3.csv', '4.csv'])
	expect(api.selectedImages.some((i) => i.upload?.status === 'error')).toBe(false)
})

test('retry keeps the failed chip and queues exactly one new attempt', async () => {
	controlledUploads()
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => api.addImages([bigCsv('retry.csv', 72)]))
	const id = api.selectedImages[0].id
	await act(async () => requests[0]!.fail())
	expect(api.selectedImages[0].upload?.status).toBe('error')
	await act(async () => {
		api.retryUpload(id)
		api.retryUpload(id)
	})
	expect(requests).toHaveLength(2)
	expect(api.selectedImages[0].id).toBe(id)
	await act(async () => requests[1]!.resolve())
	expect(api.selectedImages[0].upload?.status).toBe('done')
})

test('clearing the draft cancels active and queued work', async () => {
	controlledUploads()
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => api.addImages([1, 2, 3, 4, 5, 6].map((i) => bigCsv(`${i}.csv`, 72))))
	await act(async () => api.clearImages())
	expect(requests).toHaveLength(3)
	expect(requests.every((r) => r.aborted)).toBe(true)
	expect(api.selectedImages).toHaveLength(0)
})

test('changing the destination cancels old work instead of redirecting queued files', async () => {
	controlledUploads()
	await render({ authToken: 'tok', sessionId: 's1', projectId: 'p1' })
	await act(async () => api.addImages([1, 2, 3, 4].map((i) => bigCsv(`${i}.csv`, 72))))
	await render({ authToken: 'tok', sessionId: 's2', projectId: 'p2' })
	expect(requests).toHaveLength(3)
	expect(requests.every((r) => r.aborted)).toBe(true)
	expect(api.selectedImages).toHaveLength(0)
	await act(async () => api.addImages([bigCsv('new.csv', 72)]))
	expect([requests[3]!.sessionId, requests[3]!.projectId]).toEqual(['s2', 'p2'])
})

test('refreshing authentication preserves uploads and their original destination', async () => {
	controlledUploads()
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => api.addImages([bigCsv('a.csv', 72)]))
	await render({ authToken: 'fresh', sessionId: 's1' })
	expect(requests[0]!.aborted).toBe(false)
	expect(api.selectedImages).toHaveLength(1)
})

test('unmounting cancels uploads and does not start queued work', async () => {
	controlledUploads()
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => api.addImages([1, 2, 3, 4].map((i) => bigCsv(`${i}.csv`, 72))))
	await act(async () => root.unmount())
	expect(requests).toHaveLength(3)
	expect(requests.every((r) => r.aborted)).toBe(true)
})

test('uploaded files do not consume the budget for pasted inline text', async () => {
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => api.addImages([bigCsv('a.csv', 72), bigCsv('b.csv', 72)]))
	await act(async () => {
		expect(api.addPastedText('small note')).toBe(true)
	})
	expect(api.selectedImages).toHaveLength(3)
})

test('does not eagerly read large files just to render their chips', async () => {
	await render({ authToken: 'tok', sessionId: 's1' })
	const file = bigCsv('large.csv', 72)
	const reads = [
		vi.spyOn(file, 'text'),
		vi.spyOn(file, 'arrayBuffer'),
		vi.spyOn(file, 'stream'),
		vi.spyOn(file, 'slice'),
		vi.spyOn(FileReader.prototype, 'readAsDataURL'),
		vi.spyOn(FileReader.prototype, 'readAsText'),
		vi.spyOn(FileReader.prototype, 'readAsArrayBuffer')
	]
	await act(async () => api.addImages([file]))
	expect(api.selectedImages.map((i) => i.file.name)).toEqual(['large.csv'])
	expect(reads.filter((read) => read.mock.calls.length > 0)).toEqual([])
	for (const read of reads) read.mockRestore()
})

test('reports every skipped file once with its reason and keeps accepted files', async () => {
	await render(null)
	await act(async () =>
		api.addImages([
			bigCsv('accepted.csv', 72),
			bigCsv('budget.csv', 72),
			bigCsv('oversized.csv', 101),
			new File(['x'], 'bad.exe')
		])
	)
	expect(api.selectedImages.map((i) => i.file.name)).toEqual(['accepted.csv'])
	expect(api.selectionFeedback?.skipped.map((i) => i.filename)).toEqual(['budget.csv', 'oversized.csv', 'bad.exe'])
	expect(api.selectionFeedback?.skipped[0].reason).toContain('100 MB')
	await act(async () => api.dismissSelectionFeedback())
	expect(api.selectionFeedback).toBeNull()
})

test('JSON and TSV files are selectable and use the workspace upload path', async () => {
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => api.addImages(['data.json', 'data.tsv', 'data.jsonl'].map((name) => new File(['x'], name))))
	expect(requests).toHaveLength(3)
	expect(api.selectionFeedback).toBeNull()
})

test('a full workspace is not offered as something to retry', async () => {
	FakeUpload.answer = (upload) =>
		queueMicrotask(() =>
			upload.reject(507, {
				error: 'File storage is full. Remove unused files before retrying.',
				code: 'STORAGE_QUOTA_EXCEEDED',
				retryable: false
			})
		)
	await render({ authToken: 'tok', sessionId: 's1' })
	await act(async () => {
		api.addImages([bigCsv('p1.csv', 72)])
	})
	expect(api.selectedImages[0].upload).toMatchObject({ status: 'error', retryable: false })

	// Retrying would hit the same full workspace, so the hook refuses to start another attempt.
	await act(async () => {
		api.retryUpload(api.selectedImages[0].id)
	})
	expect(requests).toHaveLength(1)
})
