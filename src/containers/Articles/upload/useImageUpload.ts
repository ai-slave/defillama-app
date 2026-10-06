import { useMutation, type MutationKey } from '@tanstack/react-query'
import { useCallback } from 'react'
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

export class UploadError extends Error {
	status: number
	constructor(message: string, status: number) {
		super(message)
		this.name = 'UploadError'
		this.status = status
	}
}

/** Client checks and the server's 4xx reasons name the fix; anything else is a plain retry. */
export function uploadErrorMessage(error: Error | null, retry: string) {
	if (!error) return null
	return error instanceof UploadError && error.status < 500 ? error.message : retry
}

/** Sends a file as base64 JSON to an upload route, the shape both image and PDF uploads use. */
export async function postUpload<T>(
	authorizedFetch: (url: string, init?: RequestInit) => Promise<Response | null>,
	route: 'image' | 'pdf',
	file: File,
	fields: Record<string, string>
): Promise<T> {
	const bytes = new Uint8Array(await file.arrayBuffer())
	let binary = ''
	const chunkSize = 0x80_00
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
	}
	const response = await authorizedFetch(`${FEATURES_SERVER}/uploads/${route}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...fields, dataBase64: btoa(binary) })
	})
	if (!response) throw new UploadError('Please sign in to continue', 401)
	const text = await response.text()
	const data = text ? JSON.parse(text) : null
	if (!response.ok) {
		const message =
			data && typeof data === 'object' && typeof data.error === 'string'
				? data.error
				: response.statusText || 'Upload failed'
		throw new UploadError(message, response.status)
	}
	return data as T
}

function validateClient(file: File): string | null {
	if (file.size === 0) return 'Empty file'
	if (file.size > MAX_BYTES) return 'File exceeds 8 MB limit'
	if (!ALLOWED_MIMES.has(file.type)) return 'Allowed formats: PNG, JPEG, WebP, GIF'
	return null
}

export function useImageUpload(args: { scope: UploadScope; articleId?: string | null; mutationKey?: MutationKey }) {
	const { authorizedFetch } = useAuthContext()

	const upload = useMutation({
		mutationKey: args.mutationKey,
		mutationFn: async ({
			file,
			articleId
		}: {
			file: File
			articleId: string | null | undefined
		}): Promise<UploadResult> => {
			const clientError = validateClient(file)
			if (clientError) throw new UploadError(clientError, 400)
			return postUpload<UploadResult>(authorizedFetch, 'image', file, {
				scope: args.scope,
				...(articleId ? { articleId } : {}),
				filename: file.name,
				mimeType: file.type
			})
		}
	})
	const { mutateAsync } = upload
	// Export callers may create the article immediately before uploading.
	const uploadFile = useCallback(
		(file: File, articleIdOverride?: string | null) =>
			mutateAsync({ file, articleId: articleIdOverride ?? args.articleId }),
		[mutateAsync, args.articleId]
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

	return {
		uploadFile,
		uploadWithToast,
		isUploading: upload.isPending,
		errorMessage: uploadErrorMessage(upload.error, "Couldn't upload this image. Try again.")
	}
}
