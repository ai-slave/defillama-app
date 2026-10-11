import { AI_SERVER } from '~/constants'

export interface UploadedAttachment {
	id: string
	url: string
	mimeType: string
	filename: string
	size: number
	workspacePath?: string
	agentAccess?: string
	convertedFrom?: string
}

export interface UploadChatFileOptions {
	authToken: string
	file: File
	sessionId: string
	projectId?: string | null
	onProgress?: (fraction: number) => void
	signal?: AbortSignal
}

const UPLOAD_FAILED = "Couldn't upload the file."

// Every upload failure, worded for readers: the upload route's own `error` or the client's line. Carries whether
// trying again can help. A full workspace fails the same way on every attempt, so the composer must not offer a
// retry for it; a busy server clears on its own, so it should.
export class UploadError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly retryable: boolean
	) {
		super(message)
		this.name = 'UploadError'
	}
}

function parseError(responseText: string, status: number): UploadError {
	try {
		const parsed = JSON.parse(responseText)
		if (parsed && typeof parsed.error === 'string') {
			const code = typeof parsed.code === 'string' ? parsed.code : 'UPLOAD_FAILED'
			// An older server sends no flag; treat its failures as worth another try, as before.
			const retryable = typeof parsed.retryable === 'boolean' ? parsed.retryable : true
			// The upload route words every `error` for readers, a 507 full workspace included, and answers its own
			// faults with a generic line, so the text shows at any status.
			return new UploadError(parsed.error, code, retryable)
		}
	} catch {
		// A proxy can answer with HTML; fall through to the status.
	}
	if (status === 413) return new UploadError('File is too large for your plan', 'FILE_TOO_LARGE', false)
	return new UploadError(UPLOAD_FAILED, 'UPLOAD_FAILED', true)
}

// XMLHttpRequest rather than fetch: fetch cannot report upload progress, and these files are large
// enough that a bar is the difference between "working" and "frozen".
export function uploadChatFile({
	authToken,
	file,
	sessionId,
	projectId,
	onProgress,
	signal
}: UploadChatFileOptions): Promise<UploadedAttachment> {
	return new Promise<UploadedAttachment>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Upload cancelled', 'AbortError'))
			return
		}
		const params = new URLSearchParams({ sessionId })
		if (projectId) params.set('projectId', projectId)
		const form = new FormData()
		form.append('file', file, file.name)

		const xhr = new XMLHttpRequest()
		xhr.open('POST', `${AI_SERVER}/uploads?${params.toString()}`)
		xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)

		const abort = () => xhr.abort()
		signal?.addEventListener('abort', abort, { once: true })
		const done = () => signal?.removeEventListener('abort', abort)

		if (onProgress) {
			xhr.upload.addEventListener('progress', (event) => {
				if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total)
			})
		}

		xhr.addEventListener('load', () => {
			done()
			if (xhr.status < 200 || xhr.status >= 300) {
				reject(parseError(xhr.responseText, xhr.status))
				return
			}
			try {
				const attachment = JSON.parse(xhr.responseText)?.attachments?.[0]
				if (!attachment) {
					reject(new UploadError(UPLOAD_FAILED, 'UPLOAD_FAILED', true))
					return
				}
				resolve(attachment as UploadedAttachment)
			} catch {
				reject(new UploadError(UPLOAD_FAILED, 'UPLOAD_FAILED', true))
			}
		})
		xhr.addEventListener('error', () => {
			done()
			reject(new UploadError(UPLOAD_FAILED, 'NETWORK_ERROR', true))
		})
		xhr.addEventListener('abort', () => {
			done()
			reject(new DOMException('Upload cancelled', 'AbortError'))
		})

		xhr.send(form)
	})
}
