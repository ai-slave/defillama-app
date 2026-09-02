import { describe, expect, it } from 'vitest'
import { findUtrSearchMatch } from '../navigation'
import type { UtrLeaderboardRow } from '../types'

const row = {
	asset: 'ethereum',
	name: 'Ethereum',
	symbol: 'ETH',
	sector: null,
	listingStatus: 'listed',
	disclosureLevel: 'full',
	claimed: false,
	fdvUsd: null,
	scores: {
		overall: null,
		overallMomChangePct: null,
		disclosure: null,
		performance: null,
		rank: 1,
		disclosureRubrics: [],
		performanceRubrics: []
	}
} satisfies UtrLeaderboardRow

describe('findUtrSearchMatch', () => {
	it('matches token names, tickers, assets, and datalist labels', () => {
		expect(findUtrSearchMatch([row], 'ethereum')?.asset).toBe('ethereum')
		expect(findUtrSearchMatch([row], 'ETH')?.asset).toBe('ethereum')
		expect(findUtrSearchMatch([row], 'Ethereum (ETH)')?.asset).toBe('ethereum')
		expect(findUtrSearchMatch([row], 'missing')).toBeNull()
	})
})
