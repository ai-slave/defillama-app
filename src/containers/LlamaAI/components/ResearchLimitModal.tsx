import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { EndTrialModal } from '~/containers/Account/EndTrialModal'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

interface ResearchLimitModalProps {
	dialogStore: Ariakit.DialogStore
	period: string
	limit: number
	resetTime: string | null
	feature?: 'research' | 'fact_checked'
}

const COPY = {
	research: {
		titleLimit: 'Research Report Limit Reached',
		bodyBlocked: 'Subscribe to Pro to use research reports.',
		bodyLifetime: (n: number) => `You've used all ${n} research reports available on your trial plan.`,
		bodyDaily: (n: number) => `You've used all ${n} research reports for today. Resets at midnight UTC.`,
		proPitch: 'Get 5 research reports per day with Pro',
		umamiUpgrade: 'subscribe-research-limit-upgrade'
	},
	fact_checked: {
		titleLimit: 'Fact-Checked Answer Limit Reached',
		bodyBlocked: 'Subscribe to Pro to use fact-checked answers.',
		bodyLifetime: (n: number) => `You've used all ${n} fact-checked answers available on your trial plan.`,
		bodyDaily: (n: number) => `You've used all ${n} fact-checked answers for today. Resets at midnight UTC.`,
		proPitch: 'Get 10 fact-checked answers per day with Pro',
		umamiUpgrade: 'subscribe-fact-checked-limit-upgrade'
	}
} as const

export function ResearchLimitModal({
	dialogStore,
	period,
	limit,
	resetTime: _resetTime,
	feature = 'research'
}: ResearchLimitModalProps) {
	const isLifetime = period === 'lifetime'
	const isBlocked = period === 'blocked'
	const { isTrial } = useAuthContext()
	const open = Ariakit.useStoreState(dialogStore, 'open')

	// Freeze the dialog choice while open: a successful upgrade flips isTrial, and swapping in the
	// paid-plan dialog would replace the success pane mid-view. The latch cannot live inside either
	// dialog, because it is what chooses between them, so it is reconciled in render instead.
	const [trialFlow, setTrialFlow] = useState<boolean | null>(null)
	if (open && trialFlow === null) setTrialFlow(isTrial)
	if (!open && trialFlow !== null) setTrialFlow(null)

	const limitBody = isLifetime ? COPY[feature].bodyLifetime(limit) : COPY[feature].bodyDaily(limit)

	// Trial users converting to a paid plan get the shared, instant-charge modal.
	if (trialFlow ?? isTrial) {
		return (
			<EndTrialModal
				isOpen={open}
				onClose={dialogStore.hide}
				title={COPY[feature].titleLimit}
				description={isBlocked ? COPY[feature].bodyBlocked : limitBody}
				confirmLabel="Upgrade to Pro"
			/>
		)
	}

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog className={`${dialogSurfaceStyles} [--dialog-width:448px]`} portal unmountOnHide>
				<div className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<DialogHeading>{COPY[feature].titleLimit}</DialogHeading>
					<DialogCloseButton />
				</div>
				<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-4`}>
					<div className="flex justify-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-warning/10 text-warning">
							<Icon name="circle-x" height={28} width={28} />
						</div>
					</div>
					<Ariakit.DialogDescription className="text-center body-md text-secondary">
						{isBlocked ? COPY[feature].bodyBlocked : limitBody}
					</Ariakit.DialogDescription>
					{isBlocked ? <p className="text-center body-sm text-tertiary">{COPY[feature].proPitch}</p> : null}
				</div>
				<div className="flex shrink-0 justify-end gap-2 border-t border-subtle px-4 py-3">
					{isBlocked ? (
						<Button
							as={BasicLink}
							href="/subscription"
							data-umami-event={COPY[feature].umamiUpgrade}
							size="md"
							variant="primary"
							onClick={dialogStore.hide}
						>
							Upgrade to Pro
						</Button>
					) : (
						// Already on a paid plan, just hit the daily cap — informational only, no upsell.
						<Button type="button" size="md" variant="primary" onClick={dialogStore.hide}>
							Got it
						</Button>
					)}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
