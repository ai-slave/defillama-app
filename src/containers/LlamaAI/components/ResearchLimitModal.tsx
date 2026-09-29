import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { EndTrialModal } from '~/containers/Account/EndTrialModal'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'

interface ResearchLimitModalProps {
	dialogStore: Ariakit.DialogStore
	period: string
	limit: number
	resetTime: string | null
	feature?: 'research' | 'fact_checked'
}

const COPY = {
	research: {
		titleLimit: 'Research report limit reached',
		bodyBlocked: 'Subscribe to Pro to use research reports.',
		bodyLifetime: (n: number) => `You've used all ${n} research reports available on your plan.`,
		bodyDaily: (n: number) => `You've used all ${n} research reports for today. Resets at midnight UTC.`,
		bodyBiweekly: (n: number) => `You've used all ${n} research reports for this two-week period.`,
		proPitch: 'Get 5 research reports per day with Pro',
		umamiUpgrade: 'subscribe-research-limit-upgrade'
	},
	fact_checked: {
		titleLimit: 'Fact-checked answer limit reached',
		bodyBlocked: 'Subscribe to Pro to use fact-checked answers.',
		bodyLifetime: (n: number) => `You've used all ${n} fact-checked answers available on your plan.`,
		bodyDaily: (n: number) => `You've used all ${n} fact-checked answers for today. Resets at midnight UTC.`,
		bodyBiweekly: (n: number) => `You've used all ${n} fact-checked answers for this two-week period.`,
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
	const isBlocked = period === 'blocked'
	const { isTrial } = useAuthContext()
	const open = Ariakit.useStoreState(dialogStore, 'open')

	// Freeze the dialog choice while open: a successful upgrade flips isTrial, and swapping in the
	// paid-plan dialog would replace the success pane mid-view. The latch cannot live inside either
	// dialog, because it is what chooses between them, so it is reconciled in render instead.
	const [trialFlow, setTrialFlow] = useState<boolean | null>(null)
	if (open && trialFlow === null) setTrialFlow(isTrial)
	if (!open && trialFlow !== null) setTrialFlow(null)

	const limitBody =
		period === 'daily'
			? COPY[feature].bodyDaily(limit)
			: period === 'biweekly'
				? COPY[feature].bodyBiweekly(limit)
				: COPY[feature].bodyLifetime(limit)

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
		<Dialog size="sm" store={dialogStore} portal unmountOnHide>
			<DialogHeader title={COPY[feature].titleLimit} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					{isBlocked ? COPY[feature].bodyBlocked : limitBody}
				</Ariakit.DialogDescription>
				{isBlocked ? <p className="body-sm text-secondary">{COPY[feature].proPitch}</p> : null}
			</DialogBody>
			<DialogFooter>
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
			</DialogFooter>
		</Dialog>
	)
}
