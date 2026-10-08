import * as Ariakit from '@ariakit/react'
import { useRef } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
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
	const status = errorMessage ? (
		<p role="alert" className="body-sm text-data-down">
			{errorMessage}
		</p>
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
						<Ariakit.Button
							type="button"
							onClick={open}
							disabled={isUploading}
							accessibleWhenDisabled
							aria-busy={isUploading || undefined}
							aria-label={`Replace ${name}`}
							className="group relative size-24 shrink-0 overflow-hidden rounded-full border border-medium transition-[border-color] not-aria-disabled:hover:border-link/50 aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-60"
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={currentUrl}
								alt=""
								className="size-full object-cover transition-opacity group-hover:opacity-70"
							/>
							<span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-page/0 label-sm text-on-brand opacity-0 transition-opacity group-hover:bg-research-backdrop-soft group-hover:opacity-100 group-aria-busy:bg-research-backdrop-soft group-aria-busy:opacity-100">
								{isUploading ? 'Uploading…' : 'Replace'}
							</span>
						</Ariakit.Button>
					) : (
						<Ariakit.Button
							type="button"
							onClick={open}
							disabled={isUploading}
							accessibleWhenDisabled
							aria-busy={isUploading || undefined}
							className="group flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-full border border-dashed border-medium bg-page text-tertiary transition-colors not-aria-disabled:hover:border-link/50 not-aria-disabled:hover:text-primary aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-50"
						>
							{isUploading ? <LoadingSpinner size={14} /> : <Icon name="image-plus" className="size-5" />}
							<span className="label-sm">{isUploading ? 'Uploading…' : 'Upload'}</span>
						</Ariakit.Button>
					)}
					<div className="flex min-w-0 flex-col gap-2 pt-1">
						<div className="flex flex-wrap gap-2">
							<Button
								ref={uploadRef}
								type="button"
								size="sm"
								onClick={open}
								pendingLabel={isUploading ? 'Uploading…' : null}
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
							<Ariakit.Button
								type="button"
								onClick={open}
								disabled={isUploading}
								accessibleWhenDisabled
								aria-busy={isUploading || undefined}
								aria-label={`Replace ${name}`}
								className="group relative block h-36 w-full overflow-hidden rounded-md border border-medium transition-[border-color] not-aria-disabled:hover:border-link/50 aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed"
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={currentUrl}
									alt=""
									className="size-full object-cover transition-opacity group-hover:opacity-70"
								/>
								<span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-research-invert/0 label-sm text-on-brand opacity-0 transition-opacity group-hover:bg-research-backdrop-soft group-hover:opacity-100 group-aria-busy:bg-research-backdrop-soft group-aria-busy:opacity-100">
									{isUploading ? 'Uploading…' : 'Replace'}
								</span>
							</Ariakit.Button>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									onClick={open}
									pendingLabel={isUploading ? 'Uploading…' : null}
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
						<Ariakit.Button
							ref={uploadRef}
							type="button"
							disabled={isUploading}
							accessibleWhenDisabled
							aria-busy={isUploading || undefined}
							onClick={open}
							className="group flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-medium bg-page text-tertiary transition-colors not-aria-disabled:hover:border-link/50 not-aria-disabled:hover:text-primary aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-50"
						>
							{isUploading ? <LoadingSpinner size={14} /> : <Icon name="image-plus" className="size-5" />}
							<span className="label-sm">{isUploading ? 'Uploading…' : `Upload ${name}`}</span>
						</Ariakit.Button>
					)}
					{status}
				</>
			)}
		</div>
	)
}
