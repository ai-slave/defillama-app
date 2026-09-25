import { describe, expect, test, vi } from 'vitest'

// The module opens a DB pool on import; these tests only use its pure helpers.
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))

import { aggregateMetrics } from '../../components/UnifiedTable/utils/aggregation'
import type { ProtocolTableSourceRow } from '../../unifiedTable/contracts'
import { EMPTY_CANONICAL_CHAIN_METRICS } from '../../unifiedTable/contracts'
import {
	applyChainPointComparisons,
	applyProtocolPointComparisons,
	type PointComparisonRow,
	pointColumns,
	type ProtocolPointComparisonData
} from './pointComparisons'

const comparison = (overrides: Partial<PointComparisonRow>): PointComparisonRow => ({
	entity_id: 'protocol',
	chain_slug: null,
	volume_7d_ago: null,
	volume_30d_ago: null,
	fees_7d_ago: null,
	fees_30d_ago: null,
	revenue_7d_ago: null,
	revenue_30d_ago: null,
	perps_volume_7d_ago: null,
	perps_volume_30d_ago: null,
	aggregator_volume_7d_ago: null,
	aggregator_volume_30d_ago: null,
	derivatives_aggregator_volume_7d_ago: null,
	derivatives_aggregator_volume_30d_ago: null,
	options_volume_7d_ago: null,
	options_volume_30d_ago: null,
	...overrides
})

const protocolRow = (protocolId: string, perpsVolume24h: number): ProtocolTableSourceRow => ({
	id: `protocol-${protocolId}`,
	rowType: 'protocol',
	name: protocolId,
	protocolId,
	displayName: protocolId,
	logo: '',
	category: 'Derivatives',
	chains: [],
	oracles: [],
	parentProtocolId: null,
	parentProtocolName: null,
	parentProtocolLogo: null,
	metrics: { perpsVolume24h },
	chain: null
})

describe('protocol point comparisons', () => {
	test('retains raw comparison values so grouped -100% changes remain exact', () => {
		const first = comparison({ entity_id: 'first', perps_volume_7d_ago: 100, perps_volume_30d_ago: 50 })
		const second = comparison({ entity_id: 'second', perps_volume_7d_ago: 100, perps_volume_30d_ago: 200 })
		const data: ProtocolPointComparisonData = {
			protocols: new Map([
				['first', first],
				['second', second]
			]),
			chains: new Map()
		}

		const rows = applyProtocolPointComparisons([protocolRow('first', 0), protocolRow('second', 100)], data, [
			'perps-volume'
		])

		expect(rows[0]?.metrics.perpsVolume24hChange7dAgo).toBe(-100)
		expect(rows[0]?.metrics.perpsVolume24h7dAgo).toBe(100)
		expect(aggregateMetrics(rows).perpsVolume24hChange7dAgo).toBe(-50)
		expect(aggregateMetrics(rows).perpsVolume24hChange30dAgo).toBe(-60)
	})

	test('applies canonical chain comparisons without constructing them from leaves', () => {
		const ethereum = comparison({
			entity_id: 'ethereum',
			chain_slug: 'ethereum',
			fees_7d_ago: 80,
			fees_30d_ago: 50
		})
		const chainMetrics = applyChainPointComparisons(
			{ ethereum: { availability: 'available', metrics: { ...EMPTY_CANONICAL_CHAIN_METRICS, fees24h: 100 } } },
			{ protocols: new Map(), chains: new Map([['ethereum', ethereum]]) },
			['fees']
		)

		expect(chainMetrics?.ethereum).toMatchObject({
			availability: 'available',
			metrics: {
				fees24h: 100,
				fees24h7dAgo: 80,
				fees24h30dAgo: 50,
				fees24hChange7dAgo: 25,
				fees24hChange30dAgo: 100
			}
		})
	})

	test('clears requested chain comparisons when the canonical comparison row is missing', () => {
		const chainMetrics = applyChainPointComparisons(
			{
				ethereum: {
					availability: 'available',
					metrics: {
						...EMPTY_CANONICAL_CHAIN_METRICS,
						fees24h: 100,
						fees24h7dAgo: 80,
						fees24h30dAgo: 50,
						fees24hChange7dAgo: 25,
						fees24hChange30dAgo: 100,
						revenue24h7dAgo: 40
					}
				}
			},
			{ protocols: new Map(), chains: new Map() },
			['fees']
		)

		expect(chainMetrics?.ethereum).toMatchObject({
			availability: 'available',
			metrics: {
				fees24h: 100,
				fees24h7dAgo: null,
				fees24h30dAgo: null,
				fees24hChange7dAgo: null,
				fees24hChange30dAgo: null,
				revenue24h7dAgo: 40
			}
		})
	})

	test('preserves measured zero comparison values without inventing a percentage', () => {
		const ethereum = comparison({
			entity_id: 'ethereum',
			chain_slug: 'ethereum',
			fees_7d_ago: 0,
			fees_30d_ago: 0
		})
		const chainMetrics = applyChainPointComparisons(
			{ ethereum: { availability: 'available', metrics: { ...EMPTY_CANONICAL_CHAIN_METRICS, fees24h: 0 } } },
			{ protocols: new Map(), chains: new Map([['ethereum', ethereum]]) },
			['fees']
		)

		expect(chainMetrics?.ethereum).toMatchObject({
			availability: 'available',
			metrics: {
				fees24h: 0,
				fees24h7dAgo: 0,
				fees24h30dAgo: 0,
				fees24hChange7dAgo: null,
				fees24hChange30dAgo: null
			}
		})
	})

	test('chain comparisons read the chain app fee column while protocol comparisons read protocol fees', () => {
		expect(pointColumns(['fees'], true)).toBe(
			'seven_days_ago.app_fees_1d AS fees_7d_ago,\n\t\t\tthirty_days_ago.app_fees_1d AS fees_30d_ago'
		)
		expect(pointColumns(['fees'], false)).toBe(
			'seven_days_ago.fees_1d AS fees_7d_ago,\n\t\t\tthirty_days_ago.fees_1d AS fees_30d_ago'
		)
	})
})
