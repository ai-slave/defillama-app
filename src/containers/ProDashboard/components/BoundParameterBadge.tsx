import { useMemo } from 'react'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
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
				<Tooltip
					key={variable.id}
					content={isReadOnly ? `Follows the ${variable.label} parameter` : 'Bound to dashboard parameter'}
					render={<Tag className="shrink-0" />}
					tabIndex={0}
				>
					{variable.label}
					{/* The tooltip is not announced (Tooltip header), so the tab stop's name carries its meaning. */}
					<span className="sr-only">
						{isReadOnly ? `, follows the ${variable.label} parameter` : ', bound to dashboard parameter'}
					</span>
				</Tooltip>
			))}
		</>
	)
}
