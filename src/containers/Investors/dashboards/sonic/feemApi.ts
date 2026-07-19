import { useQuery } from '@tanstack/react-query'
import type { IMultiSeriesChartProps } from '~/components/ECharts/types'
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
	dates: ApiDate[]
	series: Array<{ name: string; data: number[] }>
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
		leaderboard: FeeMLeaderboardEntry[]
		dailyStats: TimeSeriesData
	}
}

function parseDateToUnix(dateStr: string): number {
	return Math.floor(Date.parse(dateStr + 'T00:00:00Z') / 1000)
}

type DailyStatsSeries = NonNullable<IMultiSeriesChartProps['series']>

export function buildFeeMViewModel({ feem }: FeeMAPIResponse) {
	const timestamps = new Array<number>(feem.dailyStats.dates.length)
	for (let i = 0; i < feem.dailyStats.dates.length; i++) {
		timestamps[i] = parseDateToUnix(feem.dailyStats.dates[i])
	}

	const dailyStatsSeries = new Array<DailyStatsSeries[number]>(feem.dailyStats.series.length)
	for (let i = 0; i < feem.dailyStats.series.length; i++) {
		const input = feem.dailyStats.series[i]
		const data = new Array<[number, number]>(timestamps.length)
		for (let j = 0; j < timestamps.length; j++) {
			data[j] = [timestamps[j], input.data[j]]
		}
		dailyStatsSeries[i] = {
			name: input.name,
			type: i === 0 ? 'bar' : 'line',
			color: i === 0 ? '#4691ce' : '#4cae4f',
			data,
			yAxisIndex: i === 0 ? 0 : 1,
			areaStyle: i === 1 ? { opacity: 0 } : undefined
		}
	}

	return {
		globalKpis: feem.globalKpis,
		leaderboard: feem.leaderboard,
		dailyStatsSeries,
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
