import { skipToken, useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { formatPercent } from '~/utils/numberFormat'
import type {
	GovernanceActivityRow,
	GovernanceDataEntry,
	GovernanceMaxVotesRow,
	GovernanceProposal,
	GovernanceStats,
	GovernanceType
} from './types'

type RawProposal = {
	id: string
	title?: string
	state: string
	link?: string
	discussion?: string
	start: number
	end: number
	scores: number[]
	choices?: string[]
	scores_total: number
	score_curve?: number
	month: string
}

type RawGovernanceMonth = {
	total: number
	successful: number
	proposals?: string[]
}

type RawGovernanceResponse = {
	metadata: {
		name?: string
		followersCount?: number
	}
	stats?: {
		chainName?: string
		proposalsCount?: number
		successfulProposals?: number
		propsalsInLast30Days?: number
		successfulPropsalsInLast30Days?: number
		highestTotalScore?: number
		months?: Record<string, RawGovernanceMonth>
	} | null
	proposals: Record<string, RawProposal>
}

function normalizeGovernanceStats(stats: RawGovernanceResponse['stats']): GovernanceStats | null {
	if (!stats) return null

	const normalized: GovernanceStats = {}
	if (stats.chainName !== undefined) normalized.chainName = stats.chainName
	if (stats.proposalsCount !== undefined) normalized.proposalsCount = stats.proposalsCount
	if (stats.successfulProposals !== undefined) normalized.successfulProposals = stats.successfulProposals
	if (stats.propsalsInLast30Days !== undefined) {
		normalized.proposalsInLast30Days = stats.propsalsInLast30Days
	}
	if (stats.successfulPropsalsInLast30Days !== undefined) {
		normalized.successfulProposalsInLast30Days = stats.successfulPropsalsInLast30Days
	}
	if (stats.highestTotalScore !== undefined) normalized.highestTotalScore = stats.highestTotalScore
	return normalized
}

function normalizeMetadata(raw: RawGovernanceResponse['metadata']): GovernanceDataEntry['metadata'] {
	const normalized: GovernanceDataEntry['metadata'] = {}
	if (raw.name !== undefined) normalized.name = raw.name
	if (raw.followersCount !== undefined) normalized.followersCount = raw.followersCount
	return normalized
}

export async function fetchAndFormatGovernanceData(
	apis: Array<string> | null
): Promise<Array<{ type: GovernanceType; data: GovernanceDataEntry }>> {
	if (!apis) return []

	const requests = await Promise.allSettled(
		apis.map((gapi) =>
			fetchJson<RawGovernanceResponse>(gapi).then((raw) => {
				const { proposals, activity, maxVotes } = formatGovernanceData(raw)

				return {
					type: getGovernanceTypeFromApi(gapi),
					data: {
						metadata: normalizeMetadata(raw.metadata),
						stats: normalizeGovernanceStats(raw.stats),
						proposals,
						controversialProposals: [...proposals].sort((a, b) => b.score_curve - a.score_curve).slice(0, 10),
						activity,
						maxVotes
					}
				}
			})
		)
	)

	const sources: Array<{ type: GovernanceType; data: GovernanceDataEntry }> = []
	for (const request of requests) {
		if (request.status === 'fulfilled') sources.push(request.value)
	}
	if (sources.length === 0 && apis.length > 0) {
		const failedRequest = requests.find((request) => request.status === 'rejected')
		if (failedRequest?.status === 'rejected') throw failedRequest.reason
	}
	return sources
}

export function getGovernanceTypeFromApi(apiUrl: string): GovernanceType {
	return apiUrl.includes('governance-cache/snapshot')
		? 'snapshot'
		: apiUrl.includes('governance-cache/compound')
			? 'compound'
			: 'tally'
}

export const useFetchProtocolGovernanceData = (governanceApis: Array<string> | null) => {
	const isEnabled = governanceApis != null && governanceApis.length > 0
	return useQuery({
		queryKey: ['governance', 'protocol', JSON.stringify(governanceApis)],
		queryFn: isEnabled
			? () =>
					fetchJson<GovernanceDataEntry[]>('/api/public/protocols/charts', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							kind: 'governance',
							apis: governanceApis
						})
					})
			: skipToken,
		staleTime: 60 * 60 * 1000,
		retry: 0,
		enabled: isEnabled
	})
}

function processProposal(proposal: RawProposal): GovernanceProposal {
	const scores = proposal.scores
	const choices = proposal.choices ?? []
	const winningScore = scores.length > 0 ? Math.max(...scores) : undefined
	const winningIndex = winningScore != null ? scores.findIndex((score) => score === winningScore) : -1
	const totalVotes = proposal.scores_total

	return {
		...proposal,
		title: proposal.title ?? '',
		link: proposal.link ?? '',
		discussion: proposal.discussion ?? '',
		score_curve: proposal.score_curve ?? 0,
		scores,
		choices,
		totalVotes,
		winningChoice: winningIndex >= 0 ? (choices[winningIndex] ?? '') : '',
		winningPerc:
			totalVotes !== 0 && winningScore != null
				? `(${formatPercent(winningScore / totalVotes, { input: 'fraction' })} of votes)`
				: ''
	}
}

export function formatGovernanceData(data: RawGovernanceResponse): {
	proposals: GovernanceProposal[]
	activity: GovernanceActivityRow[]
	maxVotes: GovernanceMaxVotesRow[]
} {
	const proposals: GovernanceProposal[] = []
	const maxVotesByMonth = new Map<string, number>()
	for (const proposalId in data.proposals) {
		const proposal = data.proposals[proposalId]
		if (proposal === undefined) continue
		proposals.push(processProposal(proposal))
		const currentMax = maxVotesByMonth.get(proposal.month) ?? 0
		if (proposal.scores_total > currentMax) maxVotesByMonth.set(proposal.month, proposal.scores_total)
	}

	const activity: GovernanceActivityRow[] = []
	const maxVotes: GovernanceMaxVotesRow[] = []
	const statsMonths = data.stats?.months
	if (statsMonths) {
		const chronologicalMonths: Array<[number, string, RawGovernanceMonth]> = []
		for (const date in statsMonths) {
			const values = statsMonths[date]
			if (values !== undefined) {
				chronologicalMonths.push([Math.floor(new Date(date).getTime() / 1000), date, values])
			}
		}
		chronologicalMonths.sort((a, b) => a[0] - b[0])
		for (const [timestamp, month, values] of chronologicalMonths) {
			activity.push({
				date: timestamp,
				Total: values.total,
				Successful: values.successful
			})

			maxVotes.push({
				date: timestamp,
				'Max Votes': maxVotesByMonth.get(month) ?? 0
			})
		}
	}

	return { maxVotes, activity, proposals }
}
