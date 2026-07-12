import { AI_SERVER } from '~/constants'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
import type {
	Alert,
	AlertExecution,
	AlertExecutionDetail,
	UpdateAlertInput
} from '~/containers/LlamaAI/components/alerts/types'

export async function createManualAlert(
	authorizedFetch: AuthorizedFetch,
	body: {
		title: string
		prompt?: string
		trigger:
			| { type: 'schedule' }
			| { type: 'price'; token_nk: string; op: 'above' | 'below'; value: number; recurring: boolean }
		alertConfig?: { frequency: 'daily' | 'weekly'; hour: number; dayOfWeek?: number; timezone: string }
		delivery_channel: 'email' | 'telegram' | 'slack'
		slack_team_id?: string
		slack_channel_id?: string
		slack_channel_name?: string | null
	}
): Promise<{ id: string; alertExpression: string; nextRunAt: string }> {
	const res = await authorizedFetch(`${AI_SERVER}/alerts`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	})
	if (!res) throw new Error('Not authenticated')
	if (!res.ok) {
		const errBody = await res.json().catch(() => ({}))
		throw new Error(errBody?.error || 'Failed to create alert')
	}
	return res.json()
}

export async function fetchAlerts(authorizedFetch: AuthorizedFetch): Promise<Alert[]> {
	const res = await authorizedFetch(`${AI_SERVER}/alerts`)
	if (!res) throw new Error('Not authenticated')
	if (!res.ok) {
		throw new Error('Failed to fetch alerts')
	}
	const data = (await res.json().catch(() => null)) as { alerts?: Alert[] } | null
	// Older alert list code treated missing 2xx envelopes as empty lists; keep that
	// deploy-skew tolerance while still throwing on non-2xx above.
	return Array.isArray(data?.alerts) ? data.alerts : []
}

export async function fetchAlertExecutions(
	authorizedFetch: AuthorizedFetch,
	alertId: string
): Promise<AlertExecution[]> {
	const encodedAlertId = encodeURIComponent(alertId)
	const res = await authorizedFetch(`${AI_SERVER}/alerts/${encodedAlertId}/executions`)
	if (!res?.ok) throw new Error('Failed to fetch executions')
	const data = (await res.json().catch(() => null)) as { executions?: AlertExecution[] } | null
	return Array.isArray(data?.executions) ? data.executions : []
}

export async function fetchAlertExecutionDetail(
	authorizedFetch: AuthorizedFetch,
	alertId: string,
	executionId: string
): Promise<AlertExecutionDetail> {
	const encodedAlertId = encodeURIComponent(alertId)
	const encodedExecutionId = encodeURIComponent(executionId)
	const res = await authorizedFetch(`${AI_SERVER}/alerts/${encodedAlertId}/executions/${encodedExecutionId}`)
	if (!res?.ok) throw new Error('Failed to fetch execution detail')
	return res.json()
}

export async function setAlertEnabled(
	authorizedFetch: AuthorizedFetch,
	alertId: string,
	enabled: boolean
): Promise<boolean> {
	const encodedAlertId = encodeURIComponent(alertId)
	const res = await authorizedFetch(`${AI_SERVER}/alerts/${encodedAlertId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ enabled })
	})
	if (!res) throw new Error('Not authenticated')
	if (!res.ok) {
		throw new Error('Failed to update alert')
	}
	return enabled
}

export async function deleteAlert(authorizedFetch: AuthorizedFetch, alertId: string): Promise<string> {
	const encodedAlertId = encodeURIComponent(alertId)
	const res = await authorizedFetch(`${AI_SERVER}/alerts/${encodedAlertId}`, { method: 'DELETE' })
	if (!res) throw new Error('Not authenticated')
	if (!res.ok) {
		throw new Error('Failed to delete alert')
	}
	return alertId
}

export async function updateAlert(
	authorizedFetch: AuthorizedFetch,
	{
		alertId,
		title: nextTitle,
		alertConfig,
		delivery_channel,
		trigger,
		slack_team_id,
		slack_channel_id,
		slack_channel_name
	}: UpdateAlertInput,
	conditionUpdate: { shouldInclude: boolean; value: string | null }
) {
	const encodedAlertId = encodeURIComponent(alertId)
	const res = await authorizedFetch(`${AI_SERVER}/alerts/${encodedAlertId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			title: nextTitle,
			alertConfig,
			trigger,
			delivery_channel,
			...(delivery_channel === 'slack'
				? {
						slack_team_id: slack_team_id ?? null,
						slack_channel_id: slack_channel_id ?? null,
						slack_channel_name: slack_channel_name ?? null
					}
				: {}),
			...(conditionUpdate.shouldInclude ? { condition: conditionUpdate.value } : {})
		})
	})
	if (!res) throw new Error('Not authenticated')
	if (!res.ok) {
		const errBody = await res.json().catch(() => ({ error: res.statusText }))
		throw new Error(errBody.error || 'Failed to update alert')
	}
}
