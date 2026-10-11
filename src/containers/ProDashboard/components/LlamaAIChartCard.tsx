import { skipToken, useMutation, useQuery } from '@tanstack/react-query'
import { type ReactNode, useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { buildChartRepairHref, storeChartRepairTarget } from '~/containers/LlamaAI/chartRepairTarget'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { ChartRenderer } from '~/containers/LlamaAI/components/charts/ChartRenderer'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { MetaLine } from '~/ui/MetaLine'
import { RelativeTime } from '~/ui/RelativeTime'
import { formatDate } from '~/utils/dateFormat'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { useProDashboardDashboard, useProDashboardPermissions, useProDashboardTime } from '../ProDashboardAPIContext'
import type { LlamaAIChartConfig } from '../types'
import { ProBadge } from '../ui'
import { filterLlamaAIChartPayload } from '../utils/llamaAIChartTimeFilter'
import { useCardHeightScale } from './cardHeightContext'
import {
	getLlamaAIChartOwnerNotice,
	getLlamaAIChartRefreshConfirmation,
	getLlamaAIChartRefreshRequest,
	getLlamaAIChartSource
} from './llamaAIChartSource'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardNotice, ProCardRefreshFailed } from './ProCardStatus'

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

	const chartQuery = useQuery({
		queryKey: source?.key ?? ['pro-dashboard', 'chart-disabled', config.id],
		queryFn:
			source && !loaders.userLoading && !hasInlineData
				? async () => {
						const res = user ? await authorizedFetch(source.url) : await fetch(source.url)
						if (!res?.ok) throw new Error("Couldn't load the chart.")
						return res.json()
					}
				: skipToken,
		staleTime: 1000 * 60 * 60,
		refetchOnMount: 'always',
		refetchInterval: (query) => (query.state.data?.refreshPending ? 5000 : false)
	})
	const { data, isLoading } = chartQuery
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
			if (!response?.ok) throw new Error("Couldn't queue the chart refresh.")
			return response.json()
		},
		onSuccess: async () => {
			await chartQuery.refetch()
		}
	})
	const canRefresh = !!refreshRequest && !!data?.refreshAvailable && isOwner
	// A premium refresh can charge the owner, so it asks first; its pending state and error live in that dialog.
	const refreshConfirmation = getLlamaAIChartRefreshConfirmation(config)
	const [confirmingRefresh, setConfirmingRefresh] = useState(false)
	const ownerNotice = getLlamaAIChartOwnerNotice(data?.ownerStatus, isOwner)
	const repairHref = buildChartRepairHref(
		config.title || data?.title || 'this chart',
		data?.ownerStatus?.errorCode || config.artifactReasonCode
	)
	const repairAction =
		isOwner && dashboardId ? (
			<Button
				as="a"
				href={repairHref}
				size="sm"
				onClick={() => storeChartRepairTarget({ dashboardId, itemId: config.id })}
			>
				Regenerate chart
			</Button>
		) : null

	const fetchedChartConfig = data?.chartConfig
	const charts = useMemo((): Array<ChartConfiguration> => {
		if (hasInlineData) {
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

	// A failed read with a chart already loaded keeps that chart, and an open refresh confirmation with it.
	if (queryReadFailed(chartQuery)) {
		// Retrying reads the chart again; it never repeats the refresh request.
		return renderStatusShell(<ProCardError retry={chartQuery} />)
	}

	if (isLoading || loaders.userLoading) {
		return renderStatusShell(<ProCardLoading />)
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
					<MetaLine>
						{updatedAt ? <RelativeTime value={updatedAt} prefix="Updated" /> : null}
						{!updatedAt && data.dataAsOf ? `Data as of ${formatDate(data.dataAsOf) ?? '-'}` : null}
					</MetaLine>
				}
				controls={
					canRefresh ? (
						// Loading keeps focus on the button, also when the confirmation hands it back mid-refresh.
						<Button
							size="sm"
							variant="ghost"
							pendingLabel="Refreshing…"
							pending={data.refreshPending || refreshMutation.isPending}
							onClick={() => {
								if (refreshConfirmation) {
									// Each opening starts without the last attempt's error.
									refreshMutation.reset()
									setConfirmingRefresh(true)
								} else refreshMutation.mutate()
							}}
						>
							Refresh
						</Button>
					) : null
				}
			/>
			<div className="flex flex-col gap-2 px-3 pb-3">
				{queryRefreshFailed(chartQuery) ? <ProCardRefreshFailed retry={chartQuery} /> : null}
				{ownerNotice ? <ProCardNotice tone="warning">{ownerNotice}</ProCardNotice> : null}
				{data.refreshError && !ownerNotice ? (
					<ProCardNotice tone="warning">Couldn&apos;t refresh. Showing the last published snapshot.</ProCardNotice>
				) : null}
				{/* A stored needs-repair item returned above; this is a failure found after the item was saved. */}
				{data.status === 'needs-repair' ? (
					<ProCardNotice tone="warning">
						<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
							This chart can no longer refresh. The last published snapshot is shown.
							{repairAction}
						</span>
					</ProCardNotice>
				) : null}
				{/* The header's Refresh is the retry: a Try again here would vanish as it starts and drop focus. */}
				{refreshMutation.isError && !refreshConfirmation ? (
					<ProCardNotice tone="error">Couldn&apos;t queue the refresh. Use Refresh to try again.</ProCardNotice>
				) : null}
				<ChartRenderer charts={charts} chartData={filteredChartData!} height={chartHeight} />
			</div>
			{refreshConfirmation ? (
				<ConfirmDialog
					open={confirmingRefresh}
					onClose={() => setConfirmingRefresh(false)}
					portal
					unmountOnHide
					tone="primary"
					title="Refresh with premium data?"
					description={refreshConfirmation}
					confirmLabel="Refresh"
					pendingLabel="Refreshing…"
					pending={refreshMutation.isPending}
					error={refreshMutation.isError ? "Couldn't queue the refresh. Try again." : null}
					onConfirm={() => refreshMutation.mutate(undefined, { onSuccess: () => setConfirmingRefresh(false) })}
				/>
			) : null}
		</div>
	)
}
