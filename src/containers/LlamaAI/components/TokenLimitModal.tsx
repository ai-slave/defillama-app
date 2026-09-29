import { EndTrialModal } from '~/containers/Account/EndTrialModal'

interface TokenLimitModalProps {
	isOpen: boolean
	onClose: () => void
}

export function TokenLimitModal({ isOpen, onClose }: TokenLimitModalProps) {
	return (
		<EndTrialModal
			isOpen={isOpen}
			onClose={onClose}
			title="Daily usage limit reached"
			description="You've reached your daily AI usage limit on the trial plan. Upgrade to a full subscription for unlimited access."
			confirmLabel="Upgrade now"
		/>
	)
}
