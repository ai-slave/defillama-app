import { useQuery } from '@tanstack/react-query'
import { buildColumnarTimeSeriesDataset, type TimestampDataset } from '~/components/ECharts/timeSeriesDataset'

interface FormattedValue {
	value: number
	formatted: string
}

interface ChartSeries {
	name: string
	data: number[]
}

interface ChartData {
	title: string
	dates: string[]
	series: ChartSeries[]
}

interface TopToken {
	symbol: string
	contractAddress: string
	transferCount: number
	volumeUsd: number
	volumeFormatted: string
	uniqueSenders: number
}

interface BlockchainAPIResponse {
	metadata: {
		projectName: string
		updatedAt: string
		links?: Record<string, string>
	}
	blockchain: {
		chainActivity: ChartData
		activityKpis: {
			latestTxCount: FormattedValue
			latestActiveAddresses: FormattedValue
			avgDailyTxs7d: FormattedValue
			avgDailyTxs30d: FormattedValue
			totalTxsAllTime: FormattedValue
		}
		gasFees: ChartData
		gasKpis: {
			totalFees7d: FormattedValue
			totalFees30d: FormattedValue
			totalFeesAllTime: FormattedValue
			avgFeePerTx: FormattedValue
		}
		blockUtilization: ChartData
		contractDeployments: ChartData
		tokenTransfers: ChartData
		topTokens: TopToken[]
	}
}

type BlockchainViewModel = Pick<BlockchainAPIResponse['blockchain'], 'activityKpis' | 'gasKpis' | 'topTokens'> & {
	metadata: BlockchainAPIResponse['metadata']
	chartDatasets: {
		transactions: TimestampDataset
		addresses: TimestampDataset
		gasFees: TimestampDataset
		blockUtilization: TimestampDataset
		contractDeployments: TimestampDataset
		tokenTransfers: TimestampDataset
	}
}

export type { FormattedValue, TopToken, BlockchainAPIResponse, BlockchainViewModel }

function parseDateToTimestampMs(date: string) {
	return Date.parse(`${date}T00:00:00Z`)
}

export function buildBlockchainViewModel({ metadata, blockchain }: BlockchainAPIResponse): BlockchainViewModel {
	const activityDataset = buildColumnarTimeSeriesDataset(
		blockchain.chainActivity.dates,
		[blockchain.chainActivity.series[0], blockchain.chainActivity.series[1], blockchain.chainActivity.series[2]],
		parseDateToTimestampMs,
		0
	)

	return {
		metadata,
		activityKpis: blockchain.activityKpis,
		gasKpis: blockchain.gasKpis,
		topTokens: blockchain.topTokens,
		chartDatasets: {
			transactions: {
				...activityDataset,
				dimensions: ['timestamp', 'Transactions']
			},
			addresses: {
				...activityDataset,
				dimensions: ['timestamp', 'Active Addresses', 'New Addresses']
			},
			gasFees: buildColumnarTimeSeriesDataset(
				blockchain.gasFees.dates,
				[blockchain.gasFees.series[0]],
				parseDateToTimestampMs,
				0
			),
			blockUtilization: buildColumnarTimeSeriesDataset(
				blockchain.blockUtilization.dates,
				[blockchain.blockUtilization.series[0]],
				parseDateToTimestampMs,
				0
			),
			contractDeployments: buildColumnarTimeSeriesDataset(
				blockchain.contractDeployments.dates,
				[blockchain.contractDeployments.series[0]],
				parseDateToTimestampMs,
				0
			),
			tokenTransfers: buildColumnarTimeSeriesDataset(
				blockchain.tokenTransfers.dates,
				[blockchain.tokenTransfers.series[1]],
				parseDateToTimestampMs,
				0
			)
		}
	}
}

export function useBlockchainData() {
	const query = useQuery<BlockchainViewModel>({
		queryKey: ['berachain-blockchain'],
		queryFn: async () => {
			const res = await fetch('/api/public/berachain/blockchain')
			if (!res.ok) throw new Error(`Berachain Blockchain API error: ${res.status}`)
			const response: BlockchainAPIResponse = await res.json()
			return buildBlockchainViewModel(response)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	if (!query.data) return { data: null, isLoading: query.isLoading || query.isPending }
	return { data: query.data, isLoading: false }
}
