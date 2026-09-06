import type { PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import type { AlertProposedData } from '~/containers/LlamaAI/types'

export type PersistedAlertIntent = {
	frequency?: 'daily' | 'weekly'
	hour?: number
	timezone?: string
	dayOfWeek?: number
	dataQuery?: string
	prompt?: string
	title?: string
	deliveryChannel?: 'email' | 'telegram' | 'slack'
	slackTeamId?: string | null
	slackTeamName?: string | null
	slackChannelId?: string | null
	slackChannelName?: string | null
	trigger?: PriceTrigger
}

export type RestoredAlertMetadata = {
	alertIntent?: PersistedAlertIntent
	savedAlertId?: string
	savedAlertIds?: Array<string>
	saveableAlertIds?: Array<string>
	deliveryChannel?: 'email' | 'telegram' | 'slack'
}

function getFirstAlertMarkerId(content?: string) {
	return content?.match(/\[ALERT:([^\]]+)\]/)?.[1]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeDeliveryChannel(value: unknown): 'email' | 'telegram' | 'slack' | undefined {
	return value === 'email' || value === 'telegram' || value === 'slack' ? value : undefined
}

function getStringValue(...values: Array<unknown>): string | null {
	for (const value of values) {
		if (typeof value === 'string') return value
	}
	return null
}

function normalizeHour(value: unknown) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return 9
	return Math.min(23, Math.max(0, Math.trunc(value)))
}

function normalizeDayOfWeek(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 6
		? value
		: undefined
}

function normalizePriceTrigger(value: unknown): PriceTrigger | undefined {
	if (!isRecord(value)) return undefined
	if (value.type !== 'price') return undefined
	if (typeof value.token_nk !== 'string' || !value.token_nk) return undefined
	if (value.op !== 'above' && value.op !== 'below') return undefined
	if (typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value <= 0) return undefined
	return {
		type: 'price',
		token_nk: value.token_nk,
		op: value.op,
		value: value.value,
		...(typeof value.recurring === 'boolean' ? { recurring: value.recurring } : {})
	}
}

export function normalizeAlertProposedData(value: unknown): AlertProposedData {
	const outerEvent = isRecord(value) ? value : {}
	const event = isRecord(outerEvent.content) ? outerEvent.content : outerEvent
	const rawIntent = isRecord(event.alertIntent) ? event.alertIntent : {}
	const restoredDeliveryChannel =
		normalizeDeliveryChannel(rawIntent.deliveryChannel) ||
		normalizeDeliveryChannel(event.deliveryChannel) ||
		normalizeDeliveryChannel(event.delivery_channel)

	const prompt =
		(typeof event.prompt === 'string' && event.prompt) ||
		(typeof rawIntent.prompt === 'string' && rawIntent.prompt) ||
		''

	const trigger = normalizePriceTrigger(rawIntent.trigger)

	return {
		alertId: typeof event.alertId === 'string' && event.alertId ? event.alertId : 'alert_proposed_fallback',
		title:
			(typeof event.title === 'string' && event.title) ||
			(typeof rawIntent.title === 'string' && rawIntent.title) ||
			(typeof rawIntent.dataQuery === 'string' ? rawIntent.dataQuery : ''),
		...(prompt ? { prompt } : {}),
		alertIntent: {
			frequency: rawIntent.frequency === 'weekly' ? 'weekly' : 'daily',
			hour: normalizeHour(rawIntent.hour),
			timezone: typeof rawIntent.timezone === 'string' && rawIntent.timezone ? rawIntent.timezone : 'UTC',
			dayOfWeek: normalizeDayOfWeek(rawIntent.dayOfWeek),
			deliveryChannel: restoredDeliveryChannel,
			...(trigger ? { trigger } : {}),
			...(restoredDeliveryChannel === 'slack'
				? {
						slackTeamId: getStringValue(
							rawIntent.slackTeamId,
							rawIntent.slack_team_id,
							event.slackTeamId,
							event.slack_team_id
						),
						slackTeamName: getStringValue(
							rawIntent.slackTeamName,
							rawIntent.slack_team_name,
							event.slackTeamName,
							event.slack_team_name
						),
						slackChannelId: getStringValue(
							rawIntent.slackChannelId,
							rawIntent.slack_channel_id,
							event.slackChannelId,
							event.slack_channel_id
						),
						slackChannelName: getStringValue(
							rawIntent.slackChannelName,
							rawIntent.slack_channel_name,
							event.slackChannelName,
							event.slack_channel_name
						)
					}
				: {})
		},
		schedule_expression: typeof event.schedule_expression === 'string' ? event.schedule_expression : '',
		next_run_at: typeof event.next_run_at === 'string' ? event.next_run_at : ''
	}
}

// Rebuild alert artifacts from persisted assistant metadata when restoring a session.
export function buildRestoredAlerts({
	content,
	messageId,
	metadata,
	savedAlertIds
}: {
	content?: string
	messageId?: string
	metadata?: RestoredAlertMetadata
	savedAlertIds?: Array<string>
}): Array<AlertProposedData> | undefined {
	if (!metadata?.alertIntent) return undefined
	const persistedAlertId =
		getFirstAlertMarkerId(content) ||
		metadata.saveableAlertIds?.[0] ||
		metadata.savedAlertIds?.[0] ||
		savedAlertIds?.[0] ||
		metadata.savedAlertId ||
		`restored_${messageId}`

	// PR #38 added deliveryChannel after Telegram support; older saved alert metadata may omit it.
	const restoredDeliveryChannel = metadata.alertIntent.deliveryChannel || metadata.deliveryChannel
	const trigger = normalizePriceTrigger(metadata.alertIntent.trigger)
	return [
		{
			alertId: persistedAlertId,
			title: metadata.alertIntent.title || metadata.alertIntent.dataQuery || '',
			...(metadata.alertIntent.prompt ? { prompt: metadata.alertIntent.prompt } : {}),
			alertIntent: {
				frequency: metadata.alertIntent.frequency || 'daily',
				hour: normalizeHour(metadata.alertIntent.hour),
				timezone: metadata.alertIntent.timezone || 'UTC',
				dayOfWeek: normalizeDayOfWeek(metadata.alertIntent.dayOfWeek),
				deliveryChannel: restoredDeliveryChannel,
				...(trigger ? { trigger } : {}),
				...(restoredDeliveryChannel === 'slack'
					? {
							slackTeamId: metadata.alertIntent.slackTeamId ?? null,
							slackTeamName: metadata.alertIntent.slackTeamName ?? null,
							slackChannelId: metadata.alertIntent.slackChannelId ?? null,
							slackChannelName: metadata.alertIntent.slackChannelName ?? null
						}
					: {})
			},
			schedule_expression: '',
			next_run_at: ''
		}
	]
}
