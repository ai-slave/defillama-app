import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { catchLostFocus } from '~/ui/focus'
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
		<Ariakit.Dialog
			open={!!imageUrl}
			onClose={onClose}
			aria-label="Image preview"
			ref={catchLostFocus}
			className="motion-safe:data-[enter]:animate-in motion-safe:data-[leave]:animate-out data-[enter]:fade-in data-[leave]:fade-out fixed inset-0 z-50 flex items-center justify-center bg-ai-black/80 p-4 backdrop-blur-md data-[enter]:duration-150"
			portal
			unmountOnHide
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			{imageUrl ? <ImagePreviewContent key={imageUrl} imageUrl={imageUrl} {...tracking} /> : null}
			<Ariakit.DialogDismiss
				className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-ai-white/10 text-ai-white backdrop-blur-md hover:bg-ai-white/20"
				aria-label="Close preview"
			>
				<Icon name="x" height={16} width={16} />
			</Ariakit.DialogDismiss>
		</Ariakit.Dialog>
	)
}

// Feedback belongs to this image/opening; an already requested download may finish after dismissal.
function ImagePreviewContent({
	imageUrl,
	source,
	sessionId,
	messageId
}: Omit<ImagePreviewModalProps, 'imageUrl' | 'onClose'> & { imageUrl: string }) {
	const [imageFailed, setImageFailed] = useState(false)
	const trackingIds = { source: source ?? '', sessionId: sessionId ?? '', messageId: messageId ?? '' }
	// Each mutation takes the pressed button, so a failure after dismissal can tell that its inline alert is gone.
	const copy = useMutation({
		mutationFn: (_button: HTMLButtonElement) => navigator.clipboard.writeText(imageUrl),
		onSuccess: () => {
			trackUmamiEvent('llamaai-download', {
				kind: 'image-copy-url',
				filename: extractFilename(imageUrl),
				url: imageUrl,
				...trackingIds
			})
			setTimeout(() => copy.reset(), 1500)
		},
		onError: (_error, button) => {
			if (!button.isConnected) toast.error('Couldn’t copy the image URL.')
		}
	})
	const download = useMutation({
		mutationFn: async (_button: HTMLButtonElement) => {
			const response = await fetch(imageUrl)
			if (!response.ok) throw new Error('Image download failed')
			downloadBlob(extractFilename(imageUrl), await response.blob())
			trackUmamiEvent('llamaai-download', {
				kind: 'image',
				filename: extractFilename(imageUrl),
				url: imageUrl,
				...trackingIds
			})
		},
		onError: (_error, button) => {
			if (!button.isConnected) toast.error('Couldn’t download the image. Reopen its preview to try again.')
		}
	})

	return (
		<div className="relative flex max-h-full min-h-0 max-w-full flex-col items-center gap-3 overflow-y-auto">
			{imageFailed ? (
				<p role="alert" className="max-w-sm shrink-0 rounded-lg bg-ai-black/80 p-3 text-center text-sm text-ai-white">
					Couldn’t load this image. Use Open to try it in a new tab.
				</p>
			) : (
				<div className="shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-ai-white/10">
					<img
						src={imageUrl}
						alt="Preview"
						onError={() => setImageFailed(true)}
						className="block max-h-[80vh] max-w-full object-contain"
					/>
				</div>
			)}
			<div className="flex max-w-full shrink-0 flex-wrap justify-center gap-2 rounded-2xl bg-screen-dim px-2 py-1.5 ring-1 ring-ai-white/10 backdrop-blur-md">
				<Ariakit.Button
					type="button"
					// Copied ignores presses, so its reset timer can only ever end the success it belongs to.
					onClick={(event) => {
						if (!copy.isSuccess) copy.mutate(event.currentTarget)
					}}
					disabled={copy.isPending}
					accessibleWhenDisabled
					aria-busy={copy.isPending || undefined}
					className="flex items-center gap-1.5 rounded-full px-3 py-2.5 label-sm text-ai-white/80 not-disabled:not-aria-disabled:hover:bg-ai-white/10 not-disabled:not-aria-disabled:hover:text-ai-white aria-busy:cursor-progress"
				>
					{copy.isPending ? (
						<LoadingSpinner size={14} />
					) : (
						<Icon name={copy.isSuccess ? 'check' : 'copy'} height={14} width={14} />
					)}
					<span>{copy.isPending ? 'Copying…' : copy.isSuccess ? 'Copied' : 'Copy URL'}</span>
				</Ariakit.Button>
				<Ariakit.Button
					type="button"
					onClick={(event) => download.mutate(event.currentTarget)}
					disabled={download.isPending}
					accessibleWhenDisabled
					aria-busy={download.isPending || undefined}
					className="flex items-center gap-1.5 rounded-full px-3 py-2.5 label-sm text-ai-white/80 not-disabled:not-aria-disabled:hover:bg-ai-white/10 not-disabled:not-aria-disabled:hover:text-ai-white aria-busy:cursor-progress"
				>
					{download.isPending ? (
						<LoadingSpinner size={14} />
					) : (
						<Icon name={download.isSuccess ? 'check' : 'download-cloud'} height={14} width={14} />
					)}
					<span>{download.isPending ? 'Downloading…' : download.isSuccess ? 'Download again' : 'Download'}</span>
				</Ariakit.Button>
				<a
					href={imageUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1.5 rounded-full px-3 py-2.5 label-sm text-ai-white/80 hover:bg-ai-white/10 hover:text-ai-white"
				>
					<Icon name="external-link" height={14} width={14} />
					<span>
						Open<span className="sr-only"> in new tab</span>
					</span>
				</a>
			</div>
			{copy.isError ? (
				<p role="alert" className="max-w-sm shrink-0 rounded-lg bg-ai-black/80 p-3 text-center text-sm text-ai-white">
					Couldn’t copy the image URL. Try again, or use Open to copy it from your browser.
				</p>
			) : null}
			{download.isError ? (
				<p role="alert" className="max-w-sm shrink-0 rounded-lg bg-ai-black/80 p-3 text-center text-sm text-ai-white">
					Couldn’t download the image. Try again, or use Open to save it from your browser.
				</p>
			) : null}
			<span role="status" className="sr-only">
				{copy.isPending ? 'Copying image URL' : copy.isSuccess ? 'Image URL copied' : ''}
			</span>
			<span role="status" className="sr-only">
				{download.isPending ? 'Downloading image' : download.isSuccess ? 'Image download started' : ''}
			</span>
		</div>
	)
}
