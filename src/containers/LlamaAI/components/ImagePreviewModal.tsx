import * as Ariakit from '@ariakit/react'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { downloadBlob } from '~/utils/download'

interface ImagePreviewModalProps {
	imageUrl: string | null
	onClose: () => void
	source?: 'user-upload' | 'generated' | 'input-preview'
	sessionId?: string | null
	messageId?: string
}

function extractFilename(url: string): string {
	try {
		const pathname = new URL(url).pathname
		const last = pathname.split('/').findLast(Boolean)
		return last || 'defillama-image.png'
	} catch {
		return 'defillama-image.png'
	}
}

export function ImagePreviewModal({ imageUrl, onClose, ...tracking }: ImagePreviewModalProps) {
	return (
		<Ariakit.DialogProvider open={!!imageUrl} setOpen={(open) => !open && onClose()}>
			<Ariakit.Dialog
				aria-label="Image preview"
				className="motion-safe:data-[enter]:animate-in motion-safe:data-[leave]:animate-out data-[enter]:fade-in data-[leave]:fade-out fixed inset-0 z-50 flex items-center justify-center bg-ai-black/80 p-4 backdrop-blur-md data-[enter]:duration-150"
				portal
				unmountOnHide
				onClick={(event) => {
					if (event.target === event.currentTarget) onClose()
				}}
			>
				{imageUrl ? <ImagePreviewContent key={imageUrl} imageUrl={imageUrl} {...tracking} /> : null}
				<Ariakit.DialogDismiss
					className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-ai-white/10 text-ai-white backdrop-blur-md not-disabled:not-aria-disabled:hover:bg-hover-row"
					aria-label="Close preview"
				>
					<Icon name="x" height={16} width={16} />
				</Ariakit.DialogDismiss>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

// Feedback belongs to this image/opening; an already requested download may finish after dismissal.
function ImagePreviewContent({
	imageUrl,
	source,
	sessionId,
	messageId
}: Omit<ImagePreviewModalProps, 'imageUrl' | 'onClose'> & { imageUrl: string }) {
	const [copy, setCopy] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
	const [download, setDownload] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
	useEffect(() => {
		if (copy !== 'success') return
		const timer = setTimeout(() => setCopy('idle'), 1500)
		return () => clearTimeout(timer)
	}, [copy])
	const trackingIds = { source: source ?? '', sessionId: sessionId ?? '', messageId: messageId ?? '' }

	const handleCopyUrl = async (event: React.MouseEvent<HTMLButtonElement>) => {
		if (copy === 'pending') return
		const button = event.currentTarget
		setCopy('pending')
		try {
			await navigator.clipboard.writeText(imageUrl)
			setCopy('success')
			trackUmamiEvent('llamaai-download', {
				kind: 'image-copy-url',
				filename: extractFilename(imageUrl),
				url: imageUrl,
				...trackingIds
			})
		} catch {
			setCopy('error')
			if (!button.isConnected) toast.error('Couldn’t copy the image URL.')
		}
	}

	const handleDownload = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (download === 'pending') return
		const button = event.currentTarget
		setDownload('pending')
		void fetch(imageUrl)
			.then((response) => {
				if (!response.ok) throw new Error('Image download failed')
				return response.blob()
			})
			.then((blob) => {
				downloadBlob(extractFilename(imageUrl), blob)
				trackUmamiEvent('llamaai-download', {
					kind: 'image',
					filename: extractFilename(imageUrl),
					url: imageUrl,
					...trackingIds
				})
			})
			.then(
				() => setDownload('success'),
				() => {
					setDownload('error')
					if (!button.isConnected) toast.error('Couldn’t download the image. Reopen its preview to try again.')
				}
			)
	}

	return (
		<div className="relative flex max-h-full min-h-0 max-w-full flex-col items-center gap-3 overflow-y-auto">
			<div className="shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-ai-white/10">
				<img src={imageUrl} alt="Preview" className="block max-h-[80vh] max-w-full object-contain" />
			</div>
			<div className="flex max-w-full shrink-0 flex-wrap justify-center gap-2 rounded-2xl bg-screen-dim px-2 py-1.5 ring-1 ring-ai-white/10 backdrop-blur-md">
				<Ariakit.Button
					type="button"
					onClick={handleCopyUrl}
					disabled={copy === 'pending'}
					accessibleWhenDisabled
					className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-ai-white/80 not-disabled:not-aria-disabled:hover:bg-ai-white/10 not-disabled:not-aria-disabled:hover:text-ai-white aria-disabled:opacity-50"
				>
					{copy === 'pending' ? (
						<LoadingSpinner size={14} />
					) : (
						<Icon name={copy === 'success' ? 'check' : 'copy'} height={14} width={14} />
					)}
					<span>{copy === 'pending' ? 'Copying…' : copy === 'success' ? 'Copied' : 'Copy URL'}</span>
				</Ariakit.Button>
				<Ariakit.Button
					type="button"
					onClick={handleDownload}
					disabled={download === 'pending'}
					accessibleWhenDisabled
					className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-ai-white/80 not-disabled:not-aria-disabled:hover:bg-ai-white/10 not-disabled:not-aria-disabled:hover:text-ai-white aria-disabled:opacity-50"
				>
					{download === 'pending' ? (
						<LoadingSpinner size={14} />
					) : (
						<Icon name={download === 'success' ? 'check' : 'download-cloud'} height={14} width={14} />
					)}
					<span>
						{download === 'pending' ? 'Downloading…' : download === 'success' ? 'Download again' : 'Download'}
					</span>
				</Ariakit.Button>
				<a
					href={imageUrl}
					target="_blank"
					rel="noopener noreferrer"
					title="Open in new tab"
					className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-ai-white/80 hover:bg-ai-white/10 hover:text-ai-white"
				>
					<Icon name="external-link" height={14} width={14} />
					<span>Open</span>
				</a>
			</div>
			{copy === 'error' ? (
				<p role="alert" className="max-w-sm shrink-0 rounded-lg bg-ai-black/80 p-3 text-center text-sm text-ai-white">
					Couldn’t copy the image URL. Try again, or use Open to copy it from your browser.
				</p>
			) : null}
			{download === 'error' ? (
				<p role="alert" className="max-w-sm shrink-0 rounded-lg bg-ai-black/80 p-3 text-center text-sm text-ai-white">
					Couldn’t download the image. Try again, or use Open to save it from your browser.
				</p>
			) : null}
			<span role="status" className="sr-only">
				{copy === 'pending' ? 'Copying image URL' : copy === 'success' ? 'Image URL copied' : ''}
			</span>
			<span role="status" className="sr-only">
				{download === 'pending' ? 'Downloading image' : download === 'success' ? 'Image download started' : ''}
			</span>
		</div>
	)
}
