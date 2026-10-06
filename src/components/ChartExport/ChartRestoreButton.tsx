import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

interface ChartRestoreButtonProps {
	chartInstance: () => echarts.ECharts | null
	smol?: boolean
}

export function ChartRestoreButton({ chartInstance, smol = true }: ChartRestoreButtonProps) {
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
				<Button
					size="md"
					data-umami-event="chart-restore"
					data-umami-event-page={router.pathname}
					onClick={handleRestore}
				/>
			}
		>
			<Icon name="repeat" className="size-3.5" />
			<span>{smol ? 'reset' : 'Restore'}</span>
		</Tooltip>
	)
}
