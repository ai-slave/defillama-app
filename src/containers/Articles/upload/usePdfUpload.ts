import { useMutation } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { postUpload, UploadError, uploadErrorMessage } from './useImageUpload'

export type PdfUploadResult = {
	id: string
	url: string
	contentType: string
	sizeBytes: number
	originalName: string | null
}

const MAX_BYTES = 100 * 1024 * 1024
const ALLOWED_MIMES = new Set(['application/pdf'])

function validateClient(file: File): string | null {
	if (file.size === 0) return 'Empty file'
	if (file.size > MAX_BYTES) return 'File exceeds 100 MB limit'
	const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
	if (!looksLikePdf) return 'Only PDF files are allowed'
	if (file.type && !ALLOWED_MIMES.has(file.type)) return 'Only PDF files are allowed'
	return null
}

export function usePdfUpload(args: { articleId: string | null | undefined }) {
	const { authorizedFetch } = useAuthContext()

	const upload = useMutation({
		mutationFn: async (file: File): Promise<PdfUploadResult> => {
			const clientError = validateClient(file)
			if (clientError) throw new UploadError(clientError, 400)
			if (!args.articleId) throw new UploadError('Save the article before uploading a PDF', 400)
			return postUpload<PdfUploadResult>(authorizedFetch, 'pdf', file, {
				scope: 'report-pdf',
				articleId: args.articleId,
				originalName: file.name,
				mimeType: file.type || 'application/pdf'
			})
		}
	})
	const { mutateAsync: uploadFile } = upload

	return {
		uploadFile,
		isUploading: upload.isPending,
		errorMessage: uploadErrorMessage(upload.error, "Couldn't upload this PDF. Try again.")
	}
}
