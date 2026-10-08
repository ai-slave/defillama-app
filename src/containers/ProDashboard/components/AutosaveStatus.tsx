import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { useProDashboardSave } from '../ProDashboardAPIContext'

export function AutosaveStatus() {
	const { queued, state, retry, saving } = useProDashboardSave()
	const pending = queued !== null || saving
	const canRetry = !pending && state?.status === 'error'
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2 body-md text-secondary">
			{pending || state !== undefined ? (
				// One element in every state, so a focused Retry keeps focus through saving and saved.
				<Button
					type="button"
					size="sm"
					variant={canRetry ? 'secondary' : 'ghost'}
					onClick={retry}
					pendingLabel={pending ? 'Saving changes…' : null}
					accessibleWhenDisabled
					disabled={!canRetry && !pending}
				>
					{state?.status === 'success' ? <Icon name="check" height={14} width={14} /> : null}
					{canRetry ? 'Retry save' : 'Changes saved'}
				</Button>
			) : null}
			<span role="status" className="sr-only">
				{pending ? 'Saving changes' : state?.status === 'success' ? 'Changes saved' : ''}
			</span>
			{!pending && state?.status === 'error' ? (
				<p role="alert" className="text-error">
					Changes couldn’t be saved. Keep this page open and retry.
				</p>
			) : null}
			{!pending && state?.data?.artifactActivationPending ? (
				<p role="alert">Dashboard saved, but chart refresh setup is pending.</p>
			) : null}
		</div>
	)
}
