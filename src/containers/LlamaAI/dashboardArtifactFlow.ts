import { AI_SERVER } from '~/constants'
import { roundNumber } from '~/utils/numberFormat'
import type { DashboardItemConfig } from '../ProDashboard/dashboardItemConfig'
import type { DashboardArtifactOutcome, ChartArtifactRef } from './types'

export function canAddChartArtifactToDashboard(artifactRef: ChartArtifactRef | undefined, readOnly = false): boolean {
	return !readOnly && !!artifactRef && artifactRef.status !== 'needs-repair'
}

export function buildLlamaAIChartDashboardItem(input: {
	chartId: string
	title: string
	artifactRef: ChartArtifactRef
}): DashboardItemConfig {
	return {
		id: crypto.randomUUID(),
		kind: 'llamaai-chart',
		artifactId: input.artifactRef.artifactId,
		artifactVersionId: input.artifactRef.versionId,
		artifactStatus: input.artifactRef.status,
		artifactContainsPremium: input.artifactRef.containsPremium,
		artifactEstimatedMaxCostUsd: input.artifactRef.estimatedMaxCostUsd,
		title: input.title
	}
}

export function prepareDashboardArtifactSave(
	items: Array<DashboardItemConfig>,
	outcomes: Array<DashboardArtifactOutcome> = []
): {
	items: Array<DashboardItemConfig>
	expectedItemIds: Array<string>
	containsPremium: boolean
	estimatedMaxCostUsd: number
} {
	const byItemId = new Map(outcomes.map((outcome) => [outcome.itemId, outcome]))
	const byChartRef = new Map(outcomes.map((outcome) => [outcome.chartRef, outcome]))
	const premiumArtifacts = new Map<string, number>()
	const expectedItemIds: Array<string> = []
	const nextItems = items.map((item) => {
		if (item.kind !== 'llamaai-chart' || typeof item.chartRef !== 'string') return item
		expectedItemIds.push(item.id)
		const outcome = byItemId.get(item.id) ?? byChartRef.get(item.chartRef)
		const normalized = outcome ?? {
			itemId: item.id,
			chartRef: item.chartRef,
			artifactId: null,
			versionId: null,
			status: 'needs-repair' as const,
			reasonCode: 'artifact-outcome-unavailable',
			containsPremium: false,
			estimatedMaxCostUsd: 0
		}
		if (normalized.status === 'live' && normalized.containsPremium && normalized.artifactId) {
			premiumArtifacts.set(
				normalized.artifactId,
				Math.max(premiumArtifacts.get(normalized.artifactId) ?? 0, normalized.estimatedMaxCostUsd)
			)
		}
		return {
			...item,
			artifactId: normalized.artifactId,
			artifactVersionId: normalized.versionId,
			artifactStatus: normalized.status,
			...(normalized.reasonCode && { artifactReasonCode: normalized.reasonCode }),
			artifactContainsPremium: normalized.containsPremium,
			artifactEstimatedMaxCostUsd: normalized.estimatedMaxCostUsd
		}
	})
	return {
		items: nextItems,
		expectedItemIds: expectedItemIds.sort(),
		containsPremium: premiumArtifacts.size > 0,
		estimatedMaxCostUsd: roundNumber(
			[...premiumArtifacts.values()].reduce((sum, value) => sum + value, 0),
			6
		)
	}
}

export function prepareStoredDashboardActivation(items: Array<DashboardItemConfig>): {
	expectedItemIds: Array<string>
	containsPremium: boolean
	estimatedMaxCostUsd: number
} {
	const expectedItemIds: Array<string> = []
	const premiumArtifacts = new Map<string, number>()
	for (const item of items) {
		if (item.kind !== 'llamaai-chart') continue
		const isV2 = Object.hasOwn(item, 'artifactId') || typeof item.pinnedVersionId === 'string'
		if (!isV2) continue
		expectedItemIds.push(item.id)
		if (
			typeof item.artifactId === 'string' &&
			item.artifactStatus === 'live' &&
			item.artifactContainsPremium &&
			typeof item.artifactEstimatedMaxCostUsd === 'number'
		) {
			premiumArtifacts.set(
				item.artifactId,
				Math.max(premiumArtifacts.get(item.artifactId) ?? 0, item.artifactEstimatedMaxCostUsd)
			)
		}
	}
	return {
		expectedItemIds: expectedItemIds.sort(),
		containsPremium: premiumArtifacts.size > 0,
		estimatedMaxCostUsd: roundNumber(
			[...premiumArtifacts.values()].reduce((sum, value) => sum + value, 0),
			6
		)
	}
}

export async function activateDashboardArtifacts(
	authorizedFetch: (url: string, options?: RequestInit) => Promise<Response>,
	dashboardId: string,
	plan: ReturnType<typeof prepareStoredDashboardActivation>,
	confirmedMaxCostUsd?: number
): Promise<void> {
	if (plan.expectedItemIds.length === 0) return
	const response = await authorizedFetch(`${AI_SERVER}/chart-artifacts/dashboards/${dashboardId}/activate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			expectedItemIds: plan.expectedItemIds,
			...(confirmedMaxCostUsd !== undefined && { confirmedMaxCostUsd })
		})
	})
	if (!response.ok) {
		const body = await response.json().catch(() => null)
		throw new DashboardArtifactActivationError(
			typeof body?.error === 'string' ? body.error : 'Dashboard refresh setup failed',
			response.status
		)
	}
	const result: { outcomes: Array<DashboardArtifactOutcome> } = await response.json()
	const activatedItemIds = result.outcomes.map((outcome) => outcome.itemId).sort()
	if (JSON.stringify(activatedItemIds) !== JSON.stringify(plan.expectedItemIds)) {
		throw new Error('Dashboard refresh setup did not account for every chart')
	}
}

export class DashboardArtifactActivationError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message)
	}
}

/** Starts a stored dashboard's refreshes. When the server needs the account to accept the premium cost first, this
    returns 'needs-confirmation': ask the reader, then call activateDashboardArtifacts with plan.estimatedMaxCostUsd. */
export async function tryActivateDashboardArtifacts(
	authorizedFetch: (url: string, options?: RequestInit) => Promise<Response>,
	dashboardId: string,
	plan: ReturnType<typeof prepareStoredDashboardActivation>
): Promise<'active' | 'pending' | 'needs-confirmation'> {
	try {
		await activateDashboardArtifacts(authorizedFetch, dashboardId, plan)
		return 'active'
	} catch (error) {
		const needsPremiumConfirmation =
			plan.containsPremium &&
			error instanceof DashboardArtifactActivationError &&
			error.status === 409 &&
			error.message.includes('confirmed maximum')
		return needsPremiumConfirmation ? 'needs-confirmation' : 'pending'
	}
}
