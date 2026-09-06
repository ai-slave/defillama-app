import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import type { BridgeOverviewVolumeChartTuple } from './types'

export const useGetBridgeChartDataByChain = (chain?: string) => {
	return useQuery({
		queryKey: ['bridges', 'chart-by-chain', chain],
		queryFn:
			chain && chain !== 'All'
				? () =>
						fetchJson<Array<BridgeOverviewVolumeChartTuple> | null>(
							`/api/public/chains/charts?kind=net-inflows&chain=${encodeURIComponent(chain)}`
						).catch((error) => {
							console.log(error)
							return null
						})
				: () => null,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!chain
	})
}
