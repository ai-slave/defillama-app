import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import type { MultiChartConfig } from '~/containers/ProDashboard/types'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { ClientOnly } from '~/layout/ClientOnly'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import type { DashboardChartConfig, LlamaAIChartInput } from './addToDashboardContract'
import { AddToDashboardModal } from './AddToDashboardModal'

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
	const subscribeDialogStore = Ariakit.useDialogStore()
	const { loaders, isAuthenticated, hasActiveSubscription } = useAuthContext()

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
			{hasConfig ? (
				<ClientOnly>
					<AddToDashboardModal
						dialogStore={dashboardDialogStore}
						chartConfig={config ?? null}
						{...(llamaAIChart === undefined ? {} : { llamaAIChart })}
						{...(unsupportedMetrics === undefined ? {} : { unsupportedMetrics })}
					/>
					<LazySubscribeProModal dialogStore={subscribeDialogStore} />
				</ClientOnly>
			) : null}
		</>
	)
}
