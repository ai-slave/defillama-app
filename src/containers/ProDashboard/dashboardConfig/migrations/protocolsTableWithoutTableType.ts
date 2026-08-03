import type { PersistedProtocolsTableConfig, ProtocolsTableConfigWithoutTableType } from '../persisted'

export function migrateProtocolsTableWithoutTableType(
	config: ProtocolsTableConfigWithoutTableType
): PersistedProtocolsTableConfig {
	const { chain, ...rest } = config
	return {
		...rest,
		kind: 'table',
		tableType: 'protocols',
		chains: [chain]
	}
}
