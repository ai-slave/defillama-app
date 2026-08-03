import type { ProtocolSupplementalMetric } from '../protocolCapabilities'
import type { UnifiedTableConfig } from './current'

export type ProtocolMembershipBaseFamily =
	| 'fees'
	| 'holder-revenue'
	| 'dex-volume'
	| 'perps-volume'
	| 'open-interest'
	| 'revenue'
	| 'aggregator-volume'
	| 'options-volume'

export type ProtocolRowMembership =
	| { kind: 'all-protocols' }
	| { kind: 'base-metric'; family: ProtocolMembershipBaseFamily }
	| { kind: 'supplemental-metric'; metric: ProtocolSupplementalMetric }

const ALL_PROTOCOLS_MEMBERSHIP: ProtocolRowMembership = { kind: 'all-protocols' }

export type ProtocolRowMembershipKey =
	| 'all-protocols'
	| 'base:fees'
	| 'base:holder-revenue'
	| 'base:dex-volume'
	| 'base:perps-volume'
	| 'base:open-interest'
	| 'base:revenue'
	| 'base:aggregator-volume'
	| 'base:options-volume'
	| 'supplemental:earnings'
	| 'supplemental:bridge-aggregator-volume'

const PROTOCOL_ROW_MEMBERSHIP_BY_KEY: Readonly<Record<ProtocolRowMembershipKey, ProtocolRowMembership>> = {
	'all-protocols': ALL_PROTOCOLS_MEMBERSHIP,
	'base:fees': { kind: 'base-metric', family: 'fees' },
	'base:holder-revenue': { kind: 'base-metric', family: 'holder-revenue' },
	'base:dex-volume': { kind: 'base-metric', family: 'dex-volume' },
	'base:perps-volume': { kind: 'base-metric', family: 'perps-volume' },
	'base:open-interest': { kind: 'base-metric', family: 'open-interest' },
	'base:revenue': { kind: 'base-metric', family: 'revenue' },
	'base:aggregator-volume': { kind: 'base-metric', family: 'aggregator-volume' },
	'base:options-volume': { kind: 'base-metric', family: 'options-volume' },
	'supplemental:earnings': { kind: 'supplemental-metric', metric: 'earnings' },
	'supplemental:bridge-aggregator-volume': {
		kind: 'supplemental-metric',
		metric: 'bridge-aggregator-volume'
	}
}

/**
 * Stable preset semantics for saved configs. Keep old IDs here even if the visible preset catalog changes:
 * migration preserves activePresetId, and the server uses this mapping to avoid returning thousands of
 * protocols that have no value in a metric-specific table.
 */
const PROTOCOL_ROW_MEMBERSHIP_BY_PRESET_ID: Readonly<Record<string, ProtocolRowMembership>> = {
	'fees-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['base:fees'],
	'holders-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['base:holder-revenue'],
	'volume-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['base:dex-volume'],
	'perps-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['base:perps-volume'],
	'open-interest-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['base:open-interest'],
	'revenue-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['base:revenue'],
	'earnings-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['supplemental:earnings'],
	'aggregators-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['base:aggregator-volume'],
	'bridge-aggregators-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['supplemental:bridge-aggregator-volume'],
	'options-protocols': PROTOCOL_ROW_MEMBERSHIP_BY_KEY['base:options-volume']
}

export function getProtocolRowMembershipKey(membership: ProtocolRowMembership): ProtocolRowMembershipKey {
	switch (membership.kind) {
		case 'all-protocols':
			return 'all-protocols'
		case 'base-metric':
			switch (membership.family) {
				case 'fees':
					return 'base:fees'
				case 'holder-revenue':
					return 'base:holder-revenue'
				case 'dex-volume':
					return 'base:dex-volume'
				case 'perps-volume':
					return 'base:perps-volume'
				case 'open-interest':
					return 'base:open-interest'
				case 'revenue':
					return 'base:revenue'
				case 'aggregator-volume':
					return 'base:aggregator-volume'
				case 'options-volume':
					return 'base:options-volume'
				default:
					return membership.family satisfies never
			}
		case 'supplemental-metric':
			return `supplemental:${membership.metric}`
		default:
			return membership satisfies never
	}
}

export function parseProtocolRowMembershipKey(key: string): ProtocolRowMembership | null {
	switch (key) {
		case 'all-protocols':
		case 'base:fees':
		case 'base:holder-revenue':
		case 'base:dex-volume':
		case 'base:perps-volume':
		case 'base:open-interest':
		case 'base:revenue':
		case 'base:aggregator-volume':
		case 'base:options-volume':
		case 'supplemental:earnings':
		case 'supplemental:bridge-aggregator-volume':
			return PROTOCOL_ROW_MEMBERSHIP_BY_KEY[key]
		default:
			return null
	}
}

export function getProtocolRowMembership(config: Pick<UnifiedTableConfig, 'activePresetId'>): ProtocolRowMembership {
	return config.activePresetId
		? (PROTOCOL_ROW_MEMBERSHIP_BY_PRESET_ID[config.activePresetId] ?? ALL_PROTOCOLS_MEMBERSHIP)
		: ALL_PROTOCOLS_MEMBERSHIP
}
