import * as Ariakit from '@ariakit/react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { actionToast, TOAST_DURATION_UNDO } from './dashboardToasts'
import { buildEmbedIframeSnippet, dashboardEmbedPath, EMBED_ORIGIN } from './EmbedSnippetDialog'

const DASHBOARD_EMBED_HEIGHT = 900
type CopiedTarget = 'link' | 'embed'

export function CopyDashboardLinkButton({
	dashboardVisibility,
	dashboardId,
	dashboardSlug,
	isOwner = false,
	onMakePublic,
	manageAction
}: {
	dashboardVisibility: 'private' | 'public'
	dashboardId: string
	dashboardSlug?: string
	isOwner?: boolean
	onMakePublic?: () => Promise<void>
	manageAction?: { label: string; onSelect: () => void }
}) {
	const [copied, setCopied] = useState<CopiedTarget | null>(null)
	const [makingPublic, setMakingPublic] = useState(false)
	const pendingCopyLinkFocusRef = useRef(false)
	const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(() => {
		return () => {
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
		}
	}, [])
	const isPrivate = dashboardVisibility === 'private'
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-end' })

	const dashboardKey = dashboardSlug || dashboardId
	const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/pro/${dashboardKey}`
	const embedSnippet = buildEmbedIframeSnippet({
		src: `${EMBED_ORIGIN}${dashboardEmbedPath(dashboardKey)}`,
		height: DASHBOARD_EMBED_HEIGHT
	})

	const copyToClipboard = async (text: string, target: CopiedTarget) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(target)
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
			copiedTimeoutRef.current = setTimeout(() => setCopied(null), 2000)
		} catch {
			toast.error('Could not copy the link', { id: 'dashboard-copy' })
		}
	}
	const handleCopyLink = () => copyToClipboard(shareUrl, 'link')
	const handleCopyEmbed = () => copyToClipboard(embedSnippet, 'embed')

	const handleShareTo = (social: 'twitter' | 'telegram') => {
		const text = encodeURIComponent('Check out this dashboard on DefiLlama')
		const url = encodeURIComponent(shareUrl)

		let socialUrl = `https://x.com/intent/tweet?text=${text}&url=${url}`

		if (social === 'telegram') {
			socialUrl = `https://t.me/share/url?text=${text}&url=${url}`
		}

		window.open(socialUrl, '_blank', 'noopener,noreferrer')
	}

	if (isPrivate && !isOwner) return null

	const makePublic = async () => {
		if (!onMakePublic || makingPublic) return
		setMakingPublic(true)
		// Copy link mounts once the dashboard turns public, which can land before or after the save resolves, so the
		// focus request is armed for the whole save and dropped only if the save fails.
		pendingCopyLinkFocusRef.current = true
		try {
			await onMakePublic()
			actionToast({
				message: 'Dashboard is live',
				icon: <Icon name="earth" height={14} width={14} />,
				action: {
					label: 'Copy link',
					onClick: () => void handleCopyLink(),
					umamiEvent: 'dashboard-live-copy-link'
				},
				id: 'dashboard-live',
				duration: TOAST_DURATION_UNDO
			})
		} catch (error) {
			pendingCopyLinkFocusRef.current = false
			toast.error(error instanceof Error ? error.message : 'Could not make this dashboard public')
		}
		setMakingPublic(false)
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<Button size="md" type="button" variant="secondary" />}>
				<Icon name={isPrivate ? 'link' : 'share'} height={14} width={14} />
				<span>Share</span>
			</Ariakit.PopoverDisclosure>

			<PopoverSurface variant="list" heading="Share dashboard" gutter={8} style={{ minWidth: '280px' }}>
				{isPrivate ? (
					<div className="flex flex-col gap-2 p-3">
						<p className="text-xs text-pro-text-secondary">This dashboard is private. Only you can open the link.</p>
						{onMakePublic ? (
							<Button
								type="button"
								size="sm"
								variant="primary"
								onClick={() => void makePublic()}
								pendingLabel={makingPublic ? 'Making public…' : null}
								data-umami-event="dashboard-make-public"
							>
								Make public
							</Button>
						) : null}
						{manageAction ? (
							<Button
								type="button"
								size="sm"
								variant="secondary"
								onClick={() => {
									popover.setOpen(false)
									manageAction.onSelect()
								}}
							>
								{manageAction.label}
							</Button>
						) : null}
					</div>
				) : (
					<div className="flex flex-col gap-3 p-3">
						<span role="status" className="sr-only">
							{copied === 'link' ? 'Link copied' : copied === 'embed' ? 'Embed code copied' : ''}
						</span>
						<div className="flex flex-col gap-1.5">
							<p className="text-xs font-medium text-pro-text-label">Share Link</p>
							<div className="flex gap-2">
								<input
									type="text"
									value={shareUrl}
									readOnly
									className="flex-1 rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2.5 py-1.5 text-xs"
								/>
								<Tooltip
									content={copied === 'link' ? 'Copied' : 'Copy link'}
									render={
										<Button
											type="button"
											size="sm"
											square
											variant="secondary"
											ref={(node) => {
												if (!node || !pendingCopyLinkFocusRef.current) return
												pendingCopyLinkFocusRef.current = false
												node.focus()
											}}
											onClick={() => {
												void handleCopyLink()
											}}
											aria-label="Copy link"
										/>
									}
								>
									{copied === 'link' ? (
										<Icon name="check-circle" height={16} width={16} className="text-success" />
									) : (
										<Icon name="copy" height={16} width={16} />
									)}
								</Tooltip>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<p className="text-xs font-medium text-pro-text-label">Embed dashboard</p>
							<div className="flex gap-2">
								<textarea
									value={embedSnippet}
									readOnly
									rows={3}
									aria-label="Embed code"
									spellCheck={false}
									onFocus={(event) => event.currentTarget.select()}
									className="flex-1 resize-none rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2.5 py-1.5 font-mono text-xs"
								/>
								<Tooltip
									content={copied === 'embed' ? 'Copied' : 'Copy embed code'}
									render={
										<Button
											type="button"
											size="sm"
											square
											variant="secondary"
											onClick={() => {
												void handleCopyEmbed()
											}}
											data-umami-event="embed-dashboard"
											className="self-start"
											aria-label="Copy embed code"
										/>
									}
								>
									{copied === 'embed' ? (
										<Icon name="check-circle" height={16} width={16} className="text-success" />
									) : (
										<Icon name="code" height={16} width={16} />
									)}
								</Tooltip>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<p className="text-xs font-medium text-pro-text-label">Share on</p>
							<div className="flex gap-2">
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onClick={() => handleShareTo('twitter')}
									className="flex-1"
								>
									<Icon name="twitter" height={16} width={16} />
									<span>X/Twitter</span>
								</Button>
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onClick={() => handleShareTo('telegram')}
									className="flex-1"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
									</svg>
									<span>Telegram</span>
								</Button>
							</div>
						</div>
					</div>
				)}
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
