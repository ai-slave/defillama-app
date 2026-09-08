import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { useProDashboardSave } from '../ProDashboardAPIContext'

export function AutosaveStatus() {
	const { queued, state, retry, saving } = useProDashboardSave()
	const pending = queued !== null || saving
	const label = pending ? 'Saving changes…' : state?.status === 'error' ? 'Retry save' : 'Changes saved'
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-pro-text-secondary">
			{pending || state !== undefined ? (
				<Ariakit.Button
					onClick={retry}
					accessibleWhenDisabled
					disabled={pending || state?.status !== 'error'}
					className={`flex items-center gap-2 rounded-md px-3 py-1.5 aria-disabled:cursor-default ${!pending && state?.status === 'error' ? 'pro-btn-primary-outline' : ''}`}
				>
					{pending ? (
						<LoadingSpinner size={14} />
					) : state?.status === 'success' ? (
						<Icon name="check" height={14} width={14} />
					) : null}
					{label}
				</Ariakit.Button>
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
