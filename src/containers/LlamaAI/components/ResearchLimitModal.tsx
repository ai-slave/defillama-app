import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { BasicLink } from '~/components/Link'
import { EndTrialModal } from '~/containers/Account/EndTrialModal'
import type { UsageLimitOffer, UsageLimitPeriod } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { formatDate } from '~/utils/dateFormat'

interface ResearchLimitModalProps {
	dialogStore: Ariakit.DialogStore
	period: UsageLimitPeriod
	limit: number
	resetTime: string | null
	feature?: 'research' | 'fact_checked'
}

const COPY = {
	research: {
		titleLimit: 'Research report limit reached',
		titleBlocked: 'Research reports are part of Pro',
		bodyBlocked: 'Subscribe to Pro to use research reports.',
		bodyLifetime: (n: number) => `You've used all ${n} research reports available on your plan.`,
		bodyDaily: (n: number) => `You've used all ${n} research reports for today. Resets at midnight UTC.`,
		bodyBiweekly: (n: number, next: string | null) =>
			n === 1
				? `You've used your free research report.${next ? ` Next one on ${next}.` : ''}`
				: `You've used all ${n} research reports for this two-week period.${next ? ` Next ones on ${next}.` : ''}`,
		proPitch: 'Get 5 research reports per day with Pro',
		umamiUpgrade: 'subscribe-research-limit-upgrade'
	},
	fact_checked: {
		titleLimit: 'Fact-checked answer limit reached',
		titleBlocked: 'Fact-checked answers are part of Pro',
		bodyBlocked: 'Subscribe to Pro to use fact-checked answers.',
		bodyLifetime: (n: number) => `You've used all ${n} fact-checked answers available on your plan.`,
		bodyDaily: (n: number) => `You've used all ${n} fact-checked answers for today. Resets at midnight UTC.`,
		bodyBiweekly: (n: number) => `You've used all ${n} fact-checked answers for this two-week period.`,
		proPitch: 'Get 10 fact-checked answers per day with Pro',
		umamiUpgrade: 'subscribe-fact-checked-limit-upgrade'
	}
} as const

export function getUsageLimitText({ feature, period, limit, resetTime }: UsageLimitOffer): string {
	const copy = COPY[feature]
	if (period === 'blocked') return `${copy.bodyBlocked} ${copy.proPitch}.`
	if (period === 'daily') return copy.bodyDaily(limit)
	if (period === 'biweekly') return copy.bodyBiweekly(limit, resetTime ? formatDate(resetTime) : null)
	return copy.bodyLifetime(limit)
}

export function UsageLimitActions({ offer }: { offer: UsageLimitOffer }) {
	const { isTrial } = useAuthContext()
	const [endTrialOpen, setEndTrialOpen] = useState(false)
	const copy = COPY[offer.feature]

	if (isTrial) {
		return (
			<div className="my-2.5 flex">
				<Button type="button" size="md" variant="primary" onClick={() => setEndTrialOpen(true)}>
					Upgrade to Pro
				</Button>
				<EndTrialModal
					isOpen={endTrialOpen}
					onClose={() => setEndTrialOpen(false)}
					title={copy.titleLimit}
					description={getUsageLimitText(offer)}
					confirmLabel="Upgrade to Pro"
				/>
			</div>
		)
	}
	if (offer.period === 'biweekly' || offer.period === 'blocked') {
		return (
			<div className="my-2.5 flex">
				<TrialOrUpgradeLink umamiEvent={copy.umamiUpgrade} />
			</div>
		)
	}
	return null
}

function TrialOrUpgradeLink({ umamiEvent, onClick }: { umamiEvent: string; onClick?: () => void }) {
	const { isTrialAvailable } = useSubscribe()
	return (
		<Button
			as={BasicLink}
			href="/subscription"
			data-umami-event={umamiEvent}
			size="md"
			variant="primary"
			onClick={onClick}
		>
			{isTrialAvailable ? 'Start 7-day free trial' : 'Upgrade to Pro'}
		</Button>
	)
}

export function ResearchLimitModal({
	dialogStore,
	period,
	limit,
	resetTime,
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

	const limitBody = getUsageLimitText({ feature, period, limit, resetTime })

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
			<DialogHeader title={isBlocked ? COPY[feature].titleBlocked : COPY[feature].titleLimit} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					{isBlocked ? COPY[feature].bodyBlocked : limitBody}
				</Ariakit.DialogDescription>
				{isBlocked ? <p className="body-sm text-secondary">{COPY[feature].proPitch}</p> : null}
			</DialogBody>
			<DialogFooter>
				{isBlocked ? (
					<TrialOrUpgradeLink umamiEvent={COPY[feature].umamiUpgrade} onClick={dialogStore.hide} />
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
