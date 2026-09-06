import type { IOracleMetrics } from './api.types'

export type OracleNamesByProtocol = ReadonlyMap<string, ReadonlyArray<string>>

export function buildOracleNamesByProtocol(oracles: IOracleMetrics['oracles']): OracleNamesByProtocol {
	const namesByProtocol = new Map<string, Array<string>>()
	for (const oracleName in oracles) {
		const protocolNames = oracles[oracleName]
		if (protocolNames === undefined) throw new Error(`Missing protocol membership for oracle ${oracleName}`)
		for (const protocolName of protocolNames) {
			const oracleNames = namesByProtocol.get(protocolName)
			if (oracleNames) oracleNames.push(oracleName)
			else namesByProtocol.set(protocolName, [oracleName])
		}
	}
	return namesByProtocol
}
