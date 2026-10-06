import { useRef, useState, useCallback, useContext, useEffect } from 'react'
import { uploadChatFile, type UploadedAttachment } from '~/containers/LlamaAI/api/uploadChatFile'
import type { UploadSelectionFeedback } from '~/containers/LlamaAI/components/UploadSelectionNotice'
import { UploadTargetContext } from '~/containers/LlamaAI/components/UploadTarget'
import type { OutgoingAttachment } from '~/containers/LlamaAI/mutationProtocol'
import type { AttachmentPreview } from '~/containers/LlamaAI/utils/attachmentPreview'
import { trackUmamiEvent } from '~/utils/analytics/umami'

export type AttachmentUpload =
	| { status: 'pending'; progress: 0 }
	| { status: 'uploading'; progress: number }
	| { status: 'done'; progress: 1; attachment: UploadedAttachment }
	// `retryable` is false only when the server said another attempt cannot help (a full workspace).
	| { status: 'error'; progress: 0; error: string; retryable?: boolean }

export function attachmentUploadMessage(images: ReadonlyArray<{ upload?: AttachmentUpload }>): string | null {
	let waiting = 0
	let uploading = 0
	let finishing = 0
	let failed = 0
	let blocked = 0
	for (const { upload } of images) {
		if (upload?.status === 'pending') waiting++
		else if (upload?.status === 'uploading') {
			if (upload.progress === 1) finishing++
			else uploading++
		} else if (upload?.status === 'error') {
			if (upload.retryable !== false) failed++
			else blocked++
		}
	}
	const parts: Array<string> = []
	if (uploading) parts.push(`Uploading ${uploading} ${uploading === 1 ? 'file' : 'files'}`)
	if (waiting) parts.push(`${waiting} waiting`)
	if (finishing) parts.push(`Finishing ${finishing} ${finishing === 1 ? 'upload' : 'uploads'}`)
	if (failed) parts.push(`Retry or remove ${failed} failed ${failed === 1 ? 'file' : 'files'}`)
	if (blocked) parts.push(`Remove ${blocked} ${blocked === 1 ? 'file' : 'files'} that cannot upload`)
	return parts.length > 0 ? parts.join(' · ') : null
}

interface SelectedImage {
	id: string
	file: File
	url: string
	isPasted?: boolean
	textContent?: string
	upload?: AttachmentUpload
}

// Where the server would put the file. A file it stores in the workspace never has to travel inside
// the message, so it is uploaded on its own and the message carries only its path.
// Matches the server's per-user upload cap. Going wider just earns a 429, and the server holds each
// file whole while it routes it, so the cap is protecting its memory rather than being cautious.
const UPLOAD_CONCURRENCY = 3
const LARGE_TEXT_INLINE_BYTES = 8 * 1024
const WORKSPACE_DATA_EXTENSIONS = ['.csv', '.tsv', '.json', '.jsonl', '.ndjson']

function goesToWorkspace(file: File) {
	const lower = file.name.toLowerCase()
	if (WORKSPACE_DATA_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true
	// A workbook or document is expanded server-side into those same data and PDF lanes.
	if (isOfficeFile(file)) return true
	return isReadableTextFile(file) && file.size > LARGE_TEXT_INLINE_BYTES
}

const ACCEPTED_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'application/pdf',
	'text/csv',
	'application/json',
	'text/tab-separated-values',
	'text/markdown',
	'text/plain',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-excel'
])
const ACCEPTED_EXTENSIONS = new Set([
	'.pdf',
	'.csv',
	'.tsv',
	'.json',
	'.jsonl',
	'.ndjson',
	'.md',
	'.txt',
	'.docx',
	'.doc',
	'.xlsx',
	'.xls'
])
export const CHAT_FILE_ACCEPT = [...ACCEPTED_TYPES, ...ACCEPTED_EXTENSIONS].join(',')
const IMAGE_MAX_SIZE = 10 * 1024 * 1024
const FILE_MAX_SIZE = 30 * 1024 * 1024
const DATA_FILE_MAX_SIZE = 100 * 1024 * 1024
const MAX_TOTAL_BYTES = 100 * 1024 * 1024

function isImageType(type: string) {
	return type.startsWith('image/')
}

function hasAcceptedExtension(name: string) {
	const lowerName = name.toLowerCase()
	for (const extension of ACCEPTED_EXTENSIONS) {
		if (lowerName.endsWith(extension)) return true
	}
	return false
}

function isAcceptedFile(file: File) {
	return ACCEPTED_TYPES.has(file.type) || hasAcceptedExtension(file.name)
}

