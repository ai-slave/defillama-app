import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import type { MultiChartConfig } from '~/containers/ProDashboard/types'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import type { DashboardChartConfig, LlamaAIChartInput } from './addToDashboardContract'
import { AddToDashboardModal } from './AddToDashboardModal'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

interface AddToDashboardButtonProps {
	chartConfig: DashboardChartConfig | null
	multiChart?: MultiChartConfig | null
	llamaAIChart?: LlamaAIChartInput | null
	unsupportedMetrics?: Array<string>
	variant?: 'button' | 'icon'
	className?: string
	smol?: boolean
	disabled?: boolean
}

export function AddToDashboardButton({
	chartConfig,
	multiChart,
	llamaAIChart,
	unsupportedMetrics,
	variant = 'button',
	className,
	smol,
	disabled
}: AddToDashboardButtonProps) {
	const dashboardDialogStore = Ariakit.useDialogStore()
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeDialogStore = Ariakit.useDialogStore({
		open: shouldRenderModal,
		setOpen: setShouldRenderModal
	})
	const { loaders, isAuthenticated, hasActiveSubscription } = useAuthContext()
	const isClient = useIsClient()

	const config = chartConfig ?? multiChart
	const hasConfig = config || llamaAIChart

	const handleClick = () => {
		if (!hasConfig || disabled) return

		if (hasActiveSubscription && isAuthenticated) {
			dashboardDialogStore.show()
		} else {
			setSignupSource('add-to-dashboard')
			subscribeDialogStore.show()
		}
	}

	const showLabel = !smol && variant === 'button'
	const button = (
		<Tooltip
			content="Add to Custom Dashboard"
			render={
				<Button
					type="button"
					size="md"
					square={smol ?? false}
					onClick={handleClick}
					disabled={loaders.userLoading || disabled || !hasConfig}
					className={className}
					data-umami-event="dashboard-add-chart"
					aria-label={showLabel ? undefined : 'Add to Custom Dashboard'}
				/>
			}
		>
			<Icon name="plus" className="size-4" />
			{showLabel ? <span>Add to Dashboard</span> : null}
		</Tooltip>
	)

	return (
		<>
			{button}
			{isClient && hasConfig ? (
				<>
					<AddToDashboardModal
						dialogStore={dashboardDialogStore}
						chartConfig={config ?? null}
						{...(llamaAIChart === undefined ? {} : { llamaAIChart })}
						{...(unsupportedMetrics === undefined ? {} : { unsupportedMetrics })}
					/>
					{shouldRenderModal ? (
						<Suspense fallback={null}>
							<SubscribeProModal dialogStore={subscribeDialogStore} />
						</Suspense>
					) : null}
				</>
			) : null}
		</>
	)
}
