import type { OracleNamesByProtocol } from '~/containers/Oracles/membership'
import type { Protocol } from './types'

export interface OracleFilterOption {
	value: string
	label: string
}

export function buildOracleFilterOptions(
	protocols: ReadonlyArray<Protocol>,
	oracleNamesByProtocol: OracleNamesByProtocol
): Array<OracleFilterOption> {
	const childOraclesByParent = new Map<string, Set<string>>()
	for (const protocol of protocols) {
		if (!protocol.parentProtocol) continue
		let childOracles = childOraclesByParent.get(protocol.parentProtocol)
		if (!childOracles) {
			childOracles = new Set()
			childOraclesByParent.set(protocol.parentProtocol, childOracles)
		}
		for (const oracle of oracleNamesByProtocol.get(protocol.name) ?? []) childOracles.add(oracle)
	}

	const totals = new Map<string, number>()
	for (const protocol of protocols) {
		if (protocol.parentProtocol) continue
		const oracles = new Set(oracleNamesByProtocol.get(protocol.name) ?? [])
		for (const oracle of childOraclesByParent.get(protocol.id) ?? []) oracles.add(oracle)
		for (const oracle of oracles) totals.set(oracle, (totals.get(oracle) ?? 0) + protocol.tvl)
	}

	return Array.from(totals)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([oracle]) => ({ value: oracle, label: oracle }))
}
