import { expect, test } from 'vitest'
import { buildNetflowBars } from './data'

test('splits each chain net flow into an inflow bar and an outflow bar', () => {
	expect(
		buildNetflowBars([
			{ chain: 'ethereum', value: 30 },
			{ chain: 'arbitrum', value: -12 },
			{ chain: 'base', value: 0 }
		])
	).toEqual({
		chains: ['Ethereum', 'Arbitrum', 'Base'],
		positiveData: [30, 0, 0],
		negativeData: [0, -12, 0],
		csvSource: [
			{ Chain: 'Ethereum', Inflow: 30, Outflow: 0, 'Net Flow': 30 },
			{ Chain: 'Arbitrum', Inflow: 0, Outflow: 12, 'Net Flow': -12 },
			{ Chain: 'Base', Inflow: 0, Outflow: 0, 'Net Flow': 0 }
		]
	})
})
