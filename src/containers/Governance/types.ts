export type GovernanceType = 'snapshot' | 'compound' | 'tally'

export interface GovernanceProposal {
	id: string
	title: string
	state: string
	link: string
	discussion: string
	start: number
	end: number
	scores: number[]
	choices: string[]
	scores_total: number
	score_curve: number
	totalVotes: number
	winningChoice: string
	winningPerc: string
}

export interface GovernanceActivityRow {
	date: number
	Total: number
	Successful: number
}

export interface GovernanceMaxVotesRow {
	date: number
	'Max Votes': number
}

export interface GovernanceStats {
	chainName?: string
	proposalsCount?: number
	successfulProposals?: number
	proposalsInLast30Days?: number
	successfulProposalsInLast30Days?: number
	highestTotalScore?: number
}

interface GovernanceMetadata {
	name?: string
	followersCount?: number
}

export interface GovernanceDataEntry {
	metadata: GovernanceMetadata
	stats: GovernanceStats | null
	proposals: GovernanceProposal[]
	controversialProposals: GovernanceProposal[]
	activity: GovernanceActivityRow[]
	maxVotes: GovernanceMaxVotesRow[]
}

export interface GovernanceOverviewItem {
	name: string
	proposalsCount: number
	followersCount: number
	strategyCount: number
	successfulProposals?: number
	states: Record<string, number>
	months: Record<string, { proposals: string[]; states: { active?: number; closed?: number } }>
	proposalsInLast30Days: number
	successfulProposalsInLast30Days: number
	subRowData: Record<string, number>
}
