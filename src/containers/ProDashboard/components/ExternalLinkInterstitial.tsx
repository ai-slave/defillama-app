import * as Ariakit from '@ariakit/react'
import { ProButton, ProDialog } from '../ui'
import { externalLinkHostname } from './externalLink'

interface ExternalLinkInterstitialProps {
	href: string | null
	onClose: () => void
	onAllowPermanently?: (hostname: string, href: string) => void
}

export function ExternalLinkInterstitial({ href, onClose, onAllowPermanently }: ExternalLinkInterstitialProps) {
	const hostname = externalLinkHostname(href)
	const isOpen = href !== null && hostname !== null

	return (
		<Ariakit.DialogProvider
			open={isOpen}
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<ProDialog
				width="sm"
				heading="Leaving DefiLlama"
				hideOnInteractOutside
				footer={
					<>
						<Ariakit.DialogDismiss render={<ProButton type="button" variant="secondary" size="md" />}>
							Cancel
						</Ariakit.DialogDismiss>
						{hostname && href && onAllowPermanently ? (
							<ProButton
								type="button"
								variant="secondary"
								size="md"
								onClick={() => {
									onAllowPermanently(hostname, href)
									onClose()
								}}
							>
								Always allow
							</ProButton>
						) : null}
						<ProButton
							as="a"
							variant="primary"
							size="md"
							href={href ?? '#'}
							target="_blank"
							rel="noopener noreferrer nofollow ugc"
							onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
								if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
									onClose()
									return
								}
								event.preventDefault()
								if (href) window.open(href, '_blank', 'noopener,noreferrer')
								onClose()
							}}
						>
							Continue
						</ProButton>
					</>
				}
			>
				<p className="text-pro-text-secondary">
					You are about to visit an external site. DefiLlama is not responsible for its content.
				</p>
				<div className="mt-2 rounded-md border border-pro-cards-border bg-surface-elevated-2 p-3 text-sm break-all text-pro-text-primary">
					<div className="font-medium">{hostname}</div>
					<div className="mt-1 text-xs break-all text-pro-text-secondary">{href}</div>
				</div>
			</ProDialog>
		</Ariakit.DialogProvider>
	)
}
