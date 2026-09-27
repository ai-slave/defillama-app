import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

const DEFAULT_CLASSNAME = buttonStyles({ size: 'md' })

interface ChartRestoreButtonProps {
	chartInstance: () => echarts.ECharts | null
	className?: string
	smol?: boolean
}

export function ChartRestoreButton({
	chartInstance,
	className = DEFAULT_CLASSNAME,
	smol = true
}: ChartRestoreButtonProps) {
	const router = useRouter()

	const handleRestore = () => {
		const instance = chartInstance()
		if (!instance) return
		instance.dispatchAction({ type: 'restore' })
	}

	return (
		<Tooltip
			content="Restore chart view"
			render={
				<button
					type="button"
					data-umami-event="chart-restore"
					data-umami-event-page={router.pathname}
					onClick={handleRestore}
				/>
			}
			className={className}
		>
			<Icon name="repeat" height={12} width={12} />
			<span>{smol ? 'reset' : 'Restore'}</span>
		</Tooltip>
	)
}
