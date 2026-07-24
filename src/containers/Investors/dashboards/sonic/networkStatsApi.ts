import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { formatNumber, formatUsd, formatPercent } from '~/utils/numberFormat'
import { readInvestorApiJson, type ApiNumericString } from '../../api.types'
import { formatSonicAmount } from './format'

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

interface NetworkStatsAPIResponse {
	blockNumber: number | null
	gasPrice: { gwei: number; wei: number } | null
	totalSupplyWei: ApiNumericString | null
	burnData: BurnData | null
	uptimeUrl: string
}

export function useNetworkStatsData() {
	const query = useQuery<NetworkStatsAPIResponse>({
		queryKey: ['sonic-network-stats'],
		queryFn: async () => {
			const res = await fetch('/api/public/sonic/network-stats')
			if (!res.ok) throw new Error(`Network stats API error: ${res.status}`)
			return readInvestorApiJson<NetworkStatsAPIResponse>(res)
		},
		staleTime: 2 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		if (!query.data) {
			return { data: null, isLoading: query.isLoading || query.isPending }
		}

		const d = query.data
		const burn = d.burnData

		return {
			data: {
				network: {
					blockNumber: d.blockNumber != null ? { value: d.blockNumber, formatted: formatNumber(d.blockNumber) } : null,
					gasPrice:
						d.gasPrice != null
							? {
									value: d.gasPrice.gwei,
									formatted: `${formatNumber(d.gasPrice.gwei, { maximumFractionDigits: 0 })} Gwei`
								}
							: null,
					price:
						burn != null
							? {
									value: burn.price,
									formatted: formatUsd(burn.price, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
								}
							: null,
					totalSupply: burn != null ? { value: burn.totalSupply, formatted: formatSonicAmount(burn.totalSupply) } : null
				},
				tokenomics:
					burn != null
						? {
								initialSupply: { value: burn.initialSupply, formatted: formatSonicAmount(burn.initialSupply) },
								netIssuance: { value: burn.netIssuance, formatted: formatSonicAmount(burn.netIssuance) },
								burnPerDay: {
									value: burn.permanentBurnPerDay,
									formatted: `${formatSonicAmount(burn.permanentBurnPerDay)} S`
								},
								burnPerYear: {
									value: burn.permanentBurnPerYear,
									formatted: `${formatSonicAmount(burn.permanentBurnPerYear)} S`
								}
							}
						: null,
				fees:
					burn != null
						? {
								feesPerDay: { value: burn.feesPerDay, formatted: `${formatSonicAmount(burn.feesPerDay)} S` },
								feeMPerDay: { value: burn.feeMPerDay, formatted: `${formatSonicAmount(burn.feeMPerDay)} S` },
								validatorFeesPerDay: {
									value: burn.validatorFeesPerDay,
									formatted: `${formatSonicAmount(burn.validatorFeesPerDay)} S`
								},
								burnRate: {
									value: burn.burnRatePercent,
									formatted: `${formatPercent(burn.burnRatePercent, { input: 'fraction', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
								}
							}
						: null,
				epoch:
					burn != null
						? {
								current: { value: burn.currentEpoch, formatted: formatNumber(burn.currentEpoch) },
								avgDuration: {
									value: burn.avgEpochDuration,
									formatted: `~${Math.round(burn.avgEpochDuration / 60)} min`
								},
								lastFee: {
									value: burn.lastEpochFee,
									formatted: `${formatNumber(burn.lastEpochFee, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} S`
								}
							}
						: null,
				uptimeUrl: d.uptimeUrl
			},
			isLoading: false
		}
	}, [query.data, query.isLoading, query.isPending])
}
