import { DAYS_OF_WEEK } from '~/containers/LlamaAI/components/alerts/schedule'
import type { AlertsUsage, DeliveryChannel, PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import { formatNumber } from '~/utils/numberFormat'

export type TriggerType = 'schedule' | 'price'
export type PriceOp = 'above' | 'below'

export const ALERT_PROMPT_SUGGESTIONS: Array<{ label: string; prompt: string }> = [
	{ label: 'Hyperliquid health', prompt: 'Hyperliquid TVL, fees, and 7d change' },
	{ label: 'Top revenue growers', prompt: 'Top 5 protocols by 7-day revenue growth' },
	{ label: 'Market pulse', prompt: 'Daily DeFi market pulse: TVL, DEX volume, stablecoins' },
	{ label: 'BTC/ETH/SOL news', prompt: 'News and catalysts for BTC, ETH, SOL' },
	{ label: 'Stablecoin yields', prompt: 'Best stablecoin yields over $10M TVL' },
	{ label: 'New protocols', prompt: 'New protocols listed this week, with their TVL' }
]

export function validatePrompt(triggerType: TriggerType, prompt: string): string | null {
	if (triggerType === 'schedule' && !prompt.trim()) return 'Describe what the report should cover'
	return null
}

export function validatePriceTrigger(fields: { tokenNk: string | null; value: string }): string | null {
	if (!fields.tokenNk) return 'Pick a token'
	if (fields.value.trim() === '' || !Number.isFinite(Number(fields.value))) return 'Enter a price'
	if (Number(fields.value) <= 0) return 'Price must be greater than 0'
	return null
}

export interface SlackTarget {
	teamId: string
	channelId: string
}

const NO_SLACK_TARGET: SlackTarget = { teamId: '', channelId: '' }

/**
 * The Slack target the form should use: the user's own pick, or the only connected workspace and its
 * default channel when there is exactly one to choose from.
 *
 * A pick names its workspace, so a channel can never outlive the workspace it belongs to. Losing
 * that workspace means reselecting: neither the channel nor a substitute default may stand in for a
 * destination the user chose deliberately.
 *
 * The single-workspace case is a default, not a selection. Storing it as one meant writing it from an
 * effect, which showed the form as having no workspace for a render.
 */
export function resolveSlackTarget(input: {
	isSlack: boolean
	picked: SlackTarget | null
	workspaces: ReadonlyArray<{ team_id: string; default_channel_id: string | null }>
}): SlackTarget {
	if (!input.isSlack) return NO_SLACK_TARGET
	const { picked, workspaces } = input
	// A selection that is gone clears the target rather than falling back to a default. Substituting
	// one would move an explicitly chosen destination to a workspace the user never picked, and the
	// pair would look settled enough to save.
	if (picked) return workspaces.some((workspace) => workspace.team_id === picked.teamId) ? picked : NO_SLACK_TARGET
	const sole = workspaces.length === 1 ? workspaces[0] : null
	return sole ? { teamId: sole.team_id, channelId: sole.default_channel_id ?? '' } : NO_SLACK_TARGET
}

/**
 * The name to show and persist for the chosen Slack channel.
 *
 * The loaded channel list is the only source that can name the chosen channel. The proposed name
 * from an alert intent describes the intent's channel and nothing else, so it stands in only while
 * that channel is still the chosen one -- otherwise switching channel before the list arrives would
 * label the alert with somewhere it does not go, and persist that label with the save.
 *
 * No name is better than the wrong one: the id decides delivery, and the payload already accepts a
 * null name.
 */
export function resolveSlackChannelName(input: {
	channelId: string
	channels: ReadonlyArray<{ id: string; name: string }> | undefined
	intentChannelId?: string | null
	intentChannelName?: string | null
}): string | null {
	const loaded = input.channels?.find((channel) => channel.id === input.channelId)
	if (loaded) return loaded.name
	if (input.channelId && input.channelId === input.intentChannelId) return input.intentChannelName ?? null
	return null
}

export function getDeliveryReadinessBlock(input: {
	channel: DeliveryChannel
	telegramLinked: boolean
	slackTeamId: string
	slackWorkspaceCount: number
}): { label: string } | null {
	if (input.channel === 'telegram' && !input.telegramLinked) return { label: 'Link Telegram first' }
	if (input.channel === 'slack' && (input.slackWorkspaceCount === 0 || !input.slackTeamId)) {
		return { label: 'Link Slack first' }
	}
	return null
}

export function getDeliveryBlockReason(delivery: {
	channel: DeliveryChannel
	telegramLinked: boolean
	slackTeamId: string
	slackChannelId: string
	slackWorkspaceCount: number
}): string | null {
	const readinessBlock = getDeliveryReadinessBlock({
		channel: delivery.channel,
		telegramLinked: delivery.telegramLinked,
		slackTeamId: delivery.slackTeamId,
		slackWorkspaceCount: delivery.slackWorkspaceCount
	})
	if (readinessBlock) return readinessBlock.label

	if (delivery.channel === 'slack' && delivery.slackTeamId && !delivery.slackChannelId) {
		return 'Pick a Slack channel'
	}

	return null
}

export function getSubmitBlockReason(input: {
	triggerType: TriggerType
	prompt: string
	price: { tokenNk: string | null; value: string }
	delivery: {
		channel: DeliveryChannel
		telegramLinked: boolean
		slackTeamId: string
		slackChannelId: string
		slackWorkspaceCount: number
	}
}): string | null {
	const promptError = validatePrompt(input.triggerType, input.prompt)
	if (promptError) return promptError

	if (input.triggerType === 'price') {
		const priceError = validatePriceTrigger(input.price)
		if (priceError) return priceError
	}

	return getDeliveryBlockReason(input.delivery)
}

export function getArtifactSubtitle(channel: DeliveryChannel, slackChannelName: string | null): string {
	if (channel === 'telegram') return 'Get this data delivered to your Telegram'
	if (channel === 'slack') {
		return slackChannelName
			? `Get this data delivered to #${slackChannelName}`
			: 'Get this data delivered to your Slack'
	}
	return 'Get this data delivered to your inbox'
}

export interface ArtifactSaveBody {
	messageId: string
	alertId: string
	title: string
	alertConfig?: { frequency: 'daily' | 'weekly'; hour: number; dayOfWeek: number; timezone: string }
	trigger?: PriceTrigger
	delivery_channel: DeliveryChannel
	slack_team_id?: string | null
	slack_channel_id?: string | null
	slack_channel_name?: string | null
}

export function buildArtifactSaveBody(input: {
	messageId: string
	alertId: string
	title: string
	alertConfig?: { frequency: 'daily' | 'weekly'; hour: number; dayOfWeek: number; timezone: string }
	trigger?: PriceTrigger
	channel: DeliveryChannel
	slackTeamId: string
	slackChannelId: string
	slackChannelName: string | null
}): ArtifactSaveBody {
	return {
		messageId: input.messageId,
		alertId: input.alertId,
		title: input.title.trim(),
		...(input.alertConfig ? { alertConfig: input.alertConfig } : {}),
		...(input.trigger ? { trigger: input.trigger } : {}),
		delivery_channel: input.channel,
		...(input.channel === 'slack'
			? {
					slack_team_id: input.slackTeamId,
					slack_channel_id: input.slackChannelId,
					slack_channel_name: input.slackChannelName
				}
			: {})
	}
}

export function formatPriceLabel(price: number): string {
	return `$${
		price >= 10
			? formatNumber(price, { maximumFractionDigits: 2 })
			: formatNumber(price, { maximumSignificantDigits: 4 })
	}`
}

export function roundPriceValue(price: number): string {
	if (!Number.isFinite(price) || price <= 0) return ''
	if (price >= 10) return formatNumber(price, { useGrouping: false, maximumFractionDigits: 2 })
	return formatNumber(price, { useGrouping: false, maximumSignificantDigits: 4 })
}

export function normalizePriceInput(raw: string): string {
	const cleaned = raw.replace(/[^0-9.,]/g, '')
	const hasDot = cleaned.includes('.')
	const hasComma = cleaned.includes(',')
	let canonical = cleaned
	if (hasDot && hasComma) {
		canonical = canonical.replace(/,/g, '')
	} else if (hasComma) {
		canonical = canonical.replace(/,/g, '.')
	}
	const firstDot = canonical.indexOf('.')
	if (firstDot !== -1) {
		canonical = canonical.slice(0, firstDot + 1) + canonical.slice(firstDot + 1).replace(/\./g, '')
	}
	return canonical
}

export function formatPriceDisplay(canonical: string): string {
	if (!canonical) return ''
	const [intPart, ...rest] = canonical.split('.')
	const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	return rest.length > 0 ? `${grouped}.${rest.join('')}` : grouped
}

export function deriveAlertTitle(input: {
	triggerType: TriggerType
	prompt: string
	symbol: string | null
	op: PriceOp
	value: string
}): string {
	if (input.triggerType === 'price') {
		const numericValue = Number(input.value)
		if (!input.symbol || !Number.isFinite(numericValue) || numericValue <= 0) return 'Price alert'
		return `${input.symbol.toUpperCase()} ${input.op} ${formatPriceLabel(numericValue)}`
	}
	const firstLine = input.prompt.trim().split('\n')[0].replace(/\s+/g, ' ')
	if (!firstLine) return 'Scheduled report'
	return firstLine.length > 60 ? `${firstLine.slice(0, 59).trimEnd()}…` : firstLine
}

export function isAlertCapReachedError(error: unknown): boolean {
	return error instanceof Error && error.message === 'alert_cap_reached'
}

export function getUpsellCopy(usage: AlertsUsage | null): string {
	if (usage && usage.cap !== null) return `You've used ${usage.count}/${usage.cap} alerts on your plan`
	return "You've reached your alert limit on this plan"
}

function utcMidnight(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function formatNextRunAt(iso: string, now: Date = new Date()): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return 'soon'

	const diffDays = Math.round((utcMidnight(date) - utcMidnight(now)) / 86_400_000)
	const time = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC',
		timeZoneName: 'short'
	})

	if (diffDays === 0) return `today ${time}`
	if (diffDays === 1) return `tomorrow ${time}`

	const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
	return `${day}, ${time}`
}

