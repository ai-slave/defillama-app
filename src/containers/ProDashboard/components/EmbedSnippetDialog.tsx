import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'

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
	// The theme outlives a closing; the copy result belongs to one opening, so it lives in the unmounted content.
	const [theme, setTheme] = useState<EmbedTheme>('dark')
	return (
		<Dialog size="sm" scope="pro" open={open} onClose={onClose} portal unmountOnHide>
			<EmbedSnippetContent heading={heading} snippet={snippetFor(theme)} theme={theme} onThemeChange={setTheme} />
		</Dialog>
	)
}

function EmbedSnippetContent({
	heading,
	snippet,
	theme,
	onThemeChange
}: {
	heading: string
	snippet: string
	theme: EmbedTheme
	onThemeChange: (theme: EmbedTheme) => void
}) {
	// The copy result shows in the dialog itself: "Copied" on the button for 2s, or an inline error.
	const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
	const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const copySnippet = async () => {
		if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
		try {
			await navigator.clipboard.writeText(snippet)
		} catch {
			setCopyStatus('failed')
			return
		}
		setCopyStatus('copied')
		copiedTimeoutRef.current = setTimeout(() => setCopyStatus('idle'), 2000)
	}
	return (
		<>
			<DialogHeader title={heading} />
			<DialogBody>
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
								onClick={() => onThemeChange(option)}
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
					className="w-full resize-none rounded-md border border-medium bg-surface-elevated-1 p-2 mono-sm text-primary focus-visible:focus-ring"
				/>
				{copyStatus === 'failed' ? (
					<InlineStatus variant="error">
						Could not copy to clipboard. Select the code and copy it manually.
					</InlineStatus>
				) : null}
			</DialogBody>
			<DialogFooter leading={<p className="body-sm text-secondary">Paste this into your page&apos;s HTML.</p>}>
				<Button
					type="button"
					size="md"
					variant="primary"
					data-umami-event="copy-embed-snippet"
					onClick={() => {
						void copySnippet()
					}}
				>
					<Icon name={copyStatus === 'copied' ? 'check' : 'copy'} className="size-4" aria-hidden="true" />
					{copyStatus === 'copied' ? 'Copied' : 'Copy code'}
				</Button>
			</DialogFooter>
			<span role="status" className="sr-only">
				{copyStatus === 'copied' ? 'Embed code copied' : ''}
			</span>
		</>
	)
}
