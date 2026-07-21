import { useQuery } from '@tanstack/react-query'
import {
	buildColumnarTimeSeriesDataset,
	type TimestampDataset
} from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { readInvestorApiJson, type ApiDate, type ApiIsoTimestamp } from '../../api.types'

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
	dates: ApiDate[]
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
		updatedAt: ApiIsoTimestamp
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
	const activityDates = blockchain.chainActivity.dates
	const transactions = blockchain.chainActivity.series[0].data
	const activeAddresses = blockchain.chainActivity.series[1].data
	const newAddresses = blockchain.chainActivity.series[2].data
	const transactionRows = new Array<(number | null)[]>(activityDates.length)
	const addressRows = new Array<(number | null)[]>(activityDates.length)
	for (let i = 0; i < activityDates.length; i++) {
		const timestamp = parseDateToTimestampMs(activityDates[i])
		transactionRows[i] = [timestamp, transactions[i] ?? 0]
		addressRows[i] = [timestamp, activeAddresses[i] ?? 0, newAddresses[i] ?? 0]
	}

	return {
		metadata,
		activityKpis: blockchain.activityKpis,
		gasKpis: blockchain.gasKpis,
		topTokens: blockchain.topTokens,
		chartDatasets: {
			transactions: {
				source: transactionRows,
				dimensions: ['timestamp', 'Transactions']
			},
			addresses: {
				source: addressRows,
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
			const response = await readInvestorApiJson<BlockchainAPIResponse>(res)
			return buildBlockchainViewModel(response)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	if (!query.data) return { data: null, isLoading: query.isLoading || query.isPending }
	return { data: query.data, isLoading: false }
}
