import { useQuery } from '@tanstack/react-query'
import { buildAlignedCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { readInvestorApiJson, type ApiDate, type ApiIsoTimestamp } from '../../api.types'

interface FormattedValue {
	value: number
	formatted: string
}

interface FeeMGlobalKpis {
	totalContracts: FormattedValue
	totalTransactions: FormattedValue
	totalCollected: FormattedValue
	totalClaimed: FormattedValue
	gasMonetizationAddress: string
}

export interface FeeMLeaderboardEntry {
	id: number
	name: string
	imageUrl: string | null
	websiteUrl: string | null
	isActive: boolean
	transactionsCount: number
	transactionsFormatted: string
	contractsCount: number
	collectedRewards: number
	collectedRewardsFormatted: string
	claimedRewards: number
	rewardsToClaim: number
}

interface TimeSeriesData {
	title: string
	dates: Array<ApiDate>
	series: Array<{ name: string; data: Array<number> }>
}

export interface FeeMAPIResponse {
	metadata: {
		projectId: number
		projectName: string
		updatedAt: ApiIsoTimestamp
		links: Record<string, string>
	}
	feem: {
		globalKpis: FeeMGlobalKpis
		leaderboard: Array<FeeMLeaderboardEntry>
		dailyStats: TimeSeriesData
	}
}

function parseDateToUnix(dateStr: string): number {
	return Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 1000)
}

export function buildFeeMViewModel({ feem }: FeeMAPIResponse) {
	const timestamps = new Array<number>(feem.dailyStats.dates.length)
	for (let i = 0; i < feem.dailyStats.dates.length; i++) {
		timestamps[i] = parseDateToUnix(feem.dailyStats.dates[i])
	}

	const dailyStatsModel = buildAlignedCartesianChartModel(
		timestamps,
		feem.dailyStats.series.map((input, index) => ({
			name: input.name,
			type: index === 0 ? ('bar' as const) : ('line' as const),
			color: index === 0 ? '#4691ce' : '#4cae4f',
			values: input.data,
			yAxisIndex: index === 0 ? 0 : 1,
			valueSymbol: index === 0 ? '' : 'S',
			areaStyle: index === 1 ? { opacity: 0 } : undefined
		})),
		{ timestampMultiplier: 1000 }
	)

	return {
		globalKpis: feem.globalKpis,
		leaderboard: feem.leaderboard,
		dailyStatsModel,
		dailyStatsLength: timestamps.length,
		dailyStatsTitle: feem.dailyStats.title
	}
}

export type FeeMViewModel = ReturnType<typeof buildFeeMViewModel>

export function useFeeMData() {
	const query = useQuery<FeeMViewModel>({
		queryKey: ['sonic-feem'],
		queryFn: async () => {
			const res = await fetch('/api/public/sonic/feem')
			if (!res.ok) throw new Error(`FeeM API error: ${res.status}`)
			const response = await readInvestorApiJson<FeeMAPIResponse>(res)
			return buildFeeMViewModel(response)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	if (!query.data) return { data: null, isLoading: query.isLoading || query.isPending }
	return { data: query.data, isLoading: false }
}
