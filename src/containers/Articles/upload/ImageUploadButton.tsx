import { useRef } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { InlineStatus } from '~/ui/Status'
import { ImageReplaceTile, UploadTile } from '~/ui/UploadTile'
import { type UploadResult, type UploadScope, useImageUpload } from './useImageUpload'

type Props = {
	scope: UploadScope
	articleId?: string | null
	currentUrl: string | null
	onUploaded: (result: UploadResult) => void
	onCleared: () => void
	/** What the image is, lower case, e.g. "sponsor logo": it names every control. */
	label: string
	helperText?: string
	previewShape: 'square' | 'wide'
}

export function ImageUploadButton({
	scope,
	articleId = null,
	currentUrl,
	onUploaded,
	onCleared,
	label,
	helperText,
	previewShape
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null)
	// The upload control that stays or appears once the image is removed.
	const uploadRef = useRef<HTMLButtonElement>(null)
	const { uploadFile, isUploading, errorMessage } = useImageUpload({ scope, articleId })

	const handleFile = async (file: File | null | undefined) => {
		if (!file) return
		// A failure shows under the control; the preview itself shows a success.
		await uploadFile(file).then(onUploaded, () => {})
		if (inputRef.current) inputRef.current.value = ''
	}
	// Re-picking the file is the retry: the upload control sits right beside the error.
	const status = errorMessage ? (
		<InlineStatus variant="error">{errorMessage}</InlineStatus>
	) : helperText ? (
		<p className="body-sm text-tertiary">{helperText}</p>
	) : null

	const open = () => inputRef.current?.click()
	// Remove leaves with the image, so the upload control takes its focus.
	const clear = () => keepFocus(onCleared, () => uploadRef.current)
	const name = label.toLowerCase()
	const isSquare = previewShape === 'square'

	return (
		<div className={isSquare ? 'flex items-start gap-4' : 'grid gap-2'}>
			<input
				ref={inputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
				hidden
				onChange={(e) => handleFile(e.target.files?.[0])}
			/>

			{isSquare ? (
				<>
					{currentUrl ? (
						<ImageReplaceTile
							shape="round"
							src={currentUrl}
							pendingLabel="Uploading…"
							pending={isUploading}
							onClick={open}
							aria-label={`Replace ${name}`}
						/>
					) : (
						<UploadTile
							shape="round"
							icon="image-plus"
							label="Upload"
							pendingLabel="Uploading…"
							pending={isUploading}
							onClick={open}
						/>
					)}
					<div className="flex min-w-0 flex-col gap-2 pt-1">
						<div className="flex flex-wrap gap-2">
							<Button
								ref={uploadRef}
								type="button"
								size="sm"
								onClick={open}
								pendingLabel="Uploading…"
								pending={isUploading}
								aria-label={currentUrl ? `Replace ${name}` : undefined}
							>
								{currentUrl ? 'Replace' : `Upload ${name}`}
							</Button>
							{currentUrl ? (
								<Button
									type="button"
									size="sm"
									variant="ghost"
									disabled={isUploading}
									onClick={clear}
									aria-label={`Remove ${name}`}
								>
									Remove
								</Button>
							) : null}
						</div>
						{status}
					</div>
				</>
			) : (
				<>
					{currentUrl ? (
						<div className="grid gap-2">
							<ImageReplaceTile
								shape="wide"
								src={currentUrl}
								pendingLabel="Uploading…"
								pending={isUploading}
								onClick={open}
								aria-label={`Replace ${name}`}
							/>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									onClick={open}
									pendingLabel="Uploading…"
									pending={isUploading}
									aria-label={`Replace ${name}`}
								>
									Replace
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									disabled={isUploading}
									onClick={clear}
									aria-label={`Remove ${name}`}
								>
									Remove
								</Button>
							</div>
						</div>
					) : (
						<UploadTile
							ref={uploadRef}
							shape="wide"
							icon="image-plus"
							label={`Upload ${name}`}
							pendingLabel="Uploading…"
							pending={isUploading}
							onClick={open}
						/>
					)}
					{status}
				</>
			)}
		</div>
	)
}
