import * as Ariakit from '@ariakit/react'
import { type FormEvent, useMemo, useState } from 'react'
import { VirtualizedSelect } from '~/components/Select/VirtualizedSelect'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { DASHBOARD_VARIABLE_LABEL_MAX_LENGTH, type DashboardVariable, MAX_DASHBOARD_VARIABLES } from '../dashboardTypes'
import { getDashboardItemBoundVariableIds } from '../dashboardVariables/bindableFields'
import { useProDashboardItemsState, useProDashboardVariables } from '../ProDashboardAPIContext'
import { AddVariablePopover, useVariableOptions } from './AddVariablePopover'

function VariableChip({ variable }: { variable: DashboardVariable }) {
	const { values, canEditVariables, setVariableValue, renameVariable, removeVariable, unbindVariable } =
		useProDashboardVariables()
	const { items } = useProDashboardItemsState()
	const { options, isLoading } = useVariableOptions(variable.kind)
	const [renameDraft, setRenameDraft] = useState<string | null>(null)
	const selectedValue = values[variable.id] ?? variable.value
	const boundCardCount = useMemo(
		() => items.filter((item) => getDashboardItemBoundVariableIds(item).includes(variable.id)).length,
		[items, variable.id]
	)

	const submitRename = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const nextLabel = (renameDraft ?? '').trim()
		if (nextLabel.length > 0) renameVariable(variable.id, nextLabel)
		setRenameDraft(null)
	}

	if (renameDraft !== null) {
		return (
			<form onSubmit={submitRename} className="flex shrink-0 items-center gap-1">
				<Input
					autoFocus
					value={renameDraft}
					aria-label={`Rename ${variable.label}`}
					maxLength={DASHBOARD_VARIABLE_LABEL_MAX_LENGTH}
					className="w-36"
					onChange={(event) => setRenameDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Escape') setRenameDraft(null)
					}}
				/>
				<Button type="submit" size="sm" square variant="ghost" aria-label="Save parameter name">
					<Icon name="check" height={14} width={14} />
				</Button>
				<Tooltip
					content="Cancel rename"
					render={
						<Button
							type="button"
							size="sm"
							square
							variant="ghost"
							aria-label="Cancel rename"
							onClick={() => setRenameDraft(null)}
						/>
					}
				>
					<Icon name="x" height={16} width={16} />
				</Tooltip>
			</form>
		)
	}

	return (
		<div className="flex shrink-0 items-center gap-1">
			<Tooltip
				content={
					canEditVariables
						? 'Saved as default'
						: boundCardCount > 0
							? `Switches ${boundCardCount} bound ${boundCardCount === 1 ? 'card' : 'cards'}`
							: null
				}
				placement="bottom"
			>
				<VirtualizedSelect
					variant="chip"
					label={variable.label}
					options={options}
					selectedValue={selectedValue}
					isLoading={isLoading}
					placeholder={variable.kind === 'chain' ? 'Select chain…' : 'Select protocol…'}
					onChange={(option) => {
						trackUmamiEvent('dashboard-variable-change', { kind: variable.kind, persist: canEditVariables })
						if (canEditVariables) setVariableValue(variable.id, option.value, { persist: true })
						else setVariableValue(variable.id, option.value)
					}}
				/>
			</Tooltip>
			{canEditVariables ? (
				<Ariakit.MenuProvider placement="bottom-end">
					<Tooltip
						content="Parameter options"
						render={
							<Ariakit.MenuButton
								render={<Button size="md" square variant="ghost" />}
								aria-label={`Parameter options for ${variable.label}`}
							/>
						}
					>
						<Icon name="ellipsis" height={16} width={16} />
					</Tooltip>
					<MenuSurface variant="actions" gutter={6}>
						<MenuItem data-umami-event="dashboard-variable-rename" onClick={() => setRenameDraft(variable.label)}>
							<Icon name="pencil" height={14} width={14} />
							<span>Rename</span>
						</MenuItem>
						<MenuItem data-umami-event="dashboard-variable-unbind" onClick={() => unbindVariable(variable.id)}>
							<Icon name="link" height={14} width={14} />
							<span>Unbind all</span>
						</MenuItem>
						<MenuItem data-umami-event="dashboard-variable-remove" onClick={() => removeVariable(variable.id)}>
							<Icon name="trash-2" height={14} width={14} />
							<span>Delete</span>
						</MenuItem>
					</MenuSurface>
				</Ariakit.MenuProvider>
			) : null}
		</div>
	)
}

export function DashboardVariablesBar() {
	const { variables, canEditVariables } = useProDashboardVariables()

	if (variables.length === 0 && !canEditVariables) return null

	return (
		<div className="flex scrollbar-none items-center gap-2 overflow-x-auto">
			{variables.map((variable) => (
				<VariableChip key={variable.id} variable={variable} />
			))}
			{canEditVariables && variables.length < MAX_DASHBOARD_VARIABLES ? <AddVariablePopover /> : null}
		</div>
	)
}
