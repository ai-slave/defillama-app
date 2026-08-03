type UnifiedTableV1ColumnPolicy = { disposition: 'rename'; target: string; reason: string }

export const UNIFIED_TABLE_V1_COLUMN_POLICY: Readonly<Record<string, UnifiedTableV1ColumnPolicy>> = {
	volumeChange_7d: {
		disposition: 'rename',
		target: 'volumeChange7dOver7d',
		reason: 'The v1 Lens field is seven-days-over-seven-days, not a 24h point comparison.'
	},
	volumeChange_1m: {
		disposition: 'rename',
		target: 'volumeChange30dOver30d',
		reason: 'The v1 Lens field is 30-days-over-30-days, not a 24h point comparison.'
	},
	feesChange_7d: {
		disposition: 'rename',
		target: 'feesChange7dOver7d',
		reason: 'The v1 Lens field is seven-days-over-seven-days, not a 24h point comparison.'
	},
	feesChange_1m: {
		disposition: 'rename',
		target: 'feesChange30dOver30d',
		reason: 'The v1 Lens field is 30-days-over-30-days, not a 24h point comparison.'
	},
	revenueChange_7d: {
		disposition: 'rename',
		target: 'revenueChange7dOver7d',
		reason: 'The v1 Lens field is seven-days-over-seven-days, not a 24h point comparison.'
	},
	revenueChange_1m: {
		disposition: 'rename',
		target: 'revenueChange30dOver30d',
		reason: 'The v1 Lens field is 30-days-over-30-days, not a 24h point comparison.'
	},
	perps_volume_change_7d: {
		disposition: 'rename',
		target: 'perpsVolumeChange7dOver7d',
		reason: 'The v1 Lens field is seven-days-over-seven-days, not a 24h point comparison.'
	},
	perps_volume_change_1m: {
		disposition: 'rename',
		target: 'perpsVolumeChange30dOver30d',
		reason: 'The v1 Lens field is 30-days-over-30-days, not a 24h point comparison.'
	},
	aggregators_volume_change_7d: {
		disposition: 'rename',
		target: 'aggregatorVolumeChange7dOver7d',
		reason: 'The v1 Lens field is seven-days-over-seven-days, not a 24h point comparison.'
	},
	derivatives_aggregators_volume_change_7d: {
		disposition: 'rename',
		target: 'derivativesAggregatorVolumeChange7dOver7d',
		reason: 'The v1 Lens field is seven-days-over-seven-days, not a 24h point comparison.'
	},
	derivatives_aggregators_volume_change_1m: {
		disposition: 'rename',
		target: 'derivativesAggregatorVolumeChange30dOver30d',
		reason: 'The v1 Lens field is 30-days-over-30-days, not a 24h point comparison.'
	},
	options_volume_change_7d: {
		disposition: 'rename',
		target: 'optionsVolumeChange7dOver7d',
		reason: 'The v1 Lens field is seven-days-over-seven-days, not a 24h point comparison.'
	}
}

export function migrateUnifiedTableV1ColumnId(id: string): string {
	return UNIFIED_TABLE_V1_COLUMN_POLICY[id]?.target ?? id
}
