import * as Ariakit from '@ariakit/react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { httpErrorMessage } from '~/utils/async'
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
				icon: <Icon name="globe" className="size-3.5" />,
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
			toast.error(httpErrorMessage(error, "Couldn't make this dashboard public. Try again."))
		}
		setMakingPublic(false)
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure render={<Button size="md" type="button" variant="secondary" />}>
				<Icon name={isPrivate ? 'link' : 'share'} className="size-3.5" />
				<span>Share</span>
			</Ariakit.PopoverDisclosure>

			<PopoverSurface variant="list" heading="Share dashboard" gutter={8} style={{ minWidth: '280px' }}>
				{isPrivate ? (
					<div className="flex flex-col gap-2 p-3">
						<p className="body-sm text-secondary">This dashboard is private. Only you can open the link.</p>
						{onMakePublic ? (
							<Button
								type="button"
								size="sm"
								variant="primary"
								onClick={() => void makePublic()}
								pendingLabel="Making public…"
								pending={makingPublic}
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
							<p className="label-sm text-secondary">Share Link</p>
							<div className="flex gap-2">
								<Input type="text" value={shareUrl} readOnly aria-label="Share link" className="min-w-0 flex-1" />
								<Tooltip
									content={copied === 'link' ? 'Copied' : 'Copy link'}
									render={
										<Button
											type="button"
											size="md"
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
										<Icon name="check-circle" className="size-4 text-success" />
									) : (
										<Icon name="copy" className="size-4" />
									)}
								</Tooltip>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<p className="label-sm text-secondary">Embed dashboard</p>
							<div className="flex gap-2">
								<Textarea
									value={embedSnippet}
									readOnly
									rows={3}
									aria-label="Embed code"
									spellCheck={false}
									onFocus={(event) => event.currentTarget.select()}
									variant="code"
									className="min-w-0 flex-1 resize-none"
								/>
								<Tooltip
									content={copied === 'embed' ? 'Copied' : 'Copy embed code'}
									render={
										<Button
											type="button"
											size="md"
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
										<Icon name="check-circle" className="size-4 text-success" />
									) : (
										<Icon name="code" className="size-4" />
									)}
								</Tooltip>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<p className="label-sm text-secondary">Share on</p>
							<div className="flex gap-2">
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onClick={() => handleShareTo('twitter')}
									className="flex-1"
								>
									<Icon name="twitter" className="size-4" />
									<span>X/Twitter</span>
								</Button>
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onClick={() => handleShareTo('telegram')}
									className="flex-1"
								>
									<Icon name="telegram" className="size-4" />
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
