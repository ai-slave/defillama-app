import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { createDashboardStreamLineParser } from '~/containers/ProDashboard/dashboardStreamLines'
import { parseDashboardQueryKey } from '../dashboardQueryKey'
import type { DashboardStreamChunk } from '../dashboardStreamContract'
import type { Dashboard } from '../dashboardTypes'
import { getProRwaBreakdownQueryKey } from '../rwaBreakdown'
import {
	getProEquitiesFilingsCacheKey,
	getProEquitiesStatementsCacheKey,
	PRO_EQUITIES_COMPANIES_QUERY_KEY,
	PRO_RWA_ASSETS_TABLE_QUERY_KEY,
	PRO_RWA_CHAINS_TABLE_QUERY_KEY
} from '../tableQueryKeys'

export interface DashboardStreamState {
	isStreaming: boolean
	/** undefined = not received yet, null = received as null, Dashboard = received */
	dashboard: Dashboard | null | undefined
	isDone: boolean
	error: string | null
}

function seedSerializedQueryData<T>(
	queryClient: ReturnType<typeof useQueryClient>,
	serializedKey: string,
	data: T,
	now: number
) {
	const queryKey = parseDashboardQueryKey(serializedKey)
	if (queryKey) queryClient.setQueryData(queryKey, data, { updatedAt: now })
}

export function useDashboardStream(
	dashboardId: string | undefined,
	authToken?: string | null,
	enabled = true
): DashboardStreamState {
	const queryClient = useQueryClient()
	const [state, setState] = useState<DashboardStreamState>({
		isStreaming: false,
		dashboard: undefined,
		isDone: !dashboardId || dashboardId === 'new',
		error: null
	})
	const handleLine = useCallback(
		(line: string) => {
			if (!line.trim()) return

			let chunk: DashboardStreamChunk
			try {
				chunk = JSON.parse(line)
			} catch {
				return
			}

			const now = Date.now()
			switch (chunk.type) {
				case 'dashboard':
					// Dashboard is seeded into cache by the provider (needs auth-aware key)
					setState((previousState) => ({
						...previousState,
						dashboard: chunk.data
					}))
					break
				case 'protocolsAndChains':
					if (chunk.data) {
						queryClient.setQueryData(['pro-dashboard', 'protocols-and-chains'], chunk.data, { updatedAt: now })
					}
					break
				case 'appMetadata':
					if (chunk.data) queryClient.setQueryData(['pro-dashboard', 'app-metadata'], chunk.data, { updatedAt: now })
					break
				case 'chartData':
				case 'protocolTvlChartData':
					queryClient.setQueryData(chunk.queryKey, chunk.data, {
						updatedAt: now
					})
					break
				case 'tokenUsageData':
				case 'emissionData':
				case 'incomeStatementData':
				case 'chartBuilderData':
				case 'cexAnalyticsData':
				case 'chainsDatasetData':
				case 'yieldsDatasetData':
				case 'stablecoinsTableData':
				case 'stablecoinAssetData':
					seedSerializedQueryData(queryClient, chunk.key, chunk.data, now)
					break
				case 'unifiedTableData':
					seedSerializedQueryData(queryClient, chunk.key, chunk.data, now)
					break
				case 'yieldsChartData':
					if ('supply' in chunk.data) {
						queryClient.setQueryData(['yield-supply-history', chunk.id], chunk.data.supply ?? null, {
							updatedAt: now
						})
					}
					if ('borrow' in chunk.data) {
						queryClient.setQueryData(['yield-borrow-history', chunk.id], chunk.data.borrow ?? null, {
							updatedAt: now
						})
					}
					break
				case 'stablecoinsChartData':
					queryClient.setQueryData(['pro-dashboard', 'stablecoins-chart-data', chunk.chain], chunk.data, {
						updatedAt: now
					})
					break
				case 'rwaBreakdownData':
					queryClient.setQueryData(getProRwaBreakdownQueryKey(chunk.breakdown, chunk.metric, chunk.chain), chunk.data, {
						updatedAt: now
					})
					break
				case 'rwaAssetChartData':
					queryClient.setQueryData(['pro-dashboard', 'rwa-asset-chart', chunk.id], chunk.data, { updatedAt: now })
					break
				case 'rwaAssetsTableData':
					queryClient.setQueryData(PRO_RWA_ASSETS_TABLE_QUERY_KEY, chunk.data, {
						updatedAt: now
					})
					break
				case 'rwaChainsTableData':
					queryClient.setQueryData(PRO_RWA_CHAINS_TABLE_QUERY_KEY, chunk.data, {
						updatedAt: now
					})
					break
				case 'equitiesCompaniesData':
					queryClient.setQueryData(PRO_EQUITIES_COMPANIES_QUERY_KEY, chunk.data, { updatedAt: now })
					break
				case 'equitiesStatementsData':
					queryClient.setQueryData(getProEquitiesStatementsCacheKey(chunk.ticker), chunk.data, { updatedAt: now })
					break
				case 'equitiesFilingsData':
					queryClient.setQueryData(getProEquitiesFilingsCacheKey(chunk.ticker), chunk.data, { updatedAt: now })
					break
				case 'done':
					setState((previousState) => ({
						...previousState,
						isStreaming: false,
						isDone: true
					}))
					break
			}
		},
		[queryClient]
	)

	useEffect(() => {
		if (!dashboardId || dashboardId === 'new' || !enabled) return

		const abortController = new AbortController()

		setState({
			isStreaming: true,
			dashboard: undefined,
			isDone: false,
			error: null
		})

		const startStream = async () => {
			try {
				const tokenAtFetch = authToken
				const streamUrl = tokenAtFetch
					? `/api/dynamic/pro-dashboard/${dashboardId}/stream?_=${Date.now()}`
					: `/api/dynamic/pro-dashboard/${dashboardId}/stream`
				const response = await fetch(streamUrl, {
					credentials: 'include',
					...(tokenAtFetch ? { headers: { Authorization: `Bearer ${tokenAtFetch}` } } : {}),
					signal: abortController.signal
				})
				if (abortController.signal.aborted) return

				if (!response.ok || !response.body) {
					setState((s) => ({
						...s,
						isStreaming: false,
						isDone: true,
						error: `Stream failed: ${response.status}`
					}))
					return
				}

				const reader = response.body.getReader()
				const decoder = new TextDecoder()
				const lineParser = createDashboardStreamLineParser((line) => {
					if (!abortController.signal.aborted) handleLine(line)
				})

				try {
					while (true) {
						if (abortController.signal.aborted) break

						const { done, value } = await reader.read()

						if (done) {
							lineParser.push(decoder.decode())
							lineParser.finish()
							break
						}

						lineParser.push(decoder.decode(value, { stream: true }))
					}
				} finally {
					try {
						reader.releaseLock()
					} catch {}
				}

				if (!abortController.signal.aborted) {
					setState((s) => (s.isDone ? s : { ...s, isStreaming: false, isDone: true }))
				}
			} catch (error) {
				if (abortController.signal.aborted) return
				setState((s) => ({
					...s,
					isStreaming: false,
					isDone: true,
					error: error instanceof Error ? error.message : 'Stream failed'
				}))
			}
		}

		startStream()

		return () => {
			abortController.abort()
		}
	}, [authToken, dashboardId, enabled, handleLine])

	return state
}
