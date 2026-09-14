import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

export const EMBED_ORIGIN = 'https://defillama.com'
export const EMBED_THEMES = ['dark', 'light'] as const
export type EmbedTheme = (typeof EMBED_THEMES)[number]
const EMBED_THEME_LABELS: Record<EmbedTheme, string> = { dark: 'Dark', light: 'Light' }

export function buildEmbedIframeSnippet({ src, height }: { src: string; height: number }): string {
	return `<iframe src="${src}" width="100%" height="${height}" style="border:0" loading="lazy"></iframe>`
}

export function dashboardEmbedPath(dashboardKey: string): string {
	return `/pro/embed/${encodeURIComponent(dashboardKey)}`
}

export function cardEmbedSrc(dashboardKey: string, itemId: string, theme: EmbedTheme): string {
	return `${EMBED_ORIGIN}${dashboardEmbedPath(dashboardKey)}?item=${encodeURIComponent(itemId)}&theme=${theme}`
}

export async function copyTextToClipboard(text: string, successMessage: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		toast.success(successMessage)
		return true
	} catch {
		toast.error('Could not copy to clipboard')
		return false
	}
}

interface EmbedSnippetDialogProps {
	open: boolean
	onClose: () => void
	heading: string
	snippetFor: (theme: EmbedTheme) => string
}

export function EmbedSnippetDialog({ open, onClose, heading, snippetFor }: EmbedSnippetDialogProps) {
	const [theme, setTheme] = useState<EmbedTheme>('dark')
	const snippet = snippetFor(theme)
	return (
		<Ariakit.DialogProvider
			open={open}
			setOpen={(next) => {
				if (!next) onClose()
			}}
		>
			<Ariakit.Dialog className={`${dialogSurfaceStyles} pro-dashboard [--dialog-width:520px]`} portal unmountOnHide>
				<div className="flex items-center justify-between border-b border-subtle p-3">
					<DialogHeading>{heading}</DialogHeading>
					<DialogCloseButton />
				</div>
				<div className={`${dialogScrollableBodyStyles} flex flex-col gap-3 p-3`}>
					<div className="flex items-center justify-between gap-2">
						<span className="label-sm text-secondary">Theme</span>
						<div role="group" aria-label="Embed theme" className="flex gap-1">
							{EMBED_THEMES.map((option) => (
								<Button
									key={option}
									type="button"
									size="sm"
									variant="toggle"
									data-active={theme === option}
									aria-pressed={theme === option}
									onClick={() => setTheme(option)}
								>
									{EMBED_THEME_LABELS[option]}
								</Button>
							))}
						</div>
					</div>
					<textarea
						readOnly
						value={snippet}
						rows={4}
						aria-label="Embed code"
						spellCheck={false}
						onFocus={(event) => event.currentTarget.select()}
						className="w-full resize-none rounded-md border border-medium bg-surface-elevated-1 p-2 font-mono text-xs text-primary focus-visible:focus-ring"
					/>
					<div className="flex items-center justify-between gap-3">
						<p className="body-sm text-secondary">Paste this into your page&apos;s HTML.</p>
						<Button
							type="button"
							size="md"
							variant="primary"
							data-umami-event="copy-embed-snippet"
							onClick={() => {
								void copyTextToClipboard(snippet, 'Embed code copied')
							}}
						>
							<Icon name="copy" className="size-4" aria-hidden="true" />
							Copy code
						</Button>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
