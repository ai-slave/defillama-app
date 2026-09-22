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
 * Account-level segment name, such as an employer type derived from a work email. Reserved for
 * company-based targeting: no classifier populates it yet, so the API always returns an empty list.
 * Narrow this to a union once the first segment exists.
 */
export type UserSegment = string

export interface UserInterestsResponse {
	/** Every qualifying interest, ordered by descending score, then category. Empty means no qualifying profile. */
	interests: Array<InterestScore>
	/** Ranked above browsing interests when choosing a banner. Empty until a classifier exists. */
	segments: Array<UserSegment>
}
