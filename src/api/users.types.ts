export type InterestCategory =
	| 'protocols'
	| 'chains'
	| 'yields'
	| 'fees'
	| 'volumes'
	| 'stablecoins'
	| 'bridges'
	| 'raises'
	| 'hacks'
	| 'oracles'
	| 'cexs'
	| 'etfs'
	| 'research'
	| 'llamaai'
	| 'rwa'
	| 'unlocks'
	| 'treasuries'
	| 'liquidations'
	| 'tokens'
	| 'dashboards'
	| 'sheets'
	| 'mcp'
	| 'downloads'

export interface InterestScore {
	category: InterestCategory
	/** Affinity score from 0 to 1, not a probability. */
	score: number
}

export interface UserInterestsResponse {
	/** Up to five interests, ordered by descending score, then category. Empty means no qualifying profile. */
	interests: Array<InterestScore>
}
