import type { ParentProtocolLite, ProtocolLite } from '~/containers/ProtocolLists/api.types'
import type { IProtocolExpenses } from './api.types'

export type ExpenseProtocol = ProtocolLite | (ParentProtocolLite & { defillamaId: string })

export interface ProtocolExpenseRow {
	name: string
	protocol: ExpenseProtocol
	headcount: number | null
	sources: string[] | null
	sumAnnualUsdExpenses: number
}

export function buildProtocolExpenseRows({
	expenses,
	parentProtocols,
	protocols
}: {
	expenses: IProtocolExpenses[]
	parentProtocols: ParentProtocolLite[]
	protocols: ProtocolLite[]
}): ProtocolExpenseRow[] {
	const protocolById = new Map<string, ExpenseProtocol>()
	for (const protocol of protocols) protocolById.set(protocol.defillamaId, protocol)
	for (const protocol of parentProtocols) protocolById.set(protocol.id, { ...protocol, defillamaId: protocol.id })

	const rows: ProtocolExpenseRow[] = []
	for (const expense of expenses) {
		const protocol = protocolById.get(expense.protocolId)
		if (!protocol) throw new Error(`Protocol Expenses metadata is missing for ${expense.protocolId}`)

		let sumAnnualUsdExpenses = 0
		for (const category in expense.annualUsdCost) {
			const amount = expense.annualUsdCost[category]
			if (amount !== undefined) sumAnnualUsdExpenses += amount
		}

		rows.push({
			name: protocol.name,
			protocol,
			headcount: expense.headcount ?? null,
			sources: expense.sources,
			sumAnnualUsdExpenses
		})
	}

	rows.sort((a, b) => b.sumAnnualUsdExpenses - a.sumAnnualUsdExpenses)
	return rows
}
