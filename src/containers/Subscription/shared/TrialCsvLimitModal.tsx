import { EndTrialModal } from '~/containers/Account/EndTrialModal'

export function TrialCsvLimitModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	return (
		<EndTrialModal
			isOpen={isOpen}
			onClose={onClose}
			title="CSV Downloads Require Pro"
			description="You're currently on a trial plan. Upgrade to export data from any chart or table across DefiLlama."
			confirmLabel="Upgrade to Pro"
			secondaryHref="/subscription"
			secondaryLabel="View all plans"
		/>
	)
}
