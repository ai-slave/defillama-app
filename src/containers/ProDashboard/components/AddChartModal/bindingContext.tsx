import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import type { VirtualizedSelectOption } from '~/ui/VirtualizedSelect'
import type { DashboardVariable, DashboardVariableKind } from '../../dashboardTypes'
import { useProDashboardVariables } from '../../ProDashboardAPIContext'
import type { DashboardBindableField, DashboardItemBindings } from '../../types'

const DASHBOARD_PARAMETER_OPTION_PREFIX = 'dashboard-parameter:'

interface ModalBindingsValue {
	bindings: DashboardItemBindings
	setBinding: (field: DashboardBindableField, variableId: string | null) => void
}

const ModalBindingsContext = createContext<ModalBindingsValue | null>(null)

export function ModalBindingsProvider({
	bindings,
	setBinding,
	children
}: ModalBindingsValue & { children: ReactNode }) {
	const value = useMemo(() => ({ bindings, setBinding }), [bindings, setBinding])
	return <ModalBindingsContext.Provider value={value}>{children}</ModalBindingsContext.Provider>
}

export interface ModalFieldBinding {
	options: Array<VirtualizedSelectOption>
	boundVariable: DashboardVariable | null
	bind: (variableId: string) => void
	unbind: () => void
	resolveSelection: (value: string) => DashboardVariable | null
}

const NO_OPTIONS: Array<VirtualizedSelectOption> = []

export function useModalFieldBinding(field: DashboardBindableField, kind: DashboardVariableKind): ModalFieldBinding {
	const context = useContext(ModalBindingsContext)
	const { variables } = useProDashboardVariables()
	const matching = useMemo(() => variables.filter((variable) => variable.kind === kind), [variables, kind])
	const boundId = context?.bindings[field] ?? null

	return useMemo(() => {
		const options = matching.map((variable) => ({
			value: `${DASHBOARD_PARAMETER_OPTION_PREFIX}${variable.id}`,
			label: variable.label,
			description: kind === 'chain' ? 'Dashboard parameter: Chain' : 'Dashboard parameter: Protocol'
		}))
		return {
			options: context ? options : NO_OPTIONS,
			boundVariable: matching.find((variable) => variable.id === boundId) ?? null,
			bind: (variableId: string) => context?.setBinding(field, variableId),
			unbind: () => context?.setBinding(field, null),
			resolveSelection: (value: string) => {
				if (!value.startsWith(DASHBOARD_PARAMETER_OPTION_PREFIX)) return null
				const id = value.slice(DASHBOARD_PARAMETER_OPTION_PREFIX.length)
				return matching.find((variable) => variable.id === id) ?? null
			}
		}
	}, [context, matching, boundId, field, kind])
}

export function BoundParameterChip({ label, onUnbind }: { label: string; onUnbind: () => void }) {
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-md border border-medium bg-surface px-2 py-1 body-sm text-secondary">
			<Icon name="link" className="size-3 text-link" />
			<span className="text-primary">Bound to {label}</span>
			<Button variant="link" onClick={onUnbind} data-umami-event="dashboard-parameter-unbind" className="ml-auto">
				Unbind
			</Button>
		</div>
	)
}
