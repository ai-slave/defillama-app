import { useMutation, useQuery } from '@tanstack/react-query'
import { type ReactNode, useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { buildChartRepairHref, storeChartRepairTarget } from '~/containers/LlamaAI/chartRepairTarget'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { ChartRenderer } from '~/containers/LlamaAI/components/charts/ChartRenderer'
import { RelativeTime } from '~/ui/RelativeTime'
import { formatDate } from '~/utils/dateFormat'
import { useProDashboardDashboard, useProDashboardPermissions, useProDashboardTime } from '../ProDashboardAPIContext'
import type { LlamaAIChartConfig } from '../types'
import { ProBadge, ProButton, ProMeta } from '../ui'
import { filterLlamaAIChartPayload } from '../utils/llamaAIChartTimeFilter'
import { useCardHeightScale } from './cardHeightContext'
import {
	getLlamaAIChartOwnerNotice,
	getLlamaAIChartRefreshConfirmation,
	getLlamaAIChartRefreshRequest,
	getLlamaAIChartSource,
	isLlamaAIChartRepairNeeded
} from './llamaAIChartSource'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading } from './ProCardStatus'

interface LlamaAIChartCardProps {
	config: LlamaAIChartConfig
}

export default function LlamaAIChartCard({ config }: LlamaAIChartCardProps) {
	const { authorizedFetch, user, loaders } = useAuthContext()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { dashboardId } = useProDashboardDashboard()
	const { dashboardOwnerId } = useProDashboardPermissions()
	const chartHeight = Math.round(360 * useCardHeightScale())

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
			<div className="flex flex-col p-0">
				<ProCardHeader titleAs="h3" title={config.title || 'Custom Chart'} />
				<div className="px-3 pb-3">
					<ChartRenderer charts={charts} chartData={filteredChartData!} height={chartHeight} />
				</div>
			</div>
		)
	}

	if (config.artifactStatus === 'needs-repair') {
		return (
			<div className="flex min-h-[calc(300px*var(--card-scale,1))] flex-col justify-center gap-2 p-4">
				<ProCardError
					role="status"
					title="This chart needs to be regenerated"
					detail="The dashboard slot is preserved so the owner can replace it."
				/>
				{repairAction ? <div className="flex justify-center">{repairAction}</div> : null}
			</div>
		)
	}

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex min-h-[calc(300px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader titleAs="h3" title={config.title || 'Custom Chart'} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (isLoading || loaders.userLoading) {
		return renderStatusShell(<ProCardLoading />)
	}

	if (error) {
		return renderStatusShell(
			<ProCardError
				onRetry={() => {
					void refetch()
				}}
			/>
		)
	}

	if (!data) {
		return (
			<div className="flex min-h-[calc(300px*var(--card-scale,1))] flex-col justify-center">
				<ProCardEmpty message="Chart not found" />
			</div>
		)
	}
	const updatedAt = data.dataFreshness?.cachedAt || data.publishedAt

	return (
		<div className="flex flex-col p-0">
			<ProCardHeader
				titleAs="h3"
				title={config.title || data.title}
				badge={
					data.status === 'legacy-snapshot' || data.status === 'snapshot-only' ? (
						<ProBadge tone="neutral">Snapshot</ProBadge>
					) : null
				}
				subtitle={
					<ProMeta
						items={[
							updatedAt ? <RelativeTime key="updated" value={updatedAt} prefix="Updated" /> : null,
							!updatedAt && data.dataAsOf ? `Data as of ${formatDate(data.dataAsOf) ?? '-'}` : null
						]}
					/>
				}
				controls={
					canRefresh ? (
						<ProButton
							size="sm"
							variant="ghost"
							disabled={data.refreshPending || refreshMutation.isPending}
							onClick={() => {
								if (refreshConfirmation && !window.confirm(refreshConfirmation)) return
								refreshMutation.mutate()
							}}
						>
							{data.refreshPending || refreshMutation.isPending ? 'Refreshing…' : 'Refresh'}
						</ProButton>
					) : null
				}
			/>
			<div className="flex flex-col gap-2 px-3 pb-3">
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
				<ChartRenderer charts={charts} chartData={filteredChartData!} height={chartHeight} />
			</div>
		</div>
	)
}
