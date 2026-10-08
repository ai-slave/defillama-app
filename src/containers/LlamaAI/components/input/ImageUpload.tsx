import * as Ariakit from '@ariakit/react'
import { useId, useState, type RefObject } from 'react'
import { composerField, focusComposerOnLeave } from '~/containers/LlamaAI/components/ComposerTray'
import { ImagePreviewModal } from '~/containers/LlamaAI/components/ImagePreviewModal'
import { type AttachmentUpload, CHAT_FILE_ACCEPT, isReadableTextFile } from '~/containers/LlamaAI/hooks/useImageUpload'
import { readFilePreview, type AttachmentPreview } from '~/containers/LlamaAI/utils/attachmentPreview'
import { Button } from '~/ui/Button'
import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { formatFixedNumber } from '~/utils/numberFormat'

interface SelectedImage {
	id: string
	file: File
	url: string
	isPasted?: boolean
	textContent?: string
	upload?: AttachmentUpload
}

function UploadStatus({
	name,
	upload,
	onRetry,
	disabled
}: {
	name: string
	upload: AttachmentUpload
	onRetry: () => void
	disabled: boolean
}) {
	const errorId = useId()
	if (upload.status === 'error') {
		return (
			<Ariakit.PopoverProvider>
				<div className="flex h-6 items-center justify-between gap-2 px-2.5">
					<span id={errorId} role="alert" className="sr-only">
						{name}: {upload.error}
					</span>
					<Ariakit.PopoverDisclosure
						aria-label={`Upload error for ${name}`}
						aria-describedby={errorId}
						className="flex h-6 items-center gap-1 rounded-sm body-sm text-error hover:bg-error-tint"
					>
						Failed <Icon name="help-circle" height={14} width={14} />
					</Ariakit.PopoverDisclosure>
					{upload.retryable !== false ? (
						<Tooltip
							content="Try again"
							render={
								<Button
									type="button"
									variant="secondary"
									size="sm"
									square
									// Retrying replaces the failed strip, Retry with it; the composer's prompt field takes focus.
									ref={focusComposerOnLeave}
									onClick={onRetry}
									disabled={disabled}
									aria-label={`Retry upload ${name}`}
									aria-describedby={errorId}
								/>
							}
						>
							<Icon name="repeat" className="size-4" />
						</Tooltip>
					) : null}
				</div>
				<PopoverSurface variant="panel" heading={`Upload error for ${name}`} className="sm:max-w-64">
					<p className="p-3 body-sm break-words text-primary">{upload.error}</p>
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		)
	}
	const finishing = upload.status === 'uploading' && upload.progress === 1
	const label =
		upload.status === 'pending'
			? 'Waiting to upload'
			: upload.status === 'done'
				? 'Ready'
				: finishing
					? 'Finishing upload…'
					: 'Uploading'
	return (
		<div className="flex h-6 flex-col px-2.5 pb-2">
			<span role="status" className="sr-only">
				{name}: {label}
			</span>
			<div aria-hidden="true" className="flex items-center gap-1.5 body-sm text-secondary">
				{upload.status === 'done' ? (
					<Icon name="check" height={14} width={14} className="text-link" />
				) : upload.status === 'pending' ? (
					<Icon name="clock" height={14} width={14} />
				) : (
					<LoadingSpinner size={14} />
				)}
				<span>
					{label}
					{upload.status === 'uploading' && !finishing ? ` · ${Math.round(upload.progress * 100)}%` : ''}
				</span>
			</div>
			{upload.status === 'uploading' && !finishing ? (
				<div
					role="progressbar"
					aria-label={`Uploading ${name}`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(upload.progress * 100)}
					className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-lg bg-surface-elevated-1"
				>
					<div
						className="h-full bg-brand motion-safe:transition-[width]"
						style={{ width: `${Math.round(upload.progress * 100)}%` }}
					/>
				</div>
			) : null}
		</div>
	)
}