const READABLE_TEXT_TYPES = new Set([
	'text/plain',
	'text/markdown',
	'text/csv',
	'application/json',
	'text/tab-separated-values'
])
const READABLE_TEXT_EXTENSIONS = ['.txt', '.md', ...WORKSPACE_DATA_EXTENSIONS]

export function isReadableTextFile(file: File): boolean {
	if (READABLE_TEXT_TYPES.has(file.type)) return true
	const lower = file.name.toLowerCase()
	return READABLE_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

const OFFICE_TYPES = new Set([
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/msword'
])
const OFFICE_EXTENSIONS = ['.xlsx', '.xls', '.docx', '.doc']

function isOfficeFile(file: File) {
	if (OFFICE_TYPES.has(file.type)) return true
	const lower = file.name.toLowerCase()
	return OFFICE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function maxSizeForFile(file: File) {
	if (isImageType(file.type)) return IMAGE_MAX_SIZE
	if (isReadableTextFile(file)) return DATA_FILE_MAX_SIZE
	// A workbook or document is converted server-side into the data and PDF lanes, so it gets the
	// same ceiling as a CSV rather than the generic binary one.
	if (isOfficeFile(file)) return DATA_FILE_MAX_SIZE
	return FILE_MAX_SIZE
}

export interface UploadContext {
	authToken: string
	sessionId: string
	projectId?: string | null
}

interface UploadJob {
	image: SelectedImage
	context: UploadContext
	controller: AbortController
}

interface UseImageUploadOptions {
	maxImages?: number
	maxSizeBytes?: number
	uploadContext?: UploadContext | null
}

// A conditional cannot be lowered inside the try that guards createObjectURL, but the call itself
// stays in there: it is the part that can fail.
function previewUrlFor(file: File) {
	return isImageType(file.type) ? URL.createObjectURL(file) : ''
}

export function useImageUpload({ maxImages = 15, maxSizeBytes, uploadContext }: UseImageUploadOptions = {}) {
	// The caller can name the target explicitly; otherwise it comes from whichever chat is mounted.
	const targetFromContext = useContext(UploadTargetContext)
	const target = uploadContext === undefined ? targetFromContext : uploadContext
	const [selectedImages, setSelectedImages] = useState<Array<SelectedImage>>([])
	const [selectionFeedback, setSelectionFeedback] = useState<UploadSelectionFeedback | null>(null)
	const [previewImage, setPreviewImage] = useState<string | null>(null)
	const [pastedPreview, setPastedPreview] = useState<AttachmentPreview | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const selectedImagesRef = useRef<Array<SelectedImage>>([])
	const uploadContextRef = useRef(target)
	const uploadQueueRef = useRef<Array<UploadJob>>([])
	const activeUploadsRef = useRef(new Map<string, UploadJob>())
	const pastedCounterRef = useRef(0)
	const attachmentCounterRef = useRef(0)

	const cancelUploads = useCallback(() => {
		uploadQueueRef.current = []
		for (const job of activeUploadsRef.current.values()) job.controller.abort()
	}, [])

	useEffect(() => {
		const previous = uploadContextRef.current
		uploadContextRef.current = target
		// A token refresh keeps the draft. A different destination cannot inherit its uploads.
		const sameSession = previous?.sessionId === target?.sessionId
		const sameProject = previous?.projectId === target?.projectId
		if (sameSession && sameProject) return
		cancelUploads()
		for (const image of selectedImagesRef.current) {
			if (image.url) URL.revokeObjectURL(image.url)
		}
		selectedImagesRef.current = []
		setSelectedImages([])
		setSelectionFeedback(null)
	}, [target, cancelUploads])

	useEffect(() => {
		return () => {
			cancelUploads()
			for (const { url } of selectedImagesRef.current) {
				if (url) URL.revokeObjectURL(url)
			}
		}
	}, [cancelUploads])

	const patchUpload = useCallback((id: string, upload: AttachmentUpload) => {
		const next = selectedImagesRef.current.map((img) => (img.id === id ? { ...img, upload } : img))
		selectedImagesRef.current = next
		setSelectedImages(next)
	}, [])

	const runUpload = useCallback(
		async ({ image, context, controller }: UploadJob) => {
			patchUpload(image.id, { status: 'uploading', progress: 0 })
			try {
				const attachment = await uploadChatFile({
					...context,
					file: image.file,
					signal: controller.signal,
					onProgress: (progress) => {
						if (!controller.signal.aborted) patchUpload(image.id, { status: 'uploading', progress })
					}
				})
				if (!controller.signal.aborted) patchUpload(image.id, { status: 'done', progress: 1, attachment })
			} catch (error) {
				if (controller.signal.aborted) return
				patchUpload(image.id, {
					status: 'error',
					progress: 0,
					error: error instanceof Error ? error.message : 'Upload failed',
					retryable: (error as { retryable?: unknown } | null)?.retryable !== false
				})
			}
		},
		[patchUpload]
	)

	const startUpload = useCallback(
		(image: SelectedImage) => {
			const context = uploadContextRef.current
			if (!context) return
			patchUpload(image.id, { status: 'pending', progress: 0 })
			// Bind the destination before waiting, so navigation cannot redirect a queued file.
			uploadQueueRef.current.push({ image, context, controller: new AbortController() })
			const pump = () => {
				while (activeUploadsRef.current.size < UPLOAD_CONCURRENCY && uploadQueueRef.current.length > 0) {
					const job = uploadQueueRef.current.shift()!
					activeUploadsRef.current.set(job.image.id, job)
					void runUpload(job).finally(() => {
						activeUploadsRef.current.delete(job.image.id)
						pump()
					})
				}
			}
			pump()
		},
		[patchUpload, runUpload]
	)

	const retryUpload = useCallback(
		(id: string) => {
			const image = selectedImagesRef.current.find((img) => img.id === id)
			if (image?.upload?.status === 'error' && image.upload.retryable !== false) startUpload(image)
		},
		[startUpload]
	)

	const addImages = useCallback(
		(files: Array<File>) => {
			if (files.length === 0) return
			const selected = selectedImagesRef.current
			const accepted: Array<SelectedImage> = []
			const skipped: UploadSelectionFeedback['skipped'] = []
			let inlineBytes = 0
			for (const image of selected) {
				if (!image.upload) inlineBytes += image.file.size
			}
			for (const file of files) {
				const uploadsToWorkspace = !!uploadContextRef.current && goesToWorkspace(file)
				const sizeLimit = maxSizeBytes ?? maxSizeForFile(file)
				let reason = ''
				if (!isAcceptedFile(file)) reason = 'Unsupported file type.'
				else if (file.size > sizeLimit)
					reason = `Exceeds the ${Math.round(sizeLimit / (1024 * 1024))} MB per-file limit.`
				else if (selected.length + accepted.length >= maxImages)
					reason = `You can attach up to ${maxImages} files per message.`
				else if (!uploadsToWorkspace && inlineBytes + file.size > MAX_TOTAL_BYTES)
					reason = 'Files sent inside a message share a 100 MB limit. Send these files in separate messages.'
				if (reason) {
					skipped.push({ filename: file.name, reason })
					continue
				}
				try {
					const url = previewUrlFor(file)
					attachmentCounterRef.current += 1
					accepted.push({ id: `file-${attachmentCounterRef.current}`, file, url })
					if (!uploadsToWorkspace) inlineBytes += file.size
				} catch {
					skipped.push({ filename: file.name, reason: 'Could not open this file. Select it again to retry.' })
				}
			}
			setSelectionFeedback(skipped.length > 0 ? { added: accepted.length, skipped } : null)
			if (accepted.length === 0) return
			const next = [...selected, ...accepted]
			selectedImagesRef.current = next
			setSelectedImages(next)
			for (const image of accepted) {
				if (uploadContextRef.current && goesToWorkspace(image.file)) startUpload(image)
			}
		},
		[maxImages, maxSizeBytes, startUpload]
	)

	const removeImage = useCallback((idx: number) => {
		const selected = selectedImagesRef.current
		const removed = selected[idx]
		uploadQueueRef.current = uploadQueueRef.current.filter((job) => job.image.id !== removed.id)
		activeUploadsRef.current.get(removed.id)?.controller.abort()
		if (removed?.url) URL.revokeObjectURL(removed.url)
		const nextImages = selected.filter((_, i) => i !== idx)
		selectedImagesRef.current = nextImages
		setSelectedImages(nextImages)
	}, [])

	const clearImages = useCallback(
		(revokeUrls = true) => {
			cancelUploads()
			const selected = selectedImagesRef.current
			if (revokeUrls) {
				for (const { url } of selected) {
					if (url) URL.revokeObjectURL(url)
				}
			}
			selectedImagesRef.current = []
			setSelectedImages([])
			setSelectionFeedback(null)
		},
		[cancelUploads]
	)

	const getSelectedImageIds = useCallback(() => selectedImagesRef.current.map(({ id }) => id), [])

	const handleImageSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files) {
				trackUmamiEvent('llamaai-image-upload')
				addImages(Array.from(e.target.files))
			}
			// Reset input to allow re-selecting the same file
			e.currentTarget.value = ''
		},
		[addImages]
	)

	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			const files = Array.from(e.clipboardData.items)
				.map((item) => item.getAsFile())
				.filter((file): file is File => Boolean(file))
			if (files.length > 0) {
				trackUmamiEvent('llamaai-file-paste')
				addImages(files)
			}
		},
		[addImages]
	)

	const addPastedText = useCallback(
		(text: string) => {
			if (!text) return false
			pastedCounterRef.current += 1
			const filename = `Pasted-${pastedCounterRef.current}.txt`
			const file = new File([text], filename, { type: 'text/plain', lastModified: Date.now() })
			const sizeLimit = maxSizeBytes ?? FILE_MAX_SIZE
			const selected = selectedImagesRef.current
			let inlineBytes = file.size
			for (const image of selected) {
				if (!image.upload) inlineBytes += image.file.size
			}
			let reason = ''
			if (file.size > sizeLimit)
				reason = `Pasted content exceeds the ${Math.round(sizeLimit / (1024 * 1024))} MB limit.`
			else if (selected.length >= maxImages) reason = `You can attach up to ${maxImages} files per message.`
			else if (inlineBytes > MAX_TOTAL_BYTES) reason = 'Files sent inside a message share a 100 MB limit.'
			if (reason) {
				setSelectionFeedback({ added: 0, skipped: [{ filename, reason }] })
				return false
			}
			setSelectionFeedback(null)

			attachmentCounterRef.current += 1
			const id = `paste-${attachmentCounterRef.current}`
			const nextImages = [...selected, { id, file, url: '', isPasted: true, textContent: text }]
			trackUmamiEvent('llamaai-paste-as-file')
			selectedImagesRef.current = nextImages
			setSelectedImages(nextImages)
			return true
		},
		[maxImages, maxSizeBytes]
	)

	const addDroppedFiles = useCallback(
		(files: Array<File>) => {
			trackUmamiEvent('llamaai-file-upload', { method: 'drag_and_drop', count: files.length })
			addImages(files)
		},
		[addImages]
	)

	const openFilePicker = useCallback(() => {
		fileInputRef.current?.click()
	}, [])

	return {
		selectedImages,
		selectionFeedback,
		dismissSelectionFeedback: () => setSelectionFeedback(null),
		uploadMessage: attachmentUploadMessage(selectedImages),
		previewImage,
		setPreviewImage,
		pastedPreview,
		setPastedPreview,
		fileInputRef,
		addImages,
		addPastedText,
		retryUpload,
		removeImage,
		clearImages,
		getSelectedImageIds,
		handleImageSelect,
		handlePaste,
		addDroppedFiles,
		openFilePicker
	}
}

