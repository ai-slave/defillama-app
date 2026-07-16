import type { DatasetSnapshotDomain } from './contract'
import type { DatasetSnapshotBuilder } from './store'

/** Domain registration: builder ownership and refresh policy live in one place. */
export type DatasetSnapshotRegistration = {
	builder: DatasetSnapshotBuilder
	maxAgeMs: number
}

const HOURLY_SNAPSHOT_MAX_AGE_MS = 60 * 60 * 1000

export const DATASET_SNAPSHOT_REGISTRY: Record<DatasetSnapshotDomain, DatasetSnapshotRegistration> = {
	yields: {
		builder: async (writer) =>
			(await import('~/containers/Yields/server/dataset.builder.server')).buildYieldsSnapshotCandidate(writer),
		maxAgeMs: HOURLY_SNAPSHOT_MAX_AGE_MS
	},
	'token-rights': {
		builder: async (writer) =>
			(await import('~/containers/TokenRights/server/dataset.builder.server')).buildTokenRightsDomain(writer),
		maxAgeMs: HOURLY_SNAPSHOT_MAX_AGE_MS
	},
	risk: {
		builder: async (writer) =>
			(await import('~/containers/Token/server/dataset.risk.builder.server')).buildRiskDomain(writer),
		maxAgeMs: HOURLY_SNAPSHOT_MAX_AGE_MS
	},
	raises: {
		builder: async (writer) =>
			(await import('~/containers/Raises/server/dataset.builder.server')).buildRaisesDomain(writer),
		maxAgeMs: HOURLY_SNAPSHOT_MAX_AGE_MS
	},
	treasuries: {
		builder: async (writer) =>
			(await import('~/containers/Treasuries/server/dataset.builder.server')).buildTreasuriesDomain(writer),
		maxAgeMs: HOURLY_SNAPSHOT_MAX_AGE_MS
	},
	liquidity: {
		builder: async (writer) =>
			(await import('~/containers/Token/server/dataset.liquidity.builder.server')).buildLiquidityDomain(writer),
		maxAgeMs: HOURLY_SNAPSHOT_MAX_AGE_MS
	},
	liquidations: {
		builder: async (writer) =>
			(await import('~/containers/LiquidationsV2/server/dataset.builder.server')).buildLiquidationsDomain(writer),
		maxAgeMs: HOURLY_SNAPSHOT_MAX_AGE_MS
	},
	markets: {
		builder: async (writer) =>
			(await import('~/containers/Markets/server/dataset.builder.server')).buildMarketsDomain(writer),
		maxAgeMs: HOURLY_SNAPSHOT_MAX_AGE_MS
	}
}
