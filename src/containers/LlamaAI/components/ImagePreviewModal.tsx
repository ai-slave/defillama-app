import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { catchLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { BusyGlyph } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { downloadBlob } from '~/utils/download'

interface ImagePreviewModalProps {
	imageUrl: string | null
	onClose: () => void
	source?: 'user-upload' | 'generated' | 'input-preview'
	sessionId?: string | null
	messageId?: string
}

/* The frosted bar over the picture holds plain round buttons (design.md: a toolbar that draws its own bar over an
   image keeps borderless buttons), at the 32px md height. While an action runs, a button keeps Button's pending model:
   aria-busy, a spinner with the pending label, and focus kept through accessibleWhenDisabled. */
const TOOLBAR_BUTTON =
	'touch-target flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1.5 label-sm text-ai-white not-aria-disabled:hover:bg-ai-ink-wash focus-visible:bg-ai-ink-wash not-aria-disabled:active:bg-ai-ink-wash-strong aria-busy:cursor-progress'

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
			className="motion-safe:data-[enter]:animate-in motion-safe:data-[leave]:animate-out data-[enter]:fade-in data-[leave]:fade-out fixed inset-0 z-50 flex items-center justify-center bg-ai-ink-scrim p-4 backdrop-blur-md data-[enter]:duration-150"
			portal
			unmountOnHide
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			{imageUrl ? <ImagePreviewContent key={imageUrl} imageUrl={imageUrl} {...tracking} /> : null}
			<Tooltip
				content="Close preview"
				render={
					<Ariakit.DialogDismiss
						render={<Button variant="onMedia" size="md" square className="absolute top-4 right-4" />}
						aria-label="Close preview"
					/>
				}
			>
				<Icon name="x" className="size-4" />
			</Tooltip>
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
				<p role="alert" className="max-w-sm shrink-0 rounded-lg bg-ai-ink-scrim p-3 text-center body-md text-ai-white">
					Couldn’t load this image. Use Open to try it in a new tab.
				</p>
			) : (
				<div className="shrink-0 overflow-hidden rounded-xl shadow-dialog ring-1 ring-ai-ink-wash">
					<img
						src={imageUrl}
						alt="Preview"
						onError={() => setImageFailed(true)}
						className="block max-h-[80vh] max-w-full object-contain"
					/>
				</div>
			)}
			<div className="flex max-w-full shrink-0 flex-wrap justify-center gap-2 rounded-2xl bg-ai-ink-scrim px-2 py-1.5 ring-1 ring-ai-ink-wash backdrop-blur-md">
				<Ariakit.Button
					type="button"
					// Copied ignores presses, so its reset timer can only ever end the success it belongs to.
					onClick={(event) => {
						if (!copy.isSuccess) copy.mutate(event.currentTarget)
					}}
					disabled={copy.isPending}
					accessibleWhenDisabled
					aria-busy={copy.isPending || undefined}
					className={TOOLBAR_BUTTON}
				>
					{copy.isPending ? (
						<BusyGlyph decorative size={14} />
					) : (
						<Icon name={copy.isSuccess ? 'check' : 'copy'} className="size-3.5" />
					)}
					{/* All three labels stay laid out in one grid cell, so the button keeps its widest width and Download
					    beside it never moves. */}
					<span className="grid">
						{(['Copy URL', 'Copying…', 'Copied'] as const).map((label) => {
							const shown = label === (copy.isPending ? 'Copying…' : copy.isSuccess ? 'Copied' : 'Copy URL')
							return (
								<span
									key={label}
									aria-hidden={!shown || undefined}
									className={`col-start-1 row-start-1 ${shown ? '' : 'invisible'}`}
								>
									{label}
								</span>
							)
						})}
					</span>
				</Ariakit.Button>
				<Ariakit.Button
					type="button"
					onClick={(event) => download.mutate(event.currentTarget)}
					disabled={download.isPending}
					accessibleWhenDisabled
					aria-busy={download.isPending || undefined}
					className={TOOLBAR_BUTTON}
				>
					{download.isPending ? (
						<BusyGlyph decorative size={14} />
					) : (
						<Icon name={download.isSuccess ? 'check' : 'download-cloud'} className="size-3.5" />
					)}
					<span>{download.isPending ? 'Downloading…' : download.isSuccess ? 'Download again' : 'Download'}</span>
				</Ariakit.Button>
				<a href={imageUrl} target="_blank" rel="noopener noreferrer" className={TOOLBAR_BUTTON}>
					<Icon name="external-link" className="size-3.5" />
					<span>
						Open<span className="sr-only"> in new tab</span>
					</span>
				</a>
			</div>
			{copy.isError ? (
				<p role="alert" className="max-w-sm shrink-0 rounded-lg bg-ai-ink-scrim p-3 text-center body-md text-ai-white">
					Couldn’t copy the image URL. Try again, or use Open to copy it from your browser.
				</p>
			) : null}
			{download.isError ? (
				<p role="alert" className="max-w-sm shrink-0 rounded-lg bg-ai-ink-scrim p-3 text-center body-md text-ai-white">
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
