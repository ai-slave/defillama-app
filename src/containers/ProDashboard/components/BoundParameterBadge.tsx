import { useMemo } from 'react'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { DashboardVariable } from '../dashboardTypes'
import { getDashboardItemBoundVariableIds } from '../dashboardVariables/bindableFields'
import { useProDashboardPermissions, useProDashboardVariables } from '../ProDashboardAPIContext'
import type { DashboardItemBindings } from '../types'

interface BoundParameterBadgeProps {
	bindings?: DashboardItemBindings | undefined
	item?: DashboardItemConfig | undefined
}

export function BoundParameterBadge({ bindings, item }: BoundParameterBadgeProps) {
	const { variables } = useProDashboardVariables()
	const { isReadOnly } = useProDashboardPermissions()

	const boundVariables = useMemo<Array<DashboardVariable>>(() => {
		const boundIds = item ? getDashboardItemBoundVariableIds(item) : Object.values(bindings ?? {})
		const matched: Array<DashboardVariable> = []
		const seen = new Set<string>()
		for (const variableId of boundIds) {
			if (!variableId || seen.has(variableId)) continue
			seen.add(variableId)
			const variable = variables.find((candidate) => candidate.id === variableId)
			if (variable) matched.push(variable)
		}
		return matched
	}, [bindings, item, variables])

	if (boundVariables.length === 0) return null

	return (
		<>
			{boundVariables.map((variable) => (
				<span
					key={variable.id}
					title={isReadOnly ? `Follows the ${variable.label} parameter` : 'Bound to dashboard parameter'}
					className="inline-flex shrink-0 items-center rounded-full border border-medium bg-surface px-2 py-0.5 label-sm text-secondary"
				>
					{variable.label}
				</span>
			))}
		</>
	)
}
