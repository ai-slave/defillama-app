import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { ParameterUnavailable } from '../dashboardVariables/resolve'
import { useProDashboardVariables } from '../ProDashboardAPIContext'

export function ParameterUnavailableCard({
	item,
	unavailable,
	onEdit
}: {
	item: DashboardItemConfig
	unavailable: ParameterUnavailable
	onEdit?: (() => void) | undefined
}) {
	const { variables } = useProDashboardVariables()
	const label = variables.find((variable) => variable.id === unavailable.variableId)?.label ?? unavailable.variableId
	return (
		<div
			className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-2 p-4 text-center"
			data-testid="parameter-unavailable"
		>
			<Icon name="alert-triangle" height={20} width={20} className="text-sub-orange" />
			<p className="body-md text-pro-text-secondary">
				This card follows the “{label}” parameter, but {unavailable.reason}
			</p>
			{onEdit ? (
				<Button size="sm" variant="secondary" onClick={onEdit} data-item-id={item.id}>
					Edit card
				</Button>
			) : null}
		</div>
	)
}
