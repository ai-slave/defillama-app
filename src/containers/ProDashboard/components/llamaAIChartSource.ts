import { formatUsd } from '~/utils/numberFormat'
import type { LlamaAIChartConfig } from '../types'

export interface LlamaAIChartOwnerStatus {
	errorCode: string | null
	errorDetail: string | null
	errorAt: string | null
	policyStatus: 'active' | 'paused'
	pausedReason: string | null
}

const readableCode = (value: string) => value.replaceAll('_', ' ')

/** What a manual refresh may charge, for the owner to accept first; null when it is free. */
export function getLlamaAIChartRefreshConfirmation(config: LlamaAIChartConfig): string | null {
	if (!config.artifactContainsPremium) return null
	const maxCostUsd = config.artifactEstimatedMaxCostUsd
	return typeof maxCostUsd === 'number' && maxCostUsd > 0
		? `This refresh may charge up to ${formatUsd(maxCostUsd, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} to your External Data Balance.`
		: 'This refresh uses premium data and may charge your External Data Balance.'
}

export function getLlamaAIChartOwnerNotice(
	status: LlamaAIChartOwnerStatus | null | undefined,
	isOwner: boolean
): string | null {
	if (!isOwner || !status) return null
	const detail = (status.errorDetail?.trim() || (status.errorCode ? readableCode(status.errorCode) : '')).replace(
		/[.!]+$/,
		''
	)
	if (status.policyStatus === 'paused') {
		const reason = status.pausedReason ? readableCode(status.pausedReason) : 'the policy issue'
		return `Refresh paused: ${detail || 'Refresh requires attention'}. Resolve ${reason}, then use Refresh to retry.`
	}
	return detail ? `Couldn't refresh: ${detail}. Use Refresh to retry.` : null
}

export function getLlamaAIChartSource(
	config: LlamaAIChartConfig,
	dashboardId: string | null,
	aiServer: string
): { url: string; key: Array<unknown> } | null {
	if (Object.hasOwn(config, 'artifactId')) {
		if (!config.artifactId || !dashboardId || config.artifactStatus === 'needs-repair') return null
		return {
			url: `${aiServer}/chart-artifacts/dashboards/${encodeURIComponent(dashboardId)}/items/${encodeURIComponent(config.id)}`,
			key: [
				'pro-dashboard',
				'chart-artifact',
				dashboardId,
				config.id,
				config.artifactId,
				config.pinnedVersionId ?? null
			]
		}
	}
	if (!config.savedChartId) return null
	return {
		url: `${aiServer}/charts/${encodeURIComponent(config.savedChartId)}`,
		key: ['pro-dashboard', 'saved-chart', config.savedChartId]
	}
}

export function getLlamaAIChartRefreshRequest(
	config: LlamaAIChartConfig,
	dashboardId: string | null,
	aiServer: string
): { url: string; body: { dashboardId: string } } | null {
	if (!config.artifactId || !dashboardId || config.artifactStatus !== 'live' || config.pinnedVersionId) {
		return null
	}
	return {
		url: `${aiServer}/chart-artifacts/${encodeURIComponent(config.artifactId)}/refresh`,
		body: { dashboardId }
	}
}