export function getPriceCaption(symbol: string, op: PriceOp, value: string): string {
	const numeric = Number(value)
	const label = Number.isFinite(numeric) && numeric > 0 ? formatPriceLabel(numeric) : value
	return `Fires once when ${symbol} goes ${op} ${label}`
}

export function buildScheduleExpressionRaw(input: {
	frequency: 'daily' | 'weekly'
	hour: number
	dayOfWeek: number
	timezone: string
}): string {
	return input.frequency === 'weekly'
		? `Weekly on ${DAYS_OF_WEEK[input.dayOfWeek]} at ${input.hour}:00 ${input.timezone}`
		: `Daily at ${input.hour}:00 ${input.timezone}`
}

export function buildJustAskExample(input: {
	triggerType: TriggerType
	frequency: 'daily' | 'weekly'
	prompt: string
	symbol: string | null
	op: PriceOp
	value: string
}): string {
	if (input.triggerType === 'price') {
		const symbol = input.symbol ? input.symbol.toUpperCase() : null
		const value = input.value.trim()
		if (symbol && value) return `Set up an alert: ${symbol} goes ${input.op} $${value}`
		if (symbol) return `Set up a price alert for ${symbol}: `
		return 'Set up a price alert: '
	}
	const prompt = input.prompt.trim()
	if (prompt) return `Set up a ${input.frequency} alert: ${prompt}`
	return `Set up a ${input.frequency} alert: `
}