interface ImageUploadProps {
	disabled?: boolean
	selectedImages: Array<SelectedImage>
	previewImage: string | null
	setPreviewImage: (url: string | null) => void
	openPastedPreview?: (preview: AttachmentPreview | null) => void
	retryUpload: (id: string) => void
	uploadMessage: string | null
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
	onRemove,
	upload,
	onRetry,
	disabled = false
}: {
	name: string
	sizeBytes: number | undefined
	textContent: string
	isPasted: boolean
	onOpen?: () => void | Promise<void>
	onRemove?: (button: HTMLButtonElement) => void
	upload?: AttachmentUpload
	onRetry?: () => void
	disabled?: boolean
}) {
	const statusId = useId()
	const [openStatus, setOpenStatus] = useState<'idle' | 'pending' | 'error'>('idle')
	const handleOpen = async () => {
		if (!onOpen) return
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
	const size = sizeBytes === undefined ? null : formatBytes(sizeBytes)
	const removeLabel = isPasted ? 'Remove pasted content' : `Remove ${name}`
	const Header = onOpen ? 'button' : 'div'
	return (
		<div className="group relative w-56 max-w-full min-w-0 rounded-lg border border-medium bg-surface">
			<Header
				type={onOpen ? 'button' : undefined}
				onClick={onOpen ? handleOpen : undefined}
				aria-label={onOpen ? (isPasted ? 'Open pasted content' : `Open ${name}`) : undefined}
				aria-disabled={openStatus === 'pending'}
				aria-busy={openStatus === 'pending'}
				aria-describedby={openStatus === 'error' ? statusId : undefined}
				className={`flex min-h-14 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ${onOpen ? 'cursor-pointer hover:bg-hover-row focus-visible:focus-ring aria-disabled:cursor-progress' : ''}`}
			>
				<Icon name="file-text" height={16} width={16} className="shrink-0 text-secondary" />
				<div className={`min-w-0 flex-1 ${onRemove ? 'pr-5' : ''}`}>
					<p title={topLine} className="truncate label-sm text-primary">
						{topLine}
					</p>
					<div className="flex items-center gap-1.5">
						<span className="body-sm text-secondary">{badgeLabel}</span>
						{size ? (
							<>
								<span aria-hidden className="text-tertiary">
									·
								</span>
								<span className="body-sm text-secondary">{size}</span>
							</>
						) : null}
						{openStatus === 'pending' ? (
							<span role="status" aria-label="Opening attachment">
								<LoadingSpinner size={14} />
							</span>
						) : null}
					</div>
				</div>
			</Header>
			{openStatus === 'error' ? (
				<p id={statusId} role="alert" className="mt-1 body-sm text-error">
					Couldn&apos;t open file. Select it to try again.
				</p>
			) : null}
			{upload && onRetry ? <UploadStatus name={name} upload={upload} onRetry={onRetry} disabled={disabled} /> : null}
			{onRemove ? (
				<button
					type="button"
					data-attachment-remove
					onClick={(event) => onRemove(event.currentTarget)}
					aria-label={removeLabel}
					className={ATTACHMENT_REMOVE_BUTTON}
				>
					<Icon name="x" height={14} width={14} />
				</button>
			) : null}
		</div>
	)
}

/** The attachment leaves with its remove button: the next attachment's remove takes focus, else the previous one's,
    else the prompt field. Image and file attachments differ in layout, so the neighbour's remove is found by name. */
function removeAttachment(button: HTMLElement, remove: () => void) {
	const row = button.closest('[data-attachment]')!
	const next = neighbourRowControl(row, row)?.querySelector<HTMLElement>('[data-attachment-remove]')
	keepFocus(remove, () => next ?? composerField())
}

const ATTACHMENT_REMOVE_BUTTON =
	'absolute top-1 right-1 flex size-6 items-center justify-center rounded-md bg-surface text-secondary hover:bg-hover-row hover:text-primary'

export function ImageUpload({
	disabled = false,
	selectedImages,
	previewImage,
	setPreviewImage,
	openPastedPreview,
	removeImage,
	retryUpload,
	uploadMessage,
	fileInputRef,
	handleImageSelect
}: ImageUploadProps) {
	return (
		<>
			<input
				ref={fileInputRef}
				type="file"
				accept={CHAT_FILE_ACCEPT}
				multiple
				disabled={disabled}
				onChange={handleImageSelect}
				className="hidden"
			/>
			{selectedImages.length > 0 ? (
				<div className="flex flex-wrap items-start gap-2">
					{selectedImages.map(({ id, file, url, isPasted, textContent, upload }, idx) => {
						const isImage = file.type.startsWith('image/')
						const isTextChip = !!isPasted || isReadableTextFile(file)

						if (!isImage) {
							return (
								<div key={id} data-attachment className="max-w-full">
									<TextChip
										upload={upload}
										onRetry={() => retryUpload(id)}
										disabled={disabled}
										name={file.name}
										sizeBytes={file.size}
										textContent={textContent ?? ''}
										isPasted={!!isPasted}
										onOpen={
											isTextChip
												? async () => {
														openPastedPreview?.({ ...(await readFilePreview(file)), isPasted: !!isPasted })
													}
												: undefined
										}
										onRemove={disabled ? undefined : (button) => removeAttachment(button, () => removeImage(idx))}
									/>
								</div>
							)
						}

						return (
							<div key={id} data-attachment className="relative w-20 overflow-hidden rounded-lg">
								<button
									type="button"
									aria-label={`Preview ${file.name}`}
									onClick={() => setPreviewImage(url)}
									className="size-20 cursor-pointer"
								>
									<img src={url} alt={file.name} className="size-full object-cover" />
								</button>
								{upload ? (
									<UploadStatus name={file.name} upload={upload} onRetry={() => retryUpload(id)} disabled={disabled} />
								) : null}
								{disabled ? null : (
									<button
										type="button"
										data-attachment-remove
										onClick={(event) => removeAttachment(event.currentTarget, () => removeImage(idx))}
										aria-label={`Remove ${file.name}`}
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
			{uploadMessage ? (
				<p role="status" className="sr-only">
					{uploadMessage}
				</p>
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
