import * as Ariakit from '@ariakit/react'
import { useMemo, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { formatNumber, formatFixedNumber } from '~/utils/numberFormat'

interface PastedContentModalProps {
	preview: { content: string; filename: string; isPasted?: boolean } | null
	onClose: () => void
}

function formatBytes(byteLength: number): string {
	if (byteLength < 1024) return `${byteLength} B`
	const kb = byteLength / 1024
	if (kb < 1024) return `${formatFixedNumber(kb, kb < 10 ? 2 : 1)} KB`
	return `${formatFixedNumber(kb / 1024, 2)} MB`
}

export function PastedContentModal({ preview, onClose }: PastedContentModalProps) {
	const [copied, setCopied] = useState(false)

	const stats = useMemo(() => {
		if (!preview) return null
		const content = preview.content
		const lines = content.length === 0 ? 0 : content.split('\n').length
		const bytes = new Blob([content]).size
		return { lines, size: formatBytes(bytes) }
	}, [preview])

	const handleCopy = async () => {
		if (!preview) return
		try {
			await navigator.clipboard.writeText(preview.content)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			// silent
		}
	}

	return (
		<Ariakit.DialogProvider open={!!preview} setOpen={(open) => !open && onClose()}>
			<Ariakit.Dialog
				className="dialog flex max-h-[85vh] w-[min(92vw,820px)] flex-col gap-0 overflow-hidden rounded-2xl border border-ai-line bg-ai-surface-card p-0 shadow-xl"
				backdrop={<div className="backdrop fixed inset-0 bg-ai-backdrop backdrop-blur-sm" />}
				portal
				unmountOnHide
			>
				<header className="flex items-start justify-between gap-4 border-b border-ai-line px-6 py-5">
					<div className="flex min-w-0 flex-col gap-1.5">
						<h2 className="m-0 truncate text-2xl font-semibold tracking-tight text-ai-primary">
							{preview?.isPasted ? 'Pasted content' : (preview?.filename ?? 'File preview')}
						</h2>
						{stats ? (
							<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ai-muted">
								<span>{stats.size}</span>
								<span aria-hidden className="size-1 rounded-full bg-current opacity-50" />
								<span>{formatNumber(stats.lines)} lines</span>
								{preview?.isPasted ? (
									<>
										<span aria-hidden className="size-1 rounded-full bg-current opacity-50" />
										<span>Formatting may be inconsistent from source</span>
									</>
								) : null}
							</div>
						) : null}
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<button
							type="button"
							onClick={handleCopy}
							className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-ai-tertiary transition-colors hover:bg-ai-surface-muted hover:text-ai-primary"
						>
							<Icon name={copied ? 'check' : 'copy'} height={14} width={14} />
							<span>{copied ? 'Copied' : 'Copy'}</span>
						</button>
						<Ariakit.DialogDismiss className="rounded-full p-1.5 text-ai-tertiary transition-colors hover:bg-ai-surface-muted hover:text-ai-primary">
							<Icon name="x" className="size-5" />
							<span className="sr-only">Close</span>
						</Ariakit.DialogDismiss>
					</div>
				</header>

				<div className="flex-1 overflow-y-auto p-5">
					<pre className="m-0 max-h-[calc(85vh-148px)] overflow-auto rounded-xl border border-ai-line bg-ai-surface p-4 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-ai-primary">
						{preview?.content ?? ''}
					</pre>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
