import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { tw } from '~/ui/tw'
import { useProDashboardSave } from '../ProDashboardAPIContext'
import { proButtonStyles } from '../ui'

const AUTOSAVE_STATUS_TEXT = tw`inline-flex items-center gap-1.5 text-xs text-pro-text-tertiary aria-disabled:cursor-default`

export function AutosaveStatus() {
	const { queued, state, retry, saving } = useProDashboardSave()
	const pending = queued !== null || saving
	const canRetry = !pending && state?.status === 'error'
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-pro-text-secondary">
			{pending || state !== undefined ? (
				<Ariakit.Button
					type="button"
					onClick={retry}
					accessibleWhenDisabled
					disabled={!canRetry}
					className={canRetry ? proButtonStyles({ size: 'sm', variant: 'secondary' }) : AUTOSAVE_STATUS_TEXT}
				>
					{pending ? (
						<LoadingSpinner size={14} />
					) : state?.status === 'success' ? (
						<Icon name="check" height={14} width={14} />
					) : null}
					{pending ? 'Saving changes…' : canRetry ? 'Retry save' : 'Changes saved'}
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
