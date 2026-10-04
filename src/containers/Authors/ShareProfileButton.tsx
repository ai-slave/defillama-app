import * as Ariakit from '@ariakit/react'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { PopoverSurface } from '~/ui/PopoverSurface'

export function ShareProfileButton({ slug, displayName }: { slug: string; displayName: string }) {
	const [copied, setCopied] = useState(false)
	const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(() => {
		return () => {
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
		}
	}, [])
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })

	const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://defillama.com'}/authors/${slug}`

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl)
			setCopied(true)
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
			copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.log('Failed to copy link:', error)
		}
	}

	const handleShareTo = (social: 'twitter' | 'telegram') => {
		const text = encodeURIComponent(`Check out ${displayName}'s dashboards on DefiLlama`)
		const url = encodeURIComponent(shareUrl)
		const socialUrl =
			social === 'telegram'
				? `https://t.me/share/url?text=${text}&url=${url}`
				: `https://x.com/intent/tweet?text=${text}&url=${url}`
		window.open(socialUrl, '_blank', 'noopener,noreferrer')
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure className="inline-flex items-center gap-1.5 rounded-md border border-medium bg-page px-3 py-2 text-xs font-medium text-secondary transition-colors hover:border-link/50 hover:text-link">
				<Icon name="share" className="size-3.5" />
				Share
			</Ariakit.PopoverDisclosure>

			<PopoverSurface variant="panel" heading="Share profile" gutter={8} className="w-70">
				<div className="flex flex-col gap-3 p-3">
					<div className="flex flex-col gap-1.5">
						<p className="text-xs font-medium text-secondary">Profile link</p>
						<div className="flex gap-2">
							<input
								type="text"
								value={shareUrl}
								readOnly
								className="flex-1 rounded-md border border-medium bg-surface-elevated-1 px-2.5 py-1.5 text-xs"
							/>
							<button
								type="button"
								onClick={() => {
									void handleCopyLink()
								}}
								className="flex items-center gap-1.5 rounded-md border border-medium px-2.5 py-1.5 text-xs text-secondary transition-colors hover:text-primary"
								title="Copy link"
							>
								{copied ? (
									<Icon name="check-circle" height={14} width={14} className="text-success" />
								) : (
									<Icon name="copy" height={14} width={14} />
								)}
							</button>
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<p className="text-xs font-medium text-secondary">Share on</p>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => handleShareTo('twitter')}
								className="flex flex-1 items-center justify-center gap-2 rounded-md border border-medium px-3 py-2 text-xs text-secondary transition-colors hover:text-primary"
								title="Share on X/Twitter"
							>
								<Icon name="twitter" height={16} width={16} />
								<span>X/Twitter</span>
							</button>
							<button
								type="button"
								onClick={() => handleShareTo('telegram')}
								className="flex flex-1 items-center justify-center gap-2 rounded-md border border-medium px-3 py-2 text-xs text-secondary transition-colors hover:text-primary"
								title="Share on Telegram"
							>
								<Icon name="telegram" height={16} width={16} />
								<span>Telegram</span>
							</button>
						</div>
					</div>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
