// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest'
import { uploadChatFile } from '../uploadChatFile'

type Listener = (event?: any) => void

class FakeXhr {
	static last: FakeXhr
	listeners: Record<string, Listener> = {}
	upload = {
		listeners: {} as Record<string, Listener>,
		addEventListener(type: string, fn: Listener) {
			this.listeners[type] = fn
		}
	}
	headers: Record<string, string> = {}
	url = ''
	status = 200
	responseText = '{"attachments":[{"id":"1","filename":"a.csv","workspacePath":"uploads/s1/a.csv"}]}'
	sent: unknown
	constructor() {
		FakeXhr.last = this
	}
	addEventListener(type: string, fn: Listener) {
		this.listeners[type] = fn
	}
	emit(type: string, event?: any) {
		this.listeners[type]?.(event)
	}
	open(_method: string, url: string) {
		this.url = url
	}
	setRequestHeader(key: string, value: string) {
		this.headers[key] = value
	}
	send(body: unknown) {
		this.sent = body
	}
	abort() {
		this.emit('abort')
	}
}

afterEach(() => vi.unstubAllGlobals())

function stub() {
	vi.stubGlobal('XMLHttpRequest', FakeXhr)
	return new File(['protocol,tvl\n'], 'a.csv', { type: 'text/csv' })
}

test('posts the file to the session and returns the attachment', async () => {
	const file = stub()
	const promise = uploadChatFile({ authToken: 'tok', file, sessionId: 's1' })
	const xhr = FakeXhr.last
	expect(xhr.url).toContain('/uploads?sessionId=s1')
	expect(xhr.headers.Authorization).toBe('Bearer tok')
	expect(xhr.sent).toBeInstanceOf(FormData)
	xhr.emit('load')
	await expect(promise).resolves.toMatchObject({ workspacePath: 'uploads/s1/a.csv' })
})

test('carries the project so a draft chat in a project still routes there', async () => {
	const file = stub()
	const promise = uploadChatFile({ authToken: 'tok', file, sessionId: 's1', projectId: 'proj-9' })
	FakeXhr.last.emit('load')
	await promise
	expect(FakeXhr.last.url).toContain('projectId=proj-9')
})

test('reports upload progress as a fraction', async () => {
	const file = stub()
	const seen: Array<number> = []
	const promise = uploadChatFile({ authToken: 'tok', file, sessionId: 's1', onProgress: (f) => seen.push(f) })
	const xhr = FakeXhr.last
	xhr.upload.listeners.progress!({ lengthComputable: true, loaded: 25, total: 100 })
	xhr.upload.listeners.progress!({ lengthComputable: true, loaded: 100, total: 100 })
	// A browser can emit a progress event before the size is known; it must not become NaN.
	xhr.upload.listeners.progress!({ lengthComputable: false, loaded: 0, total: 0 })
	xhr.emit('load')
	await promise
	expect(seen).toEqual([0.25, 1])
})

test('surfaces the server message instead of a generic failure', async () => {
	const file = stub()
	const promise = uploadChatFile({ authToken: 'tok', file, sessionId: 's1' })
	const xhr = FakeXhr.last
	xhr.status = 413
	xhr.responseText = '{"error":"Project storage quota exceeded"}'
	xhr.emit('load')
	await expect(promise).rejects.toThrow('Project storage quota exceeded')
})

test('falls back to a readable message when the body is not JSON', async () => {
	const file = stub()
	const promise = uploadChatFile({ authToken: 'tok', file, sessionId: 's1' })
	const xhr = FakeXhr.last
	xhr.status = 413
	xhr.responseText = '<html>Request Entity Too Large</html>'
	xhr.emit('load')
	await expect(promise).rejects.toThrow('File is too large for your plan')
})

test('cancels through the abort signal', async () => {
	const file = stub()
	const controller = new AbortController()
	const promise = uploadChatFile({ authToken: 'tok', file, sessionId: 's1', signal: controller.signal })
	controller.abort()
	await expect(promise).rejects.toThrow('Upload cancelled')
})

test('does not send a request when its signal was already cancelled', async () => {
	const file = stub()
	const controller = new AbortController()
	controller.abort()
	const previous = FakeXhr.last
	await expect(uploadChatFile({ authToken: 'tok', file, sessionId: 's1', signal: controller.signal })).rejects.toThrow(
		'Upload cancelled'
	)
	expect(FakeXhr.last).toBe(previous)
})
