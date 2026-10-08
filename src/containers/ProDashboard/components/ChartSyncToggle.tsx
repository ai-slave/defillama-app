import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { useChartSyncPreference } from './useChartSyncGroup'

export function ChartSyncToggle() {
	const { enabled, toggle } = useChartSyncPreference()
	return (
		<Tooltip
			content={enabled ? 'Charts share hover and zoom. Click to unlink.' : 'Link hover and zoom across charts'}
			render={
				<Button
					type="button"
					size="md"
					square
					variant="ghost"
					data-active={enabled}
					aria-label="Sync charts"
					aria-pressed={enabled}
					data-umami-event="dashboard-sync-toggle"
					onClick={toggle}
				/>
			}
		>
			<Icon name="link" height={16} width={16} />
		</Tooltip>
	)
}
