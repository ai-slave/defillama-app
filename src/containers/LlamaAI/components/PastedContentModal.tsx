import * as Ariakit from '@ariakit/react'
import { useEffect, useMemo, useState } from 'react'
import { CODE_BLOCK } from '~/containers/LlamaAI/components/codeBlockStyles'
import type { AttachmentPreview } from '~/containers/LlamaAI/utils/attachmentPreview'
import { Button } from '~/ui/Button'
import { DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { downloadBlob } from '~/utils/download'
import { formatNumber, formatFixedNumber } from '~/utils/numberFormat'

interface PastedContentModalProps {
	preview: AttachmentPreview | null
	onClose: () => void
}

function formatBytes(byteLength: number): string {
	if (byteLength < 1024) return `${byteLength} B`
	const kb = byteLength / 1024
	if (kb < 1024) return `${kb < 10 ? formatFixedNumber(kb, 1) : Math.round(kb)} KB`
	return `${formatFixedNumber(kb / 1024, 1)} MB`
}

export function PastedContentModal({ preview, onClose }: PastedContentModalProps) {
	return (
		<Ariakit.DialogProvider open={!!preview} setOpen={(open) => !open && onClose()}>
			<Ariakit.Dialog className={`${dialogSurfaceStyles} [--dialog-width:820px]`} portal unmountOnHide>
				{preview ? <TextPreview key={preview.filename} preview={preview} /> : null}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

function TextPreview({ preview }: { preview: NonNullable<PastedContentModalProps['preview']> }) {
	const [copyStatus, setCopyStatus] = useState<'idle' | 'pending' | 'copied' | 'error'>('idle')
	const isCsv = preview.filename.toLowerCase().endsWith('.csv')
	useEffect(() => {
		if (copyStatus !== 'copied') return
		const timer = setTimeout(() => setCopyStatus('idle'), 1500)
		return () => clearTimeout(timer)
	}, [copyStatus])

	const stats = useMemo(() => {
		const content = preview.content
		const lines = content.length === 0 ? 0 : content.split('\n').length
		const bytes = new Blob([content]).size
		return { lines, size: formatBytes(bytes) }
	}, [preview])

	const handleCopy = async () => {
		if (copyStatus === 'pending') return
		setCopyStatus('pending')
		try {
			await navigator.clipboard.writeText(preview.content)
			setCopyStatus('copied')
		} catch {
			setCopyStatus('error')
		}
	}
	const handleDownload = () => {
		const filename = preview.filename
		const mimeType = isCsv ? 'text/csv' : filename.toLowerCase().endsWith('.md') ? 'text/markdown' : 'text/plain'
		// Preserve the uploaded text, including CSV quoting and line endings.
		downloadBlob(
			filename,
			preview.original instanceof Blob
				? preview.original
				: new Blob([preview.content], { type: `${mimeType};charset=utf-8` })
		)
	}
	const copyLabel =
		copyStatus === 'pending'
			? 'Copying…'
			: copyStatus === 'copied'
				? 'Copied'
				: copyStatus === 'error'
					? 'Retry copy'
					: preview.truncated
						? 'Copy preview'
						: 'Copy'

	return (
		<>
			<header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b border-subtle p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
				<div className="flex min-w-0 flex-col gap-0.5">
					<DialogHeading title={preview.filename} className="line-clamp-2 break-all">
						{preview.isPasted ? 'Pasted content' : preview.filename}
					</DialogHeading>
					<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 body-sm text-secondary">
						<span>{stats.size}</span>
						<span aria-hidden className="size-1 rounded-full bg-current opacity-50" />
						<span>
							{formatNumber(stats.lines)} {preview.truncated ? 'preview lines' : 'lines'}
						</span>
					</div>
				</div>
				<div className="col-span-2 row-start-2 flex items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
					<Button
						type="button"
						size="md"
						variant="secondary"
						onClick={handleCopy}
						aria-disabled={copyStatus === 'pending'}
						aria-busy={copyStatus === 'pending'}
					>
						{copyStatus === 'pending' ? (
							<LoadingSpinner size={14} />
						) : (
							<Icon name={copyStatus === 'copied' ? 'check' : 'copy'} height={14} width={14} />
						)}
						{copyLabel}
					</Button>
					{typeof preview.original === 'string' ? (
						<Button
							as="a"
							href={preview.original}
							download={preview.filename}
							target="_blank"
							rel="noopener noreferrer"
							size="md"
						>
							<Icon name="download" height={14} width={14} /> Download full file
						</Button>
					) : (
						<Button type="button" size="md" onClick={handleDownload}>
							<Icon name="download" height={14} width={14} /> {preview.truncated ? 'Download full file' : 'Download'}
						</Button>
					)}
				</div>
				<Ariakit.DialogDismiss
					className="col-start-2 row-start-1 flex size-8 items-center justify-center rounded-lg border border-medium text-secondary hover:bg-hover-row focus-visible:focus-ring sm:col-start-3"
					aria-label="Close dialog"
				>
					<Icon name="x" height={14} width={14} />
				</Ariakit.DialogDismiss>
				{preview.truncated ? (
					<p className="col-span-full body-sm text-secondary">
						Showing the first 64 KB. Download the full file to view all content.
					</p>
				) : null}
				{preview.isPasted ? (
					<p className="col-span-full body-sm text-secondary">Plain text preview. Original formatting may differ.</p>
				) : null}
				{copyStatus === 'error' ? (
					<p role="alert" className="col-span-full body-sm text-error">
						Couldn&apos;t copy. Try again or download the file.
					</p>
				) : null}
				<span role="status" className="sr-only">
					{copyStatus === 'copied' ? 'Content copied' : copyStatus === 'pending' ? 'Copying content…' : ''}
				</span>
			</header>

			<div className="flex min-h-0 flex-auto flex-col p-3">
				<Ariakit.Focusable
					render={<pre />}
					role="document"
					aria-label="File content"
					className={`${CODE_BLOCK} min-h-0 overscroll-contain focus-visible:focus-ring ${preview.isPasted ? 'body-md! font-sans!' : 'mono-md!'} ${isCsv ? 'whitespace-pre!' : ''}`}
				>
					{preview.content}
				</Ariakit.Focusable>
			</div>
		</>
	)
}
