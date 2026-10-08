import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { slugifyVariableId, suggestVariableBindings } from '../dashboardVariables/resolve'
import { useProDashboardCatalog, useProDashboardItemsState, useProDashboardVariables } from '../ProDashboardAPIContext'
import { VARIABLE_KIND_LABELS } from './AddVariablePopover'

export function ParameterHint() {
	const { variables, candidates, canEditVariables, addVariable } = useProDashboardVariables()
	const { items } = useProDashboardItemsState()
	const { protocolBySlug } = useProDashboardCatalog()

	const candidate = candidates[0]
	if (!canEditVariables || variables.length > 0 || !candidate) return null

	const label = VARIABLE_KIND_LABELS[candidate.kind]
	const displayValue =
		candidate.kind === 'protocol' ? (protocolBySlug.get(candidate.value)?.name ?? candidate.value) : candidate.value

	const createParameter = () => {
		const id = slugifyVariableId(label, new Set(variables.map((variable) => variable.id)))
		addVariable(
			{ id, kind: candidate.kind, label, value: candidate.value },
			suggestVariableBindings(items, candidate.kind, candidate.value)
		)
	}

	return (
		<div className="flex items-center gap-2 text-secondary">
			<Button variant="ghost" size="sm" onClick={createParameter} data-umami-event="dashboard-variable-add">
				<Icon name={candidate.kind} height={14} width={14} />
				<span>{`Make ${displayValue} a parameter`}</span>
			</Button>
			<span className="body-xs text-tertiary">{`${candidate.count} cards use it`}</span>
		</div>
	)
}
