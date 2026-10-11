import { useRef } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { MetaLine } from '~/ui/MetaLine'
import { InlineStatus } from '~/ui/Status'
import { UploadTile } from '~/ui/UploadTile'
import { formatFixedNumber } from '~/utils/numberFormat'
import type { ArticlePdf } from '../types'
import { type PdfUploadResult, usePdfUpload } from './usePdfUpload'

type Props = {
	articleId: string | null | undefined
	currentPdf: ArticlePdf | null | undefined
	onUploaded: (result: PdfUploadResult) => void
	onCleared: () => void
	helperText?: string
}

function formatSize(bytes: number): string {
	if (bytes <= 0) return '—'
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${formatFixedNumber(bytes / 1024, 1)} KB`
	return `${formatFixedNumber(bytes / 1024 / 1024, 1)} MB`
}

export function PdfUploadButton({ articleId, currentPdf, onUploaded, onCleared, helperText }: Props) {
	const inputRef = useRef<HTMLInputElement>(null)
	// Remove leaves with the file, so the upload control that replaces it takes its focus.
	const uploadRef = useRef<HTMLButtonElement>(null)
	const { uploadFile, isUploading, errorMessage } = usePdfUpload({ articleId })

	const handleFile = async (file: File | null | undefined) => {
		if (!file) return
		// A failure shows under the control; the file row itself shows a success.
		await uploadFile(file).then(onUploaded, () => {})
		if (inputRef.current) inputRef.current.value = ''
	}

	const open = () => inputRef.current?.click()
	const disabled = isUploading || !articleId

	return (
		<div className="grid gap-2">
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf,.pdf"
				hidden
				onChange={(e) => handleFile(e.target.files?.[0])}
			/>
			{currentPdf ? (
				<div className="grid gap-2">
					<div className="flex items-center gap-3 rounded-md border border-medium bg-surface p-3">
						<Icon name="file-text" className="size-6 shrink-0 text-link" />
						<div className="flex min-w-0 flex-col">
							<a
								href={currentPdf.url}
								target="_blank"
								rel="noopener noreferrer"
								className="truncate label-md text-primary hover:text-link"
							>
								{currentPdf.originalName || 'report.pdf'}
							</a>
							<MetaLine>
								{formatSize(currentPdf.sizeBytes)}
								{currentPdf.pageCount ? `${currentPdf.pageCount} pages` : null}
							</MetaLine>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							disabled={!articleId}
							onClick={open}
							pendingLabel="Uploading…"
							pending={isUploading}
						>
							Replace PDF
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							disabled={disabled}
							onClick={() => keepFocus(onCleared, () => uploadRef.current)}
						>
							Remove
						</Button>
					</div>
				</div>
			) : (
				<UploadTile
					ref={uploadRef}
					shape="wide"
					icon="file-text"
					label="Upload PDF"
					pendingLabel="Uploading…"
					pending={isUploading}
					disabled={!articleId}
					onClick={open}
				/>
			)}
			{/* Re-picking the file is the retry: the upload control sits right above the error. */}
			{errorMessage ? (
				<InlineStatus variant="error">{errorMessage}</InlineStatus>
			) : helperText ? (
				<p className="body-sm text-tertiary">{helperText}</p>
			) : null}
			{!articleId ? <p className="body-sm text-tertiary">Save the article first to enable PDF upload.</p> : null}
		</div>
	)
}
