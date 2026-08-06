import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { FEATURES_SERVER } from '~/constants'

export type UploadScope =
	| 'avatar'
	| 'article-cover'
	| 'article-inline'
	| 'banner-image'
	| 'banner-image-horizontal'
	| 'banner-landing-desktop'
	| 'banner-landing-mobile'
	| 'banner-landing-square'
	| 'promo-card'
	| 'report-carousel'
	| 'report-sponsor-logo'
	| 'trusted-logo'

export type UploadResult = {
	id: string
	url: string
	contentType: string
	sizeBytes: number
	width: number
	height: number
}

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export class ImageUploadError extends Error {
	status: number
	constructor(message: string, status = 400) {
		super(message)
		this.name = 'ImageUploadError'
		this.status = status
	}
}

function uploadUrl() {
	return `${FEATURES_SERVER.replace(/\/$/, '')}/uploads/image`
}

function validateClient(file: File): string | null {
	if (!file) return 'No file selected'
	if (file.size === 0) return 'Empty file'
	if (file.size > MAX_BYTES) return 'File exceeds 8 MB limit'
	if (!ALLOWED_MIMES.has(file.type)) return 'Allowed formats: PNG, JPEG, WebP, GIF'
	return null
}

async function fileToBase64(file: File): Promise<string> {
	const buf = await file.arrayBuffer()
	const bytes = new Uint8Array(buf)
	let binary = ''
	const chunkSize = 0x8000
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
	}
	return btoa(binary)
}

export function buildUploadPayload(args: {
	scope: UploadScope
	filename: string
	mimeType: string
	dataBase64: string
	articleId?: string | null
}) {
	return {
		scope: args.scope,
		...(args.articleId ? { articleId: args.articleId } : {}),
		filename: args.filename,
		mimeType: args.mimeType,
		dataBase64: args.dataBase64
	}
}

export function useImageUpload(args: { scope: UploadScope; articleId?: string | null }) {
	const { authorizedFetch } = useAuthContext()
	const [isUploading, setIsUploading] = useState(false)

	// articleIdOverride: callers that only learn the article id at upload time
	// (e.g. the LlamaAI export modal, which may create the draft first) pass it here.
	const uploadFile = useCallback(
		async (file: File, articleIdOverride?: string | null): Promise<UploadResult> => {
			const clientError = validateClient(file)
			if (clientError) throw new ImageUploadError(clientError, 400)

			const dataBase64 = await fileToBase64(file)
			const payload = buildUploadPayload({
				scope: args.scope,
				articleId: articleIdOverride ?? args.articleId,
				filename: file.name,
				mimeType: file.type,
				dataBase64
			})

			setIsUploading(true)
			try {
				const response = await authorizedFetch(uploadUrl(), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				})
				if (!response) throw new ImageUploadError('Please sign in to continue', 401)
				const text = await response.text()
				const data = text ? JSON.parse(text) : null
				if (!response.ok) {
					const message =
						data && typeof data === 'object' && typeof data.error === 'string'
							? data.error
							: response.statusText || 'Upload failed'
					throw new ImageUploadError(message, response.status)
				}
				return data as UploadResult
			} finally {
				setIsUploading(false)
			}
		},
		[args.scope, args.articleId, authorizedFetch]
	)

	const uploadWithToast = useCallback(
		async (file: File): Promise<UploadResult> => {
			return toast.promise(uploadFile(file), {
				loading: 'Uploading…',
				success: 'Uploaded',
				error: (err) => (err instanceof Error ? err.message : 'Upload failed')
			})
		},
		[uploadFile]
	)

	return { uploadFile, uploadWithToast, isUploading }
}