// An attachment that already went up through POST /uploads travels as a path; everything else is
// still inlined as base64. Kept here rather than in the composer so it can be tested on its own.
export async function toSubmittedAttachments(
	images: Array<{ file: File; isPasted?: boolean; upload?: AttachmentUpload }>
): Promise<Array<OutgoingAttachment>> {
	// Workspace uploads must succeed before serialization; inlining a failed large file bypasses
	// the message budget. Only files deliberately selected for the inline path may use base64.
	for (const image of images) {
		if (image.upload && image.upload.status !== 'done') {
			throw new Error('Retry or remove unfinished attachments before sending.')
		}
	}
	return Promise.all(
		images.map((image) => {
			const uploaded = image.upload?.status === 'done' ? image.upload.attachment : undefined
			if (uploaded) {
				return Promise.resolve<OutgoingAttachment>({
					workspacePath: uploaded.workspacePath,
					mimeType: uploaded.mimeType,
					size: uploaded.size,
					filename: uploaded.filename ?? image.file.name,
					...(uploaded.url ? { data: uploaded.url } : {})
				})
			}
			return fileToBase64(image.file).then<OutgoingAttachment>((data) => ({
				data,
				mimeType: image.file.type,
				size: image.file.size,
				filename: image.file.name,
				...(image.isPasted ? { isPasted: true } : {})
			}))
		})
	)
}

export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.addEventListener('load', () => resolve(reader.result as string), { once: true })
		reader.addEventListener('error', reject, { once: true })
		reader.readAsDataURL(file)
	})
}
