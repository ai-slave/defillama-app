import { DAYS_OF_WEEK } from '~/containers/LlamaAI/components/alerts/schedule'
import type { Alert, AlertsUsage, PriceTrigger, UpdateAlertInput } from '~/containers/LlamaAI/components/alerts/types'
import { formatUsd } from '~/utils/numberFormat'

export function isAlertsUpsellActive(usage: AlertsUsage | null | undefined): boolean {
	return usage?.allowed === false
}

export function getAlertsAccessState(
	isAuthenticated: boolean,
	isUserLoading: boolean
): 'loading' | 'sign-in' | 'ready' {
	if (isUserLoading) return 'loading'
	return isAuthenticated ? 'ready' : 'sign-in'
}

export function applyAlertUpdateToList(
	alerts: Alert[],
	input: UpdateAlertInput,
	conditionUpdate: { shouldInclude: boolean; value: string | null }
): Alert[] {
	const newExpression = input.alertConfig
		? input.alertConfig.frequency === 'weekly'
			? `Weekly on ${DAYS_OF_WEEK[input.alertConfig.dayOfWeek]} at ${input.alertConfig.hour}:00 ${input.alertConfig.timezone}`
			: `Daily at ${input.alertConfig.hour}:00 ${input.alertConfig.timezone}`
		: null

	return alerts.map((alert) =>
		alert.id === input.alertId
			? {
					...alert,
					title: input.title,
					...(newExpression ? { schedule_expression: newExpression } : {}),
					...(input.trigger ? { trigger: input.trigger } : {}),
					delivery_channel: input.delivery_channel,
					...(input.delivery_channel === 'slack'
						? {
								slack_team_id: input.slack_team_id,
								slack_channel_id: input.slack_channel_id,
								slack_channel_name: input.slack_channel_name
							}
						: {}),
					...(conditionUpdate.shouldInclude ? { condition: conditionUpdate.value } : {})
				}
			: alert
	)
}

export type PriceAlertState = 'armed' | 'waiting to re-arm' | 'fired' | 'paused'

export function getPriceAlertState(
	enabled: boolean,
	armed: boolean | undefined,
	recurring: boolean | undefined,
	runCount: number
): PriceAlertState {
	if (enabled) return armed === false ? 'waiting to re-arm' : 'armed'
	return recurring === false && runCount > 0 ? 'fired' : 'paused'
}

export function formatPriceAlertSummary(
	trigger: PriceTrigger,
	enabled: boolean,
	armed: boolean | undefined,
	runCount: number
): string {
	const valueLabel = formatUsd(trigger.value, { maximumFractionDigits: 8 })
	const state = getPriceAlertState(enabled, armed, trigger.recurring, runCount)
	const segments = [
		`${formatTokenLabel(trigger.token_nk)} ${trigger.op} ${valueLabel}`,
		trigger.recurring === false ? 'one-time' : null,
		state
	]
	return segments.filter((segment): segment is string => !!segment).join(' · ')
}

export function isFiredOneTimePriceAlert(alert: Alert): boolean {
	return (
		!!alert.trigger &&
		alert.trigger.type === 'price' &&
		alert.enabled === false &&
		alert.trigger.recurring === false &&
		alert.run_count > 0
	)
}

export interface AlertChip {
	text: string
	variant: 'static'
}

export const ALERT_EMPTY_STATE_CHIPS: AlertChip[] = [
	{ text: 'Daily brief on Hyperliquid, Solana and stablecoins, every morning', variant: 'static' },
	{ text: 'Ping me if ETH drops below $3,000', variant: 'static' }
]

export const ALERT_ESCAPE_HATCH_PREFILL = 'Set up an alert: '

export function formatTokenLabel(tokenNk: string): string {
	const raw = tokenNk.split(':').pop() ?? tokenNk
	return raw.replace(/-/g, ' ').toUpperCase()
}

export function execChipTone(status: string, hasError: boolean): 'success' | 'error' {
	if (status === 'success' || status === 'test') return 'success'
	if (status === 'delivery_test') return hasError ? 'error' : 'success'
	return 'error'
}

export function execChipLabel(status: string): string {
	return status === 'delivery_test' ? 'test ping' : status
}
