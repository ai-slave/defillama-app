import { useRef } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { type UploadResult, type UploadScope, useImageUpload } from './useImageUpload'

type Props = {
	scope: UploadScope
	articleId?: string | null
	currentUrl?: string | null
	onUploaded: (result: UploadResult) => void
	onCleared?: () => void
	label: string
	helperText?: string
	previewShape?: 'square' | 'wide'
}

export function ImageUploadButton({
	scope,
	articleId = null,
	currentUrl,
	onUploaded,
	onCleared,
	label,
	helperText,
	previewShape = 'wide'
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null)
	const { uploadFile, isUploading, errorMessage } = useImageUpload({ scope, articleId })

	const handleFile = async (file: File | null | undefined) => {
		if (!file) return
		// A failure shows under the control; the preview itself shows a success.
		await uploadFile(file).then(onUploaded, () => {})
		if (inputRef.current) inputRef.current.value = ''
	}
	const status = errorMessage ? (
		<p role="alert" className="body-sm text-data-down">
			{errorMessage}
		</p>
	) : helperText ? (
		<p className="body-sm text-tertiary">{helperText}</p>
	) : null

	const open = () => inputRef.current?.click()
	const isSquare = previewShape === 'square'

	return (
		<div className={isSquare ? 'flex items-start gap-4' : 'grid gap-2'}>
			<input
				ref={inputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
				className="sr-only"
				onChange={(e) => handleFile(e.target.files?.[0])}
			/>

			{isSquare ? (
				<>
					{currentUrl ? (
						<button
							type="button"
							onClick={open}
							disabled={isUploading}
							aria-label="Replace avatar"
							className="group relative size-24 shrink-0 overflow-hidden rounded-full border border-medium outline-hidden transition-[border-color] hover:border-link/50 focus-visible:border-link/70 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={currentUrl}
								alt=""
								className="size-full object-cover transition-opacity group-hover:opacity-70"
							/>
							<span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-page/0 label-sm text-on-brand opacity-0 transition-opacity group-hover:bg-research-backdrop-soft group-hover:opacity-100">
								{isUploading ? 'Uploading…' : 'Replace'}
							</span>
						</button>
					) : (
						<button
							type="button"
							onClick={open}
							disabled={isUploading}
							className="group flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-full border border-dashed border-medium bg-page text-tertiary transition-colors hover:border-link/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
						>
							<Icon name="image-plus" className="size-5" />
							<span className="label-sm">{isUploading ? 'Uploading…' : 'Upload'}</span>
						</button>
					)}
					<div className="flex min-w-0 flex-col gap-2 pt-1">
						<div className="flex flex-wrap gap-2">
							<Button type="button" size="sm" onClick={open} pendingLabel={isUploading ? 'Uploading…' : null}>
								{currentUrl ? 'Replace' : `Upload ${label.toLowerCase()}`}
							</Button>
							{currentUrl && onCleared ? (
								<Button type="button" size="sm" variant="ghost" disabled={isUploading} onClick={onCleared}>
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
							<button
								type="button"
								onClick={open}
								disabled={isUploading}
								aria-label="Replace cover image"
								className="group relative block h-36 w-full overflow-hidden rounded-md border border-medium outline-hidden transition-[border-color] hover:border-link/50 focus-visible:border-link/70 disabled:cursor-not-allowed"
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={currentUrl}
									alt=""
									className="size-full object-cover transition-opacity group-hover:opacity-70"
								/>
								<span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-research-invert/0 text-xs font-medium text-on-brand opacity-0 transition-opacity group-hover:bg-research-backdrop-soft group-hover:opacity-100">
									{isUploading ? 'Uploading…' : 'Replace'}
								</span>
							</button>
							<div className="flex flex-wrap gap-2">
								<Button type="button" size="sm" onClick={open} pendingLabel={isUploading ? 'Uploading…' : null}>
									Replace
								</Button>
								{onCleared ? (
									<Button type="button" size="sm" variant="ghost" disabled={isUploading} onClick={onCleared}>
										Remove
									</Button>
								) : null}
							</div>
						</div>
					) : (
						<button
							type="button"
							disabled={isUploading}
							onClick={open}
							className="group flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-medium bg-page text-tertiary transition-colors hover:border-link/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
						>
							<Icon name="image-plus" className="size-5" />
							<span className="text-xs font-medium">
								{isUploading ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
							</span>
						</button>
					)}
					{status}
				</>
			)}
		</div>
	)
}
