import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { ProButton } from '../ui'
import { useChartSyncPreference } from './useChartSyncGroup'

export function ChartSyncToggle() {
	const { enabled, toggle } = useChartSyncPreference()
	return (
		<Tooltip
			content={enabled ? 'Charts share hover and zoom. Click to unlink.' : 'Link hover and zoom across charts'}
			render={
				<ProButton
					type="button"
					square
					variant={enabled ? 'primary' : 'ghost'}
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
