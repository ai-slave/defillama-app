import { describe, expect, test } from 'vitest'
import { buildEventRailData } from '~/components/ECharts/MultiSeriesChart/eventRail'
import type { Hack } from '~/containers/Hacks/model'
import { buildProtocolOverviewHallmarks } from '../hallmarks'

const hack = (overrides: Partial<Hack>): Hack => ({
	date: 1_700_000_000,
	name: 'Protocol',
	classification: 'Access Control',
	technique: 'Improper Access Control',
	amountUsd: 12_500_000,
	chain: ['Ethereum'],
	bridgeHack: false,
	targetType: 'DeFi Protocol',
	returnedFundsUsd: null,
	defillamaId: '1',
	language: 'Solidity',
	source: 'https://example.com',
	...overrides
})

describe('protocol overview hack hallmarks', () => {
	test('name the hack, its cause and the loss', () => {
		const { hallmarks } = buildProtocolOverviewHallmarks({
			hacks: [
				hack({}),
				hack({ classification: 'Rugpull', amountUsd: 2_000_000 }),
				hack({ classification: null, technique: 'Phishing', amountUsd: null })
			]
		})

		expect(hallmarks.map(([, label]) => label)).toEqual([
			'Hack · Access Control · $12.5m lost',
			'Rug pull · $2m lost',
			'Hack · Phishing'
		])
	})

	test('draw on the event rail as danger markers, unlike protocol milestones', () => {
		const { hallmarks } = buildProtocolOverviewHallmarks({
			hacks: [hack({ classification: 'Oracle Manipulation' }), hack({ classification: 'Rugpull' })],
			protocolHallmarks: [[1_600_000_000, 'V3 Launch']]
		})
		const { events } = buildEventRailData({ hallmarks, isThemeDark: false })

		expect(events.map((event) => [event.fullText, event.isDanger])).toEqual([
			['V3 Launch', false],
			['Hack · Oracle Manipulation · $12.5m lost', true],
			['Rug pull · $12.5m lost', true]
		])
	})
})
