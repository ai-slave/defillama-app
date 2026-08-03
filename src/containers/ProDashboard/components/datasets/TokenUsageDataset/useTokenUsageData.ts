import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import { StreamDoneContext } from '~/containers/ProDashboard/queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '~/containers/ProDashboard/queryPolicy'
import { getProTokenUsageQueryKey, normalizeProTokenSymbols } from '~/containers/ProDashboard/tableQueryKeys'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { fetchJson } from '~/utils/async'

export function useTokenUsageData(tokenSymbols: string[], includeCex: boolean) {
	const streamDone = useContext(StreamDoneContext)
	const normalizedTokenSymbols = useMemo(() => normalizeProTokenSymbols(tokenSymbols), [tokenSymbols])
	const query = useQuery<ProtocolTokenUsageData[]>({
		queryKey: getProTokenUsageQueryKey(normalizedTokenSymbols, includeCex),
		queryFn: () => {
			const query = new URLSearchParams({ includeCex: String(includeCex) })
			for (const symbol of normalizedTokenSymbols) query.append('symbols[]', symbol)
			return fetchJson<ProtocolTokenUsageData[]>(`/api/dynamic/pro-dashboard/token-usage?${query}`)
		},
		enabled: streamDone && normalizedTokenSymbols.length > 0,
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		retry: 1
	})
	return {
		...query,
		isLoading: normalizedTokenSymbols.length > 0 && (query.isLoading || (!streamDone && query.data === undefined))
	}
}
