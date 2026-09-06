import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { buildColumnarTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { formatPercent } from '~/utils/numberFormat'
import { readInvestorApiJson, type ApiDate } from '../../api.types'
import { assignColors } from '../spark/api'
import { multiSeriesCharts } from './chartDefaults'
import { formatSonicAmount } from './format'

interface FormattedValue {
	value: number
	formatted: string
}

export interface YieldPool {
	project: string
	symbol: string
	pool: string
	tvlUsd: number
	tvlFormatted: string
	apy: number
	apyFormatted: string
	apyBase: number | null
	apyReward: number | null
}

interface BurnData {
	price: number
	gasPrice: number
	totalSupply: number
	initialSupply: number
	netIssuance: number
	feesPerDay: number
	permanentBurnPerDay: number
	permanentBurnPerYear: number
	feeMPerDay: number
	validatorFeesPerDay: number
	burnRatePercent: number
	feeDistribution: {
		feeMPercent: number
		burntPercent: number
		validatorPercent: number
	}
	currentEpoch: number
	lastEpochFee: number
	lastEpochEndTime: number
	avgEpochDuration: number
}

interface YieldsEmissionsAPIResponse {
	yields: {
		pools: Array<YieldPool>
		kpis: {
			totalPools: FormattedValue
			totalTvl: FormattedValue
			avgApy: FormattedValue
		}
	}
	emissions: {
		emissionsChart: {
			title: string
			dates: Array<ApiDate>
			categories: Array<string>
			series: Array<{ name: string; data: Array<number> }>
		}
		metadata: {
			total: number | null
			token: string | null
			name: string
		}
	}
	burn: BurnData | null
}

function parseDateToMs(dateStr: string): number {
	return Date.parse(`${dateStr}T00:00:00Z`)
}

export function useYieldsEmissionsData() {
	const query = useQuery<YieldsEmissionsAPIResponse>({
		queryKey: ['sonic-yields-emissions'],
		queryFn: async () => {
			const res = await fetch('/api/public/sonic/yields-emissions')
			if (!res.ok) throw new Error(`Yields-Emissions API error: ${res.status}`)
			return readInvestorApiJson<YieldsEmissionsAPIResponse>(res)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		if (!query.data) {
			return { data: null, isLoading: query.isLoading || query.isPending }
		}

		const d = query.data

		// Emissions chart
		const emissionsDataset = buildColumnarTimeSeriesDataset(
			d.emissions.emissionsChart.dates,
			d.emissions.emissionsChart.series,
			parseDateToMs,
			0
		)
		const emissionsColors = assignColors(d.emissions.emissionsChart.series.map((s) => s.name))
		const emissionsCharts = multiSeriesCharts(d.emissions.emissionsChart.series, 'line', 'Total', emissionsColors)

		// Burn data
		const burn = d.burn
			? {
					permanentBurnPerDay: {
						value: d.burn.permanentBurnPerDay,
						formatted: `${formatSonicAmount(d.burn.permanentBurnPerDay)} S`
					},
					permanentBurnPerYear: {
						value: d.burn.permanentBurnPerYear,
						formatted: `${formatSonicAmount(d.burn.permanentBurnPerYear)} S`
					},
					burnRate: {
						value: d.burn.burnRatePercent,
						formatted: `${formatPercent(d.burn.burnRatePercent, { input: 'fraction', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
					},
					feesPerDay: {
						value: d.burn.feesPerDay,
						formatted: `${formatSonicAmount(d.burn.feesPerDay)} S`
					}
				}
			: null

		return {
			data: {
				emissions: {
					dataset: emissionsDataset,
					charts: emissionsCharts,
					title: d.emissions.emissionsChart.title,
					metadata: d.emissions.metadata
				},
				yields: {
					pools: d.yields.pools,
					kpis: d.yields.kpis
				},
				burn
			},
			isLoading: false
		}
	}, [query.data, query.isLoading, query.isPending])
}