export interface CreateAlertFormState {
	title: string
	triggerType: TriggerType
	prompt: string
	schedule: { frequency: 'daily' | 'weekly'; hour: number; dayOfWeek: number; timezone: string }
	price: { tokenNk: string; value: string; op: PriceOp }
	delivery: { channel: DeliveryChannel; slackTeamId: string; slackChannelId: string; slackChannelName: string | null }
}

export function buildCreateAlertBody(state: CreateAlertFormState): {
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
} {
	const trimmedPrompt = state.prompt.trim()

	const body: {
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
	} = {
		title: state.title.trim(),
		trigger:
			state.triggerType === 'price'
				? {
						type: 'price',
						token_nk: state.price.tokenNk,
						op: state.price.op,
						value: Number(state.price.value),
						recurring: false
					}
				: { type: 'schedule' },
		delivery_channel: state.delivery.channel
	}

	if (trimmedPrompt) body.prompt = trimmedPrompt

	if (state.triggerType === 'schedule') {
		body.alertConfig = {
			frequency: state.schedule.frequency,
			hour: state.schedule.hour,
			timezone: state.schedule.timezone,
			...(state.schedule.frequency === 'weekly' ? { dayOfWeek: state.schedule.dayOfWeek } : {})
		}
	}

	if (state.delivery.channel === 'slack') {
		body.slack_team_id = state.delivery.slackTeamId
		body.slack_channel_id = state.delivery.slackChannelId
		body.slack_channel_name = state.delivery.slackChannelName
	}

	return body
}
