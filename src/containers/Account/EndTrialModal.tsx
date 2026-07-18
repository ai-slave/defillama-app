import * as Ariakit from '@ariakit/react'
import { useCallback, useState } from 'react'
import { Icon } from '~/components/Icon'
import { useSubscribe } from '~/containers/Subscription/useSubscribe'

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
	benefits?: string[]
	confirmLabel?: string
	secondaryHref?: string
	secondaryLabel?: string
	/** When provided, the parent owns the upgrade action + loading state. When omitted, the modal self-calls endTrialSubscription() and shows its own success state. */
	onConfirm?: () => void
	isLoading?: boolean
}

export function EndTrialModal({
	isOpen,
	onClose,
	title = 'Upgrade to Full Access',
	description,
	benefitsTitle = 'Benefits of converting now:',
	benefits = DEFAULT_BENEFITS,
	confirmLabel = 'Confirm & Upgrade Now',
	secondaryHref,
	secondaryLabel,
	onConfirm,
	isLoading: externalLoading
}: EndTrialModalProps) {
	const selfHandled = !onConfirm
	const { endTrialSubscription, isEndTrialLoading } = useSubscribe()
	const [upgraded, setUpgraded] = useState(false)

	const isLoading = selfHandled ? isEndTrialLoading : !!externalLoading

	const handleConfirm = useCallback(async () => {
		if (onConfirm) {
			onConfirm()
			return
		}
		try {
			await endTrialSubscription()
			setUpgraded(true)
		} catch (error) {
			console.error('Failed to upgrade:', error)
		}
	}, [onConfirm, endTrialSubscription])

	const handleClose = useCallback(() => {
		setUpgraded(false)
		onClose()
	}, [onClose])

	return (
		<Ariakit.Dialog
			open={isOpen}
			onClose={() => {
				if (!isLoading) handleClose()
			}}
			className="dialog flex max-h-[90dvh] max-w-md flex-col gap-4 overflow-y-auto rounded-xl border border-medium bg-white p-6 text-gray-900 shadow-2xl max-sm:drawer max-sm:rounded-b-none dark:border-sub-line dark:bg-sub-dark-panel dark:text-sub-text-primary"
			portal
			unmountOnHide
		>
			<div className="flex items-center justify-between">
				<h3 className="text-xl font-bold">{upgraded ? 'Upgrade Successful' : title}</h3>
				<button
					onClick={handleClose}
					className="rounded-full p-1.5 text-tertiary transition-colors hover:bg-gray-100 hover:text-secondary dark:text-sub-text-muted dark:hover:bg-sub-line dark:hover:text-sub-text-primary"
				>
					<Icon name="x" height={18} width={18} />
				</button>
			</div>

			{upgraded ? (
				<>
					<div className="rounded-lg border border-success/30 bg-success/10 p-4">
						<div className="flex items-start gap-3">
							<Icon name="check" height={20} width={20} className="mt-0.5 shrink-0 text-success" />
							<p className="text-sm text-secondary dark:text-sub-text-soft">
								Please wait a few minutes and refresh the page after upgrading, the upgrade might take a few minutes to
								apply.
							</p>
						</div>
					</div>
					<button
						onClick={handleClose}
						className="w-full rounded-lg bg-sub-brand-primary px-4 py-3 font-medium text-on-brand transition-colors hover:bg-sub-brand-primary/90"
					>
						Close
					</button>
				</>
			) : (
				<>
					{description ? <p className="text-sm text-tertiary dark:text-sub-text-muted">{description}</p> : null}

					{/* Benefits */}
					<div className="mt-2 flex flex-col gap-2">
						<p className="text-sm text-tertiary dark:text-sub-text-muted">{benefitsTitle}</p>
						<ul className="flex flex-col gap-1 text-sm">
							{benefits.map((b) => (
								<li key={b} className="flex items-center gap-2">
									<Icon name="check" height={14} width={14} className="shrink-0 text-success dark:text-success" />
									<span>{b}</span>
								</li>
							))}
						</ul>
					</div>

					{/* Warning — single source of truth for the instant-charge disclosure */}
					<div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
						<div className="flex items-start gap-3">
							<Icon name="alert-triangle" height={20} width={20} className="mt-0.5 shrink-0 text-warning" />
							<p className="text-sm text-secondary dark:text-sub-text-soft">
								By upgrading, you will end your free trial early and be charged the full subscription amount ($49/month)
								immediately.
							</p>
						</div>
					</div>

					{/* Actions */}
					<div className="mt-2 flex flex-col gap-3">
						<button
							onClick={() => void handleConfirm()}
							disabled={isLoading}
							className="w-full rounded-lg bg-sub-brand-primary px-4 py-3 font-medium text-on-brand transition-colors hover:bg-sub-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{isLoading ? 'Processing...' : confirmLabel}
						</button>
						{secondaryHref ? (
							<a
								href={secondaryHref}
								className="w-full rounded-lg border border-medium px-4 py-2 text-center text-tertiary transition-colors hover:bg-page hover:text-secondary dark:border-sub-line dark:text-sub-text-muted dark:hover:bg-sub-dark-card-raised dark:hover:text-sub-text-primary"
							>
								{secondaryLabel ?? 'View all plans'}
							</a>
						) : (
							<button
								onClick={handleClose}
								disabled={isLoading}
								className="w-full rounded-lg border border-medium px-4 py-2 text-tertiary transition-colors hover:bg-page hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50 dark:border-sub-line dark:text-sub-text-muted dark:hover:bg-sub-dark-card-raised dark:hover:text-sub-text-primary"
							>
								{secondaryLabel ?? 'Close'}
							</button>
						)}
					</div>
				</>
			)}
		</Ariakit.Dialog>
	)
}
