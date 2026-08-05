export const PROTOCOL_RANKING_STORAGE_KEYS = {
	columns: 'ptc',
	legacyPreset: 'ptcfs',
	metricPreset: 'ptcmp',
	period: 'ptcp'
} as const

export const PROTOCOL_RANKING_RESET_STORAGE_KEYS = [
	PROTOCOL_RANKING_STORAGE_KEYS.legacyPreset,
	PROTOCOL_RANKING_STORAGE_KEYS.metricPreset,
	PROTOCOL_RANKING_STORAGE_KEYS.period,
	PROTOCOL_RANKING_STORAGE_KEYS.columns
] as const

export const PROTOCOL_RANKING_RESET_QUERY = { minTvl: undefined, maxTvl: undefined } as const
