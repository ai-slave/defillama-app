import { useId, useState, type RefObject } from 'react'
import { ImagePreviewModal } from '~/containers/LlamaAI/components/ImagePreviewModal'
import { isReadableTextFile } from '~/containers/LlamaAI/hooks/useImageUpload'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { formatFixedNumber } from '~/utils/numberFormat'

interface SelectedImage {
	id: string
	file: File
	url: string
	isPasted?: boolean
	textContent?: string
}

interface TextPreview {
	content: string
	filename: string
	isPasted?: boolean
}

interface ImageUploadProps {
	disabled?: boolean
	selectedImages: Array<SelectedImage>
	previewImage: string | null
	setPreviewImage: (url: string | null) => void
	openPastedPreview?: (preview: TextPreview | null) => void
	removeImage: (idx: number) => void
	fileInputRef: RefObject<HTMLInputElement | null>
	handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function formatBytes(byteLength: number): string {
	if (byteLength < 1024) return `${byteLength} B`
	const kb = byteLength / 1024
	if (kb < 1024) return `${kb < 10 ? formatFixedNumber(kb, 1) : Math.round(kb)} KB`
	return `${formatFixedNumber(kb / 1024, 1)} MB`
}

function fileExtensionLabel(name: string): string {
	const dot = name.lastIndexOf('.')
	if (dot === -1 || dot === name.length - 1) return 'TXT'
	return name
		.slice(dot + 1)
		.toUpperCase()
		.slice(0, 4)
}

export function TextChip({
	name,
	sizeBytes,
	textContent,
	isPasted,
	onOpen,
	onRemove
}: {
	name: string
	sizeBytes: number
	textContent: string
	isPasted: boolean
	onOpen: () => void | Promise<void>
	onRemove?: () => void
}) {
	const statusId = useId()
	const [openStatus, setOpenStatus] = useState<'idle' | 'pending' | 'error'>('idle')
	const handleOpen = async () => {
		if (openStatus === 'pending') return
		setOpenStatus('pending')
		try {
			await onOpen()
			setOpenStatus('idle')
		} catch {
			setOpenStatus('error')
		}
	}
	const topLine = isPasted
		? (textContent.split('\n').find((line) => line.trim().length > 0) ?? '').trim() || name
		: name
	const badgeLabel = isPasted ? 'Pasted' : fileExtensionLabel(name)
	const size = formatBytes(sizeBytes)
	const removeLabel = isPasted ? 'Remove pasted content' : 'Remove file'
	return (
		<div className="group relative w-60 max-w-full min-w-0">
			<button
				type="button"
				onClick={handleOpen}
				aria-label={isPasted ? 'Open pasted content' : `Open ${name}`}
				aria-disabled={openStatus === 'pending'}
				aria-busy={openStatus === 'pending'}
				aria-describedby={openStatus === 'error' ? statusId : undefined}
				className="flex min-h-16 w-full cursor-pointer flex-col gap-1.5 rounded-lg border border-medium bg-surface px-3 py-2 text-left not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:focus-ring aria-disabled:cursor-progress"
			>
				<p className={`line-clamp-2 w-full body-sm font-medium wrap-anywhere text-primary ${onRemove ? 'pr-5' : ''}`}>
					{topLine}
				</p>
				<div className="flex items-center gap-1.5">
					<span className="body-sm text-secondary">{badgeLabel}</span>
					<span aria-hidden className="text-tertiary">
						·
					</span>
					<span className="body-sm text-secondary">{size}</span>
					{openStatus === 'pending' ? (
						<span role="status" aria-label="Opening attachment">
							<LoadingSpinner size={14} />
						</span>
					) : null}
				</div>
			</button>
			{openStatus === 'error' ? (
				<p id={statusId} role="alert" className="mt-1 body-sm text-error">
					Couldn&apos;t open file. Select it to try again.
				</p>
			) : null}
			{onRemove ? (
				<button type="button" onClick={onRemove} aria-label={removeLabel} className={ATTACHMENT_REMOVE_BUTTON}>
					<Icon name="x" height={14} width={14} />
				</button>
			) : null}
		</div>
	)
}

// Sits over the attachment thumbnail, so it is a dim chip rather than a themed button.
const ATTACHMENT_REMOVE_BUTTON =
	'absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-screen-dim text-on-brand not-disabled:not-aria-disabled:hover:bg-ai-black/80'

export function ImageUpload({
	disabled = false,
	selectedImages,
	previewImage,
	setPreviewImage,
	openPastedPreview,
	removeImage,
	fileInputRef,
	handleImageSelect
}: ImageUploadProps) {
	return (
		<>
			<input
				ref={fileInputRef}
				type="file"
				accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/csv,.pdf,.csv,text/markdown,text/plain,.md,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.docx,.doc,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.xlsx"
				multiple
				disabled={disabled}
				onChange={handleImageSelect}
				className="hidden"
			/>
			{selectedImages.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{selectedImages.map(({ id, file, url, isPasted, textContent }, idx) => {
						const isImage = file.type.startsWith('image/')
						const isTextChip = !!isPasted || isReadableTextFile(file)

						if (isTextChip) {
							return (
								<TextChip
									key={id}
									name={file.name}
									sizeBytes={file.size}
									textContent={textContent ?? ''}
									isPasted={!!isPasted}
									onOpen={async () => {
										let content = textContent
										if (typeof content !== 'string') {
											content = await file.text()
										}
										openPastedPreview?.({
											content,
											filename: file.name,
											isPasted: !!isPasted
										})
									}}
									onRemove={disabled ? undefined : () => removeImage(idx)}
								/>
							)
						}

						return (
							<div key={id} className={`relative overflow-hidden rounded-lg ${isImage ? 'size-16' : 'h-16 w-auto'}`}>
								{isImage ? (
									<button type="button" onClick={() => setPreviewImage(url)} className="size-full cursor-pointer">
										<img src={url} alt={file.name} className="size-full object-cover" />
									</button>
								) : (
									<div className="flex h-full items-center gap-2 rounded-lg border border-medium bg-page px-3">
										<Icon name="file-text" height={16} width={16} className="text-secondary" />
										<span className="max-w-[120px] truncate body-sm text-primary">{file.name}</span>
									</div>
								)}
								{disabled ? null : (
									<button
										type="button"
										onClick={() => removeImage(idx)}
										aria-label="Remove file"
										className={ATTACHMENT_REMOVE_BUTTON}
									>
										<Icon name="x" height={14} width={14} />
									</button>
								)}
							</div>
						)
					})}
				</div>
			) : null}
			<ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} source="input-preview" />
		</>
	)
}

interface ImageUploadButtonProps {
	onClick: () => void
	disabled?: boolean
}

export function ImageUploadButton({ onClick, disabled = false }: ImageUploadButtonProps) {
	return (
		<Tooltip
			content="Attach file (or paste with Ctrl+V)"
			render={<Button type="button" size="md" square onClick={onClick} aria-label="Attach file" disabled={disabled} />}
		>
			<Icon name="paperclip" height={16} width={16} />
		</Tooltip>
	)
}

interface DragOverlayProps {
	isDragging: boolean
	externalDragging?: boolean
}

export function DragOverlay({ isDragging, externalDragging }: DragOverlayProps) {
	if (!isDragging && !externalDragging) return null

	return (
		<div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-brand bg-brand/10 backdrop-blur-[2px]">
			<div className="flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" fill="none">
					<path
						d="M6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<path
						d="M18 6L18 21M18 21L22.5 16.5M18 21L13.5 16.5"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
				<span className="body-md text-primary">Drop files here</span>
			</div>
		</div>
	)
}
