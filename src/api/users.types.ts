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

/**
 * Account-level segment: the organization type the analytics service derives from an email domain.
 * The service withholds its retail classification, which covers every personal email provider, so
 * most readers have no segment.
 */
export type UserSegment = 'fund_institutional' | 'exchange' | 'ai_llm' | 'crypto_project' | 'university'

export interface UserInterestsResponse {
	/** Every qualifying interest, ordered by descending score, then category. Empty means no qualifying profile. */
	interests: Array<InterestScore>
	/** Ranked above browsing interests when choosing a banner. At most one today. */
	segments: Array<UserSegment>
}
