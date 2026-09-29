import * as Ariakit from '@ariakit/react'
import { useSubscribe } from '~/auth/useSubscribe'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { END_TRIAL_APPLYING_REASON, useEndTrialApplying } from './endTrialHold'

const DEFAULT_BENEFITS = [
	'Unlimited CSV downloads',
	'Unlimited AI questions',
	'5 deep research questions per day',
	'All Pro features without limitations'
]

interface EndTrialModalProps {
	isOpen: boolean
	onClose: () => void
	title?: string
	description?: string
	benefitsTitle?: string
	benefits?: Array<string>
	confirmLabel?: string
	secondaryHref?: string
	secondaryLabel?: string
}

// Each opening starts fresh, and a closing dialog keeps its last step through the fade-out.
export function EndTrialModal(props: EndTrialModalProps) {
	return <EndTrialDialog key={useOpeningKey(props.isOpen)} {...props} />
}

function EndTrialDialog({
	isOpen,
	onClose,
	title = 'Upgrade to Full Access',
	description,
	benefitsTitle = 'Benefits of converting now:',
	benefits = DEFAULT_BENEFITS,
	confirmLabel = 'Confirm & Upgrade Now',
	secondaryHref,
	secondaryLabel
}: EndTrialModalProps) {
	// The modal owns the upgrade: the mutation is the single source of the
	// pending/success/error state, and all feedback renders inside the dialog.
	const { endTrialMutation } = useSubscribe()
	const upgraded = endTrialMutation.isSuccess
	const error = endTrialMutation.isError ? endTrialMutation.error.message : null
	const isLoading = endTrialMutation.isPending
	// An upgrade sent from any opener still charges until the trial reads as ended, so a reopened dialog cannot send another.
	const isApplying = useEndTrialApplying()

	const handleClose = () => {
		if (isLoading) return
		onClose()
	}

	// A charge-now confirmation: no ×, the choice is the footer, and Close stays visible at every width.
	return (
		<Dialog size="sm" role="alertdialog" open={isOpen} onClose={handleClose} pending={isLoading} portal unmountOnHide>
			<DialogHeader title={upgraded ? 'Upgrade Successful' : title} closable={false} />
			{upgraded ? (
				<>
					<DialogBody>
						<Ariakit.DialogDescription className="body-sm text-secondary">
							{END_TRIAL_APPLYING_REASON}
						</Ariakit.DialogDescription>
					</DialogBody>
					<DialogFooter>
						<Button type="button" variant="primary" size="md" autoFocus onClick={handleClose}>
							Close
						</Button>
					</DialogFooter>
				</>
			) : (
				<>
					<DialogBody>
						{description ? <p className="body-sm text-secondary">{description}</p> : null}

						<div className="flex flex-col gap-2">
							<p className="body-sm text-secondary">{benefitsTitle}</p>
							<ul className="flex flex-col gap-1 body-sm text-primary">
								{benefits.map((b) => (
									<li key={b} className="flex items-center gap-2">
										<Icon name="check" height={14} width={14} className="shrink-0 text-success" />
										<span>{b}</span>
									</li>
								))}
							</ul>
						</div>

						{/* The single source of truth for the instant-charge disclosure. */}
						<InlineStatus variant="warning">
							<Ariakit.DialogDescription>
								By upgrading, you will end your free trial early and be charged the full subscription amount ($49/month)
								immediately.
							</Ariakit.DialogDescription>
						</InlineStatus>

						{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
						{isApplying ? <p className="body-sm text-secondary">{END_TRIAL_APPLYING_REASON}</p> : null}
					</DialogBody>
					<DialogFooter
						leading={
							secondaryHref ? (
								// Without an href the link is inert, so it cannot leave the page while the charge runs.
								<Button
									as="a"
									variant="ghost"
									size="md"
									href={isLoading ? undefined : secondaryHref}
									aria-disabled={isLoading || undefined}
								>
									{secondaryLabel ?? 'View all plans'}
								</Button>
							) : null
						}
					>
						<Ariakit.DialogDismiss
							type="button"
							autoFocus
							disabled={isLoading}
							accessibleWhenDisabled
							render={<Button size="md" />}
						>
							Close
						</Ariakit.DialogDismiss>
						<Button
							type="button"
							variant="primary"
							size="md"
							pendingLabel={isLoading ? 'Processing…' : null}
							disabled={isApplying}
							onClick={() => endTrialMutation.mutate()}
						>
							{confirmLabel}
						</Button>
					</DialogFooter>
					<span role="status" className="sr-only">
						{isLoading ? 'Processing…' : ''}
					</span>
				</>
			)}
		</Dialog>
	)
}
