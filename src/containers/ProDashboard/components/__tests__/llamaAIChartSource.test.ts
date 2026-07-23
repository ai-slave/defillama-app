import { describe, expect, it } from 'vitest'
import {
	getLlamaAIChartRefreshConfirmation,
	getLlamaAIChartOwnerNotice,
	getLlamaAIChartRefreshRequest,
	getLlamaAIChartSource,
	isLlamaAIChartRepairNeeded
} from '../llamaAIChartSource'

describe('getLlamaAIChartRefreshConfirmation', () => {
	it('shows the stored per-chart ceiling before a premium manual refresh', () => {
		expect(
			getLlamaAIChartRefreshConfirmation({
				id: 'premium',
				kind: 'llamaai-chart',
				artifactContainsPremium: true,
				artifactEstimatedMaxCostUsd: 0.005
			})
		).toBe('This refresh may charge up to $0.005 to your External Data Balance. Continue?')
	})

	it('does not confirm free refreshes and still warns for older premium metadata without a ceiling', () => {
		expect(
			getLlamaAIChartRefreshConfirmation({ id: 'free', kind: 'llamaai-chart', artifactContainsPremium: false })
		).toBeNull()
		expect(
			getLlamaAIChartRefreshConfirmation({ id: 'premium', kind: 'llamaai-chart', artifactContainsPremium: true })
		).toBe('This refresh uses premium data and may charge your External Data Balance. Continue?')
	})
})

describe('getLlamaAIChartSource', () => {
	it('routes V2 reads directly through the dashboard-scoped AI endpoint', () => {
		expect(
			getLlamaAIChartSource(
				{ id: 'item-1', kind: 'llamaai-chart', artifactId: 'artifact-1', artifactStatus: 'live' },
				'dashboard-1',
				'https://ai.test'
			)
		).toEqual({
			url: 'https://ai.test/chart-artifacts/dashboards/dashboard-1/items/item-1',
			key: ['pro-dashboard', 'chart-artifact', 'dashboard-1', 'item-1', 'artifact-1', null]
		})
	})

	it('does not put artifact or version selectors in the read URL', () => {
		const source = getLlamaAIChartSource(
			{
				id: 'item-1',
				kind: 'llamaai-chart',
				artifactId: 'artifact-secret',
				pinnedVersionId: 'version-secret',
				artifactStatus: 'snapshot-only'
			},
			'dashboard-1',
			'https://ai.test'
		)
		expect(source?.url).not.toContain('artifact-secret')
		expect(source?.url).not.toContain('version-secret')
	})

	it('keeps legacy chart reads on the frozen legacy endpoint', () => {
		expect(
			getLlamaAIChartSource(
				{ id: 'legacy', kind: 'llamaai-chart', savedChartId: 'saved-1' },
				'dashboard-1',
				'https://ai.test'
			)
		).toEqual({
			url: 'https://ai.test/charts/saved-1',
			key: ['pro-dashboard', 'saved-chart', 'saved-1']
		})
	})

	it('does not fetch a repair placeholder', () => {
		expect(
			getLlamaAIChartSource(
				{ id: 'broken', kind: 'llamaai-chart', artifactId: null, artifactStatus: 'needs-repair' },
				'dashboard-1',
				'https://ai.test'
			)
		).toBeNull()
	})
})

describe('getLlamaAIChartRefreshRequest', () => {
	it('targets the authenticated artifact job endpoint with dashboard authority', () => {
		expect(
			getLlamaAIChartRefreshRequest(
				{ id: 'item-1', kind: 'llamaai-chart', artifactId: 'artifact-1', artifactStatus: 'live' },
				'dashboard-1',
				'https://ai.test'
			)
		).toEqual({
			url: 'https://ai.test/chart-artifacts/artifact-1/refresh',
			body: { dashboardId: 'dashboard-1' }
		})
	})

	it('does not refresh pinned copies, repair slots, or legacy charts', () => {
		expect(
			getLlamaAIChartRefreshRequest(
				{
					id: 'copy',
					kind: 'llamaai-chart',
					artifactId: 'artifact-1',
					artifactVersionId: 'version-1',
					pinnedVersionId: 'version-1',
					artifactStatus: 'snapshot-only'
				},
				'dashboard-1',
				'https://ai.test'
			)
		).toBeNull()
		expect(
			getLlamaAIChartRefreshRequest(
				{ id: 'legacy', kind: 'llamaai-chart', savedChartId: 'saved-1' },
				'dashboard-1',
				'https://ai.test'
			)
		).toBeNull()
	})
})

describe('getLlamaAIChartOwnerNotice', () => {
	it('shows actionable policy and failure detail only to the artifact owner', () => {
		const status = {
			errorCode: 'source_shape_changed',
			errorDetail: 'Expected a numeric value column.',
			errorAt: '2026-07-15T00:00:00.000Z',
			policyStatus: 'paused' as const,
			pausedReason: 'entitlement_required'
		}

		expect(getLlamaAIChartOwnerNotice(status, true)).toBe(
			'Refresh paused: Expected a numeric value column. Resolve entitlement required, then use Refresh to retry.'
		)
		expect(getLlamaAIChartOwnerNotice(status, false)).toBeNull()
	})

	it('falls back to safe error codes when no detail was recorded', () => {
		expect(
			getLlamaAIChartOwnerNotice(
				{
					errorCode: 'source_execution_failed',
					errorDetail: null,
					errorAt: null,
					policyStatus: 'active',
					pausedReason: null
				},
				true
			)
		).toBe("Couldn't refresh: source execution failed. Use Refresh to retry.")
	})
})

describe('isLlamaAIChartRepairNeeded', () => {
	it('surfaces permanent failures discovered after the dashboard item was saved', () => {
		expect(isLlamaAIChartRepairNeeded('live', 'needs-repair')).toBe(true)
		expect(isLlamaAIChartRepairNeeded('needs-repair', undefined)).toBe(true)
		expect(isLlamaAIChartRepairNeeded('live', 'live')).toBe(false)
	})
})
