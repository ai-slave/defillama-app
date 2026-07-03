export type Metric = { value: number | null; percentile: number | null; rank: number | null }
export type RankOnly = { value: number | null; percentile: number | null }

export type LeaderboardRow = {
	marketMakerId: string
	marketMakerName: string
	marketMakerImageUrl: string | null
	rank: RankOnly | null
	metrics: Record<string, Metric | null>
}
