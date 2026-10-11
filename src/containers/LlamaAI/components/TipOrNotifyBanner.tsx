import { useState } from 'react'
import { LlamaAITipBanner } from '~/containers/LlamaAI/components/LlamaAITipBanner'
import { NotificationPermissionBanner } from '~/containers/LlamaAI/components/NotificationPermissionBanner'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { useActiveTip } from '~/containers/LlamaAI/hooks/useLlamaAITip'
import { useAiBalance } from '~/containers/Subscription/useTopup'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { focusComposerOnLeave } from './ComposerTray'

export function TipOrNotifyBanner({
	premiumResponseId,
	answerRunning
}: {
	premiumResponseId?: string
	/** The notification prompt shows only while an answer runs, never on the empty chat or after a rejected send. */
	answerRunning: boolean
}) {
	return premiumResponseId ? (
		<LowBalanceTip key={premiumResponseId} answerRunning={answerRunning} />
	) : (
		<DefaultTip answerRunning={answerRunning} />
	)
}

function DefaultTip({ answerRunning }: { answerRunning: boolean }) {
	const { tip } = useActiveTip()
	if (tip) return <LlamaAITipBanner />
	return answerRunning ? <NotificationPermissionBanner /> : null
}

function LowBalanceTip({ answerRunning }: { answerRunning: boolean }) {
	const { balance, totalAvailable } = useAiBalance()
	const actions = useTipActions()
	const [dismissed, setDismissed] = useState(false)
	if (dismissed || !balance || totalAvailable >= 1) return <DefaultTip answerRunning={answerRunning} />
	return (
		<div
			ref={focusComposerOnLeave}
			className="flex items-center gap-3 rounded-lg border border-subtle bg-surface px-3.5 py-2.5"
		>
			<p className="min-w-0 flex-1 body-sm text-secondary">Your external data balance is low.</p>
			<Button type="button" size="sm" onClick={() => actions.openSettingsModal?.('balance')}>
				Top up
			</Button>
			<Tooltip
				content="Dismiss"
				render={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						square
						aria-label="Dismiss low balance notice"
						onClick={() => setDismissed(true)}
					/>
				}
			>
				<Icon name="x" className="size-3.5" />
			</Tooltip>
		</div>
	)
}
