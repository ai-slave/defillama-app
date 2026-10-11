import { useState } from 'react'
import { LlamaAITipBanner } from '~/containers/LlamaAI/components/LlamaAITipBanner'
import { NotificationPermissionBanner } from '~/containers/LlamaAI/components/NotificationPermissionBanner'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { useActiveTip } from '~/containers/LlamaAI/hooks/useLlamaAITip'
import { useAiBalance } from '~/containers/Subscription/useTopup'
import { ComposerTip } from './ComposerTip'

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
		<ComposerTip
			message="Your external data balance is low."
			action={{ label: 'Top up', onClick: () => actions.openSettingsModal?.('balance') }}
			dismissLabel="Dismiss low balance notice"
			onDismiss={() => setDismissed(true)}
		/>
	)
}
