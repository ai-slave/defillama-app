import * as Ariakit from '@ariakit/react'
import { useEffect, useMemo, useState } from 'react'
import { CODE_BLOCK } from '~/containers/LlamaAI/components/codeBlockStyles'
import type { AttachmentPreview } from '~/containers/LlamaAI/utils/attachmentPreview'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
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
		<Dialog size="lg" open={!!preview} onClose={onClose} portal unmountOnHide>
			{preview ? <TextPreview key={preview.filename} preview={preview} /> : null}
		</Dialog>
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
		copyStatus === 'copied'
			? 'Copied'
			: copyStatus === 'error'
				? 'Retry copy'
				: preview.truncated
					? 'Copy preview'
					: 'Copy'

	return (
		<>
			<DialogHeader
				title={preview.isPasted ? 'Pasted content' : preview.filename}
				subtitle={`${stats.size} · ${formatNumber(stats.lines)} ${preview.truncated ? 'preview lines' : 'lines'}`}
			/>
			<DialogBody>
				{preview.truncated ? (
					<p className="body-sm text-secondary">Showing the first 64 KB. Download the full file to view all content.</p>
				) : null}
				{preview.isPasted ? (
					<p className="body-sm text-secondary">Plain text preview. Original formatting may differ.</p>
				) : null}
				{/* The file scrolls inside its block, so the notes above and an error below stay in view. */}
				<Ariakit.Focusable
					render={<pre />}
					role="document"
					aria-label="File content"
					className={`${CODE_BLOCK} min-h-0 overscroll-contain focus-visible:focus-ring ${preview.isPasted ? 'body-md! font-sans!' : 'mono-md!'} ${isCsv ? 'whitespace-pre!' : ''}`}
				>
					{preview.content}
				</Ariakit.Focusable>
				{copyStatus === 'error' ? (
					<InlineStatus variant="error">Couldn&apos;t copy. Try again or download the file.</InlineStatus>
				) : null}
			</DialogBody>
			<DialogFooter>
				<Button
					type="button"
					size="md"
					onClick={handleCopy}
					pendingLabel={copyStatus === 'pending' ? 'Copying…' : null}
				>
					<Icon name={copyStatus === 'copied' ? 'check' : 'copy'} height={14} width={14} />
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
			</DialogFooter>
			<span role="status" className="sr-only">
				{copyStatus === 'copied' ? 'Content copied' : copyStatus === 'pending' ? 'Copying content…' : ''}
			</span>
		</>
	)
}
