import { describe, expect, test, vi } from 'vitest'
import {
	activateDashboardArtifacts,
	activateDashboardArtifactsWithConfirmation,
	buildLlamaAIChartDashboardItem,
	canAddChartArtifactToDashboard,
	prepareDashboardArtifactSave,
	prepareStoredDashboardActivation
} from '../dashboardArtifactFlow'

describe('prepareDashboardArtifactSave', () => {
	test('offers durable live and snapshot charts but never broken or public read-only artifacts', () => {
		const ref = {
			artifactId: 'artifact-1',
			versionId: 'version-1',
			status: 'snapshot-only' as const,
			containsPremium: false,
			estimatedMaxCostUsd: 0
		}
		expect(canAddChartArtifactToDashboard(ref, false)).toBe(true)
		expect(canAddChartArtifactToDashboard({ ...ref, status: 'needs-repair' }, false)).toBe(false)
		expect(canAddChartArtifactToDashboard(ref, true)).toBe(false)
	})

	test('builds a direct dashboard item from the durable artifact ref without legacy chart saving', () => {
		expect(
			buildLlamaAIChartDashboardItem(
				{
					chartId: 'chart-1',
					title: 'TVL',
					artifactRef: {
						artifactId: 'artifact-1',
						versionId: 'version-1',
						status: 'live',
						containsPremium: true,
						estimatedMaxCostUsd: 0.005
					}
				},
				'Renamed'
			)
		).toMatchObject({
			kind: 'llamaai-chart',
			artifactId: 'artifact-1',
			artifactVersionId: 'version-1',
			artifactStatus: 'live',
			artifactContainsPremium: true,
			artifactEstimatedMaxCostUsd: 0.005,
			title: 'Renamed'
		})
	})

	test('persists every custom chart as a V2 ref and keeps broken slots repairable', () => {
		const result = prepareDashboardArtifactSave(
			[
				{ id: 'item-live', kind: 'llamaai-chart', chartRef: 'chart-live' },
				{ id: 'item-broken', kind: 'llamaai-chart', chartRef: 'chart-broken' },
				{ id: 'metric', kind: 'metric' } as any
			],
			[
				{
					itemId: 'item-live',
					chartRef: 'chart-live',
					artifactId: 'artifact-1',
					versionId: 'version-1',
					status: 'live',
					containsPremium: true,
					estimatedMaxCostUsd: 0.025
				},
				{
					itemId: 'item-broken',
					chartRef: 'chart-broken',
					artifactId: null,
					versionId: null,
					status: 'needs-repair',
					reasonCode: 'generation-failed',
					containsPremium: false,
					estimatedMaxCostUsd: 0
				}
			]
		)

		expect(result.items).toEqual([
			expect.objectContaining({
				id: 'item-live',
				artifactId: 'artifact-1',
				artifactVersionId: 'version-1',
				artifactStatus: 'live'
			}),
			expect.objectContaining({
				id: 'item-broken',
				artifactId: null,
				artifactStatus: 'needs-repair',
				artifactReasonCode: 'generation-failed'
			}),
			{ id: 'metric', kind: 'metric' }
		])
		expect(result).toMatchObject({
			expectedItemIds: ['item-broken', 'item-live'],
			containsPremium: true,
			estimatedMaxCostUsd: 0.025
		})
	})

	test('deduplicates repeated references to the same billed artifact', () => {
		const outcome = {
			chartRef: 'chart-1',
			artifactId: 'artifact-1',
			versionId: 'version-1',
			status: 'live' as const,
			containsPremium: true,
			estimatedMaxCostUsd: 0.025
		}
		const result = prepareDashboardArtifactSave(
			[
				{ id: 'item-a', kind: 'llamaai-chart', chartRef: 'chart-1' },
				{ id: 'item-b', kind: 'llamaai-chart', chartRef: 'chart-1' }
			],
			[
				{ ...outcome, itemId: 'item-a' },
				{ ...outcome, itemId: 'item-b' }
			]
		)
		expect(result.estimatedMaxCostUsd).toBe(0.025)
	})
})

describe('prepareStoredDashboardActivation', () => {
	test('accounts for every stored V2 chart while billing each premium artifact once', () => {
		const result = prepareStoredDashboardActivation([
			{
				id: 'item-a',
				kind: 'llamaai-chart',
				artifactId: 'artifact-premium',
				artifactStatus: 'live',
				artifactContainsPremium: true,
				artifactEstimatedMaxCostUsd: 0.005
			},
			{
				id: 'item-b',
				kind: 'llamaai-chart',
				artifactId: 'artifact-premium',
				artifactStatus: 'live',
				artifactContainsPremium: true,
				artifactEstimatedMaxCostUsd: 0.005
			},
			{
				id: 'item-snapshot',
				kind: 'llamaai-chart',
				artifactId: 'artifact-snapshot',
				artifactStatus: 'snapshot-only',
				artifactContainsPremium: true,
				artifactEstimatedMaxCostUsd: 9
			},
			{ id: 'metric', kind: 'metric' } as any
		])

		expect(result).toEqual({
			expectedItemIds: ['item-a', 'item-b', 'item-snapshot'],
			containsPremium: true,
			estimatedMaxCostUsd: 0.005
		})
	})

	test('does not reauthorize existing premium spend unless a new ceiling is explicitly confirmed', async () => {
		const authorizedFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					outcomes: [{ itemId: 'item-a' }, { itemId: 'item-b' }]
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		)
		const plan = {
			expectedItemIds: ['item-a', 'item-b'],
			containsPremium: true,
			estimatedMaxCostUsd: 0.005
		}

		await activateDashboardArtifacts(authorizedFetch, 'dashboard-1', plan)
		expect(authorizedFetch).toHaveBeenCalledWith(
			expect.stringContaining('/chart-artifacts/dashboards/dashboard-1/activate'),
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ expectedItemIds: ['item-a', 'item-b'] })
			})
		)
	})

	test('requires the activation response to account for the complete authority set', async () => {
		const authorizedFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ outcomes: [{ itemId: 'item-a' }] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		)
		const plan = { expectedItemIds: ['item-a', 'item-b'], containsPremium: true, estimatedMaxCostUsd: 0.005 }

		await expect(activateDashboardArtifacts(authorizedFetch, 'dashboard-1', plan, 0.005)).rejects.toThrow(
			'did not account for every chart'
		)
	})

	test('confirms and retries exactly once only when the server requires a higher premium ceiling', async () => {
		const authorizedFetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: 'Premium dashboard refresh requires a confirmed maximum cost' }), {
					status: 409,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ outcomes: [{ itemId: 'item-a' }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		const confirmPremium = vi.fn(() => true)
		const plan = { expectedItemIds: ['item-a'], containsPremium: true, estimatedMaxCostUsd: 0.005 }

		await expect(
			activateDashboardArtifactsWithConfirmation(authorizedFetch, 'dashboard-1', plan, confirmPremium)
		).resolves.toBe('active')
		expect(confirmPremium).toHaveBeenCalledWith(0.005)
		expect(authorizedFetch).toHaveBeenCalledTimes(2)
		expect(authorizedFetch.mock.calls[0][1]?.body).toBe(JSON.stringify({ expectedItemIds: ['item-a'] }))
		expect(authorizedFetch.mock.calls[1][1]?.body).toBe(
			JSON.stringify({ expectedItemIds: ['item-a'], confirmedMaxCostUsd: 0.005 })
		)
	})
})
