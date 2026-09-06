import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { buildChartRepairHref, storeChartRepairTarget } from '~/containers/LlamaAI/chartRepairTarget'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { ChartRenderer } from '~/containers/LlamaAI/components/charts/ChartRenderer'
import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'
import { formatDate } from '~/utils/dateFormat'
import { useProDashboardDashboard, useProDashboardPermissions, useProDashboardTime } from '../ProDashboardAPIContext'
import type { LlamaAIChartConfig } from '../types'
import { filterLlamaAIChartPayload } from '../utils/llamaAIChartTimeFilter'
import {
	getLlamaAIChartOwnerNotice,
	getLlamaAIChartRefreshConfirmation,
	getLlamaAIChartRefreshRequest,
	getLlamaAIChartSource,
	isLlamaAIChartRepairNeeded
} from './llamaAIChartSource'
import { LoadingSpinner } from './LoadingSpinner'

interface LlamaAIChartCardProps {
	config: LlamaAIChartConfig
}

export default function LlamaAIChartCard({ config }: LlamaAIChartCardProps) {
	const { authorizedFetch, user, loaders } = useAuthContext()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { dashboardId } = useProDashboardDashboard()
	const { dashboardOwnerId } = useProDashboardPermissions()

	const hasInlineData = !!(config.inlineChartConfig && config.inlineChartData)
	const source = getLlamaAIChartSource(config, dashboardId, AI_SERVER)

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: source?.key ?? ['pro-dashboard', 'chart-disabled', config.id],
		queryFn: async () => {
			if (!source) throw new Error('Chart source unavailable')
			const res = user ? await authorizedFetch(source.url) : await fetch(source.url)
			if (!res?.ok) throw new Error('Failed to load chart')
			return res.json()
		},
		staleTime: 1000 * 60 * 60,
		refetchOnMount: 'always',
		refetchInterval: (query) => (query.state.data?.refreshPending ? 5000 : false),
		enabled: !loaders.userLoading && !!source && !hasInlineData
	})
	const refreshRequest = getLlamaAIChartRefreshRequest(config, dashboardId, AI_SERVER)
	const isOwner = !!user?.id && user.id === dashboardOwnerId
	const refreshMutation = useMutation({
		mutationFn: async () => {
			if (!refreshRequest) throw new Error('Chart refresh unavailable')
			const response = await authorizedFetch(refreshRequest.url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(refreshRequest.body)
			})
			if (!response?.ok) throw new Error('Failed to queue chart refresh')
			return response.json()
		},
		onSuccess: async () => {
			await refetch()
		}
	})
	const canRefresh = !!refreshRequest && !!data?.refreshAvailable && isOwner
	const refreshConfirmation = getLlamaAIChartRefreshConfirmation(config)
	const ownerNotice = getLlamaAIChartOwnerNotice(data?.ownerStatus, isOwner)
	const repairNeeded = isLlamaAIChartRepairNeeded(config.artifactStatus, data?.status)
	const repairHref = buildChartRepairHref(
		config.title || data?.title || 'this chart',
		data?.ownerStatus?.errorCode || config.artifactReasonCode
	)
	const repairAction =
		isOwner && dashboardId ? (
			<a
				href={repairHref}
				className="text-sm text-link hover:underline"
				onClick={() => storeChartRepairTarget({ dashboardId, itemId: config.id })}
			>
				Regenerate chart
			</a>
		) : null

	const fetchedChartConfig = data?.chartConfig
	const charts = useMemo((): Array<ChartConfiguration> => {
		if (hasInlineData && config.inlineChartConfig) {
			return [config.inlineChartConfig]
		}
		if (fetchedChartConfig) {
			return [fetchedChartConfig]
		}
		return []
	}, [hasInlineData, config.inlineChartConfig, fetchedChartConfig])

	const rawChartData = hasInlineData ? config.inlineChartData : data?.chartData

	const filteredChartData = useMemo(() => {
		if (!rawChartData || charts.length === 0) return rawChartData
		return filterLlamaAIChartPayload(charts, rawChartData, timePeriod, customTimePeriod)
	}, [rawChartData, charts, timePeriod, customTimePeriod])

	if (hasInlineData) {
		return (
			<div className="flex flex-col gap-2 p-2">
				<h3 className="font-medium">{config.title || 'Custom Chart'}</h3>
				<ChartRenderer charts={charts} chartData={filteredChartData!} />
			</div>
		)
	}

	if (config.artifactStatus === 'needs-repair') {
		return (
			<div className="flex min-h-[300px] flex-col items-center justify-center gap-2 p-4 text-center">
				<Icon name="alert-triangle" height={24} width={24} className="text-sub-orange" />
				<p className="font-medium text-pro-text-form">This chart needs to be regenerated</p>
				<p className="text-xs text-pro-text-form">The dashboard slot is preserved so the owner can replace it.</p>
				{repairAction}
			</div>
		)
	}

	if (isLoading || loaders.userLoading) {
		return (
			<div className="flex min-h-[300px] items-center justify-center">
				<LoadingSpinner />
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex min-h-[300px] flex-col items-center justify-center gap-2">
				<Icon name="alert-triangle" height={24} width={24} className="text-sub-orange" />
				<p className="text-pro-text-form">Failed to load chart</p>
				<button
					type="button"
					className="text-sm text-link hover:underline"
					onClick={() => {
						void refetch()
					}}
				>
					Try again
				</button>
			</div>
		)
	}

	if (!data) {
		return <p className="flex min-h-[300px] items-center justify-center text-pro-text-form">Chart not found</p>
	}
	const updatedAt = data.dataFreshness?.cachedAt || data.publishedAt

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center justify-between">
				<h3 className="font-medium">{config.title || data.title}</h3>
				<div className="flex items-center gap-2">
					{data.status === 'legacy-snapshot' || data.status === 'snapshot-only' ? (
						<span className="text-xs text-pro-text-form">Snapshot</span>
					) : null}
					{updatedAt ? (
						<RelativeTime className="text-xs text-pro-text-form" value={updatedAt} prefix="Updated" />
					) : data.dataAsOf ? (
						<span className="text-xs text-pro-text-form">Data as of {formatDate(data.dataAsOf) ?? '-'}</span>
					) : null}
					{canRefresh ? (
						<button
							type="button"
							className="text-xs text-link hover:underline disabled:cursor-not-allowed disabled:opacity-60"
							disabled={data.refreshPending || refreshMutation.isPending}
							onClick={() => {
								if (refreshConfirmation && !window.confirm(refreshConfirmation)) return
								refreshMutation.mutate()
							}}
						>
							{data.refreshPending || refreshMutation.isPending ? 'Refreshing…' : 'Refresh'}
						</button>
					) : null}
				</div>
			</div>
			{ownerNotice ? <p className="text-xs text-sub-orange">{ownerNotice}</p> : null}
			{data.refreshError && !ownerNotice ? (
				<p className="text-xs text-sub-orange">Couldn&apos;t refresh — showing the last published snapshot.</p>
			) : null}
			{repairNeeded ? (
				<div className="flex items-center justify-between gap-2 text-xs text-sub-orange">
					<span>This chart can no longer refresh. The last published snapshot is shown.</span>
					{repairAction}
				</div>
			) : null}
			{refreshMutation.isError ? (
				<p className="text-xs text-sub-orange">Couldn&apos;t queue refresh. Try again later.</p>
			) : null}
			<ChartRenderer charts={charts} chartData={filteredChartData!} />
		</div>
	)
}
