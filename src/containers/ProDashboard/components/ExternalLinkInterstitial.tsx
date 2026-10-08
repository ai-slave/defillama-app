import * as Ariakit from '@ariakit/react'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { externalLinkHostname } from './externalLink'

interface ExternalLinkInterstitialProps {
	href: string | null
	onClose: () => void
	onAllowPermanently?: (hostname: string, href: string) => void
}

// A two-choice interstitial counts as a confirmation: no ×, and Cancel stays visible at every width.
export function ExternalLinkInterstitial({ href, onClose, onAllowPermanently }: ExternalLinkInterstitialProps) {
	const hostname = externalLinkHostname(href)
	const isOpen = href !== null && hostname !== null

	return (
		<Dialog size="sm" open={isOpen} onClose={onClose} portal unmountOnHide>
			<DialogHeader title="Leaving DefiLlama" closable={false} />
			<DialogBody>
				<p className="body-sm text-secondary">
					You are about to visit an external site. DefiLlama is not responsible for its content.
				</p>
				<div className="rounded-lg border border-subtle bg-surface-elevated-1 px-3 py-2 break-all">
					<div className="label-md text-primary">{hostname}</div>
					<div className="mt-1 body-sm break-all text-secondary">{href}</div>
				</div>
			</DialogBody>
			<DialogFooter
				leading={
					hostname && href && onAllowPermanently ? (
						<Button
							type="button"
							variant="ghost"
							size="md"
							onClick={() => {
								onAllowPermanently(hostname, href)
								onClose()
							}}
						>
							Always allow
						</Button>
					) : null
				}
			>
				<Ariakit.DialogDismiss autoFocus render={<Button type="button" size="md" />}>
					Cancel
				</Ariakit.DialogDismiss>
				<Button
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
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
